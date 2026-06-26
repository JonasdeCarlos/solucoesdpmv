import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SAFE_GUIDELINES = `Regras OBRIGATÓRIAS para evitar assédio moral:
- Tom respeitoso, profissional e construtivo, sempre na 1ª pessoa do plural ("nós", "podemos", "vamos").
- Nunca use adjetivos pejorativos, ironia, ameaças, comparações com colegas ou linguagem humilhante.
- Foque em FATOS observáveis e em COMPORTAMENTOS desejados, não em julgamentos pessoais.
- Reconheça o esforço do colaborador e ofereça apoio para a melhoria.
- Não mencione punições, demissão, advertências, salário ou expor o colaborador publicamente.
- Em português do Brasil.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json();
    const { tipo, employee_name, employee_role, pontos_fortes, pontos_melhorar, fato_ocorrido, tom, manager_name, client_id } = body || {};

    let companyName = "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (client_id) {
      try {
        const { data: cl } = await supa
          .from("clientes")
          .select("nome, nome_fantasia")
          .eq("id", client_id)
          .maybeSingle();
        if (cl) {
          companyName = cl.nome_fantasia || cl.nome;
        }
      } catch (_) { /* ignore query error and fallback */ }
    }

    const companyInstruction = companyName 
      ? `O nome da empresa/estabelecimento é "${companyName}". Use OBRIGATORIAMENTE este nome quando se referir à empresa/estabelecimento (por exemplo, na introdução, no corpo ou no encerramento). NUNCA utilize colchetes ou placeholders genéricos como '[Nome do Restaurante/Estabelecimento]', '[Nome da Empresa]' ou '[Sua Empresa]'. Substitua-os todos por "${companyName}".`
      : `Não use placeholders genéricos ou colchetes como '[Nome do Restaurante/Estabelecimento]'. Se não souber o nome, use termos gerais de forma natural sem deixar lacunas.`;

    let instruction = "";
    if (tipo === "feedback") {
      instruction = `Gere um FEEDBACK estruturado e amigável para o colaborador "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
${companyInstruction}
Estrutura sugerida: (1) abertura cordial, (2) reconhecimento dos pontos fortes, (3) pontos a desenvolver apresentados como oportunidades, (4) próximos passos colaborativos, (5) encerramento de apoio.
Pontos fortes informados pelo gestor: ${pontos_fortes || "—"}
Pontos a melhorar informados pelo gestor: ${pontos_melhorar || "—"}`;
    } else if (tipo === "cobranca") {
      const tomLabel = tom === "leve" ? "LEVE (lembrete cordial)" : tom === "medio" ? "MÉDIO (alinhamento firme, sem dureza)" : "FORTE (cobrança formal, ainda respeitosa)";
      instruction = `Gere um TEXTO DE ALINHAMENTO/COBRANÇA em tom ${tomLabel} para o colaborador "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
${companyInstruction}
Fato ocorrido (descrição do gestor): ${fato_ocorrido || "—"}
Estrutura: (1) contextualização objetiva do fato, (2) impacto para a equipe/cliente, (3) comportamento esperado daqui em diante, (4) oferta de apoio do gestor, (5) combinado de acompanhamento.`;
    } else if (tipo === "alinhamento") {
      instruction = `Gere um DOCUMENTO DE ALINHAMENTO formal para registro, com tom ${tom || "medio"}, dirigido a "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
${companyInstruction}
Fato/situação: ${fato_ocorrido || "—"}
Pontos fortes: ${pontos_fortes || "—"}
Pontos a melhorar: ${pontos_melhorar || "—"}
Estrutura: (1) introdução, (2) contexto, (3) acordos firmados, (4) prazo de reavaliação, (5) encerramento.`;
    } else {
      throw new Error("tipo inválido");
    }

    const prompt = `${SAFE_GUIDELINES}

${instruction}

${manager_name ? `Assinatura final do gestor: ${manager_name}.` : ""}

Retorne APENAS o texto final pronto para uso, sem cabeçalhos markdown ou JSON.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em RH/DP brasileiro, treinado em comunicação não-violenta e prevenção de assédio moral." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const data = await r.json();
    const texto = data?.choices?.[0]?.message?.content || "";
    const usage = data?.usage || {};
    const prompt_tokens = Number(usage.prompt_tokens || 0);
    const completion_tokens = Number(usage.completion_tokens || 0);
    const total_tokens = Number(usage.total_tokens || (prompt_tokens + completion_tokens));
    // Gemini 2.5 Flash via Lovable AI: estimativa em créditos (1 crédito ≈ US$0,01)
    // Preço aprox.: input $0.30/1M tok, output $2.50/1M tok
    const credits_estimate = +((prompt_tokens * 0.00003) + (completion_tokens * 0.00025)).toFixed(6);
    if (client_id) {
      try {
        const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supa.from("ai_usage_log").insert({
          client_id, function_name: "feedback-generate", model: "google/gemini-2.5-flash",
          prompt_tokens, completion_tokens, total_tokens, credits_estimate,
          meta: { tipo, tom: tom || null },
        });
      } catch (_) { /* não bloqueia */ }
    }
    return new Response(JSON.stringify({ texto, usage: { prompt_tokens, completion_tokens, total_tokens, credits_estimate } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});