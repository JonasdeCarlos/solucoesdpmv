import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Endpoint público para a empresa (cliente do escritório) usar somente a ferramenta de feedback.
// Autenticação: public_feedback_token da empresa.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "info";
    const token = body.token;
    if (!token) throw new Error("token ausente");

    const { data: empresa, error: e1 } = await supa
      .from("clientes")
      .select("id, nome, nome_fantasia")
      .eq("public_feedback_token", token)
      .maybeSingle();
    if (e1) throw e1;
    if (!empresa) return json({ error: "Empresa não encontrada" }, 404);

    if (action === "info") {
      return json({ empresa });
    }

    if (action === "list") {
      const { data, error } = await supa
        .from("feedback_records")
        .select("id, tipo, employee_name, employee_role, manager_name, tom, generated_text, public_token, created_at, view_log")
        .eq("client_id", empresa.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ empresa, items: data || [] });
    }

    if (action === "create") {
      const { record } = body || {};
      if (!record?.employee_name || !record?.tipo || !record?.generated_text) {
        return json({ error: "campos obrigatórios ausentes" }, 400);
      }
      const ALLOWED = ["feedback", "cobranca", "alinhamento"];
      if (!ALLOWED.includes(record.tipo)) return json({ error: "tipo inválido" }, 400);
      const { data, error } = await supa.from("feedback_records").insert({
        client_id: empresa.id,
        tipo: record.tipo,
        employee_name: String(record.employee_name).slice(0, 200),
        employee_role: record.employee_role ? String(record.employee_role).slice(0, 200) : null,
        manager_name: record.manager_name ? String(record.manager_name).slice(0, 200) : null,
        pontos_fortes: record.pontos_fortes || null,
        pontos_melhorar: record.pontos_melhorar || null,
        fato_ocorrido: record.fato_ocorrido || null,
        tom: record.tom || null,
        generated_text: String(record.generated_text).slice(0, 20000),
      }).select("*").single();
      if (error) throw error;
      return json({ ok: true, item: data });
    }

    if (action === "update") {
      const { id, generated_text } = body || {};
      if (!id || typeof generated_text !== "string") return json({ error: "id/texto ausentes" }, 400);
      const { error } = await supa.from("feedback_records")
        .update({ generated_text: generated_text.slice(0, 20000) })
        .eq("id", id)
        .eq("client_id", empresa.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body || {};
      if (!id) return json({ error: "id ausente" }, 400);
      const { error } = await supa.from("feedback_records").delete().eq("id", id).eq("client_id", empresa.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "generate") {
      const KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!KEY) throw new Error("LOVABLE_API_KEY missing");
      const { tipo, employee_name, employee_role, pontos_fortes, pontos_melhorar, fato_ocorrido, tom, manager_name } = body.input || {};
      
      const companyName = empresa.nome_fantasia || empresa.nome || "";
      const companyInstruction = companyName 
        ? `O nome da empresa/estabelecimento é "${companyName}". Use OBRIGATORIAMENTE este nome quando se referir à empresa/estabelecimento (por exemplo, na introdução, no corpo ou no encerramento). NUNCA utilize colchetes ou placeholders genéricos como '[Nome do Restaurante/Estabelecimento]', '[Nome da Empresa]' ou '[Sua Empresa]'. Substitua-os todos por "${companyName}".`
        : `Não use placeholders genéricos ou colchetes como '[Nome do Restaurante/Estabelecimento]'. Se não souber o nome, use termos gerais de forma natural sem deixar lacunas.`;

      const SAFE = `Regras OBRIGATÓRIAS: tom respeitoso e construtivo, foco em fatos e comportamentos, sem ironia/ameaças/comparações/humilhação. Nunca cite punições, demissão, advertência ou salário. Em PT-BR.`;
      let instr = "";
      if (tipo === "feedback") {
        instr = `FEEDBACK para "${employee_name}"${employee_role ? ` (${employee_role})` : ""}. ${companyInstruction}\nPontos fortes: ${pontos_fortes || "—"}. Pontos a melhorar: ${pontos_melhorar || "—"}. Estrutura: abertura cordial, reconhecimento, oportunidades, próximos passos, encerramento de apoio.`;
      } else if (tipo === "cobranca" || tipo === "alinhamento") {
        const tomL = tom === "leve" ? "LEVE" : tom === "cobranca" ? "FORTE (cobrança formal respeitosa)" : "MÉDIO";
        instr = `${tipo === "cobranca" ? "ALINHAMENTO/COBRANÇA" : "DOCUMENTO DE ALINHAMENTO"} em tom ${tomL} para "${employee_name}"${employee_role ? ` (${employee_role})` : ""}. ${companyInstruction}\nFato: ${fato_ocorrido || "—"}. Pontos fortes: ${pontos_fortes || "—"}. Pontos a melhorar: ${pontos_melhorar || "—"}. Estrutura: contexto, impacto, comportamento esperado, apoio do gestor, acompanhamento.`;
      } else return json({ error: "tipo inválido" }, 400);

      const prompt = `${SAFE}\n\n${instr}\n${manager_name ? `Assinatura: ${manager_name}.` : ""}\nRetorne APENAS o texto final.`;
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Especialista em RH/DP brasileiro, comunicação não-violenta, prevenção de assédio moral." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      const d = await r.json();
      const texto = d?.choices?.[0]?.message?.content || "";
      const u = d?.usage || {};
      const pt = Number(u.prompt_tokens || 0), ct = Number(u.completion_tokens || 0);
      const tt = Number(u.total_tokens || (pt + ct));
      const credits = +((pt * 0.00003) + (ct * 0.00025)).toFixed(6);
      try {
        await supa.from("ai_usage_log").insert({
          client_id: empresa.id, function_name: "feedback-empresa", model: "google/gemini-2.5-flash",
          prompt_tokens: pt, completion_tokens: ct, total_tokens: tt, credits_estimate: credits,
          meta: { tipo, tom: tom || null, source: "public" },
        });
      } catch (_) { /* noop */ }
      return json({ texto, usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: tt, credits_estimate: credits } });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}