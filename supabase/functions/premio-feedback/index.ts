import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const modo = (body?.modo || "criterio") as "criterio" | "geral";
    const verba = String(body?.verba_label || "Prêmio");
    const colaborador = String(body?.colaborador || "");
    const empresa = String(body?.empresa || "");
    const competencia = String(body?.competencia || "");

    let prompt = "";
    if (modo === "criterio") {
      const { criterio, descricao, percentual, observacao, meta } = body || {};
      prompt = `Você é especialista em feedback não-violento (CNV) e gestão de pessoas no Brasil.
Gere um feedback CURTO (3-5 frases) para o critério abaixo, em português brasileiro, tom respeitoso e construtivo:
- Empresa: ${empresa}
- Colaborador: ${colaborador}
- Período: ${competencia}
- Critério: ${criterio}
- Descrição/como apurar: ${descricao || "—"}
- Meta esperada: ${meta || "100%"}
- Atingimento informado: ${Number(percentual ?? 0).toFixed(0)}%
- Observação do gestor: ${observacao || "—"}

Regras:
- Se 100%: reconheça com elogio sincero e específico.
- Se entre 70% e 99%: reconheça o esforço e indique 1 ponto de melhoria concreto.
- Se abaixo de 70%: tom acolhedor, descrever o gap em fatos e sugerir 1 passo prático de melhoria.
- NÃO use punição, ameaça, demissão ou advertência.
- NÃO repita o nome do critério no início.
Responda APENAS o texto do feedback, sem títulos, sem markdown.`;
    } else {
      const { criterios, percentual_final, valor_premio, valor_base } = body || {};
      const lista = Array.isArray(criterios) ? criterios.map((c: any) =>
        `- ${c.nome}: ${Number(c.percentual ?? 0).toFixed(0)}%${c.observacao ? ` (obs: ${c.observacao})` : ""}`).join("\n") : "";
      prompt = `Você é especialista em feedback não-violento e remuneração variável.
Gere um feedback CONSOLIDADO (6-10 frases) para o colaborador sobre a apuração de ${verba}, em português brasileiro.
- Empresa: ${empresa}
- Colaborador: ${colaborador}
- Período: ${competencia}
- Valor base de ${verba}: R$ ${Number(valor_base || 0).toFixed(2)}
- Percentual final apurado: ${Number(percentual_final ?? 0).toFixed(0)}%
- Valor calculado de ${verba}: R$ ${Number(valor_premio || 0).toFixed(2)}
- Critérios avaliados:
${lista}

Estrutura obrigatória do texto (em parágrafos corridos, sem títulos):
1) Abertura cordial reconhecendo o período avaliado.
2) Destaque dos critérios com melhor desempenho (com nome).
3) Pontos de atenção / oportunidades de melhoria (com nome do critério).
4) Indicação do percentual final e do valor calculado de ${verba}.
5) Mensagem de incentivo:
   - Se 100% final: parabéns especiais.
   - Se >= 70%: reconhecer o esforço e estimular o próximo ciclo.
   - Se < 70%: tom acolhedor, propor combinados para o próximo período.

NÃO use punição, advertência, ameaças. Responda APENAS o texto, sem markdown.`;
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você escreve feedback profissional, não-violento, em pt-BR. Sem markdown, sem títulos." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    const d = await r.json();
    const texto = (d?.choices?.[0]?.message?.content || "").trim();
    return json({ texto });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}