import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
    const { tipo, employee_name, employee_role, pontos_fortes, pontos_melhorar, fato_ocorrido, tom, manager_name } = body || {};

    let instruction = "";
    if (tipo === "feedback") {
      instruction = `Gere um FEEDBACK estruturado e amigável para o colaborador "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
Estrutura sugerida: (1) abertura cordial, (2) reconhecimento dos pontos fortes, (3) pontos a desenvolver apresentados como oportunidades, (4) próximos passos colaborativos, (5) encerramento de apoio.
Pontos fortes informados pelo gestor: ${pontos_fortes || "—"}
Pontos a melhorar informados pelo gestor: ${pontos_melhorar || "—"}`;
    } else if (tipo === "cobranca") {
      const tomLabel = tom === "leve" ? "LEVE (lembrete cordial)" : tom === "medio" ? "MÉDIO (alinhamento firme, sem dureza)" : "FORTE (cobrança formal, ainda respeitosa)";
      instruction = `Gere um TEXTO DE ALINHAMENTO/COBRANÇA em tom ${tomLabel} para o colaborador "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
Fato ocorrido (descrição do gestor): ${fato_ocorrido || "—"}
Estrutura: (1) contextualização objetiva do fato, (2) impacto para a equipe/cliente, (3) comportamento esperado daqui em diante, (4) oferta de apoio do gestor, (5) combinado de acompanhamento.`;
    } else if (tipo === "alinhamento") {
      instruction = `Gere um DOCUMENTO DE ALINHAMENTO formal para registro, com tom ${tom || "medio"}, dirigido a "${employee_name}"${employee_role ? ` (cargo: ${employee_role})` : ""}.
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
    return new Response(JSON.stringify({ texto }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});