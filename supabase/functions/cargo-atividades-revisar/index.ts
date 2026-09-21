import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome || "").trim();
    const cbo = String(body?.cbo || "").trim();
    const area = String(body?.area || "").trim();
    const nivel = String(body?.nivel || "").trim();
    const empresa = String(body?.empresa || "").trim();
    const setor = String(body?.setor || "").trim();
    const descricao = String(body?.descricao_sumaria || "").trim();
    const pontos = String(body?.pontos_obrigatorios || "").trim();
    const atividades: string[] = Array.isArray(body?.atividades)
      ? body.atividades.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];

    if (!nome) return json({ error: "Informe o nome do cargo." }, 400);
    if (!atividades.length) return json({ error: "Traga primeiro as atividades do CBO/MTE." }, 400);
    if (!setor) return json({ error: "Informe a atividade que a empresa exerce para revisar por ramo." }, 400);

    const prompt = `Você é especialista em descrição de cargos (RH/DP) no Brasil.
Empresa: ${empresa || "n/i"}. Atividade/ramo de atuação da empresa: ${setor}.
Cargo: "${nome}"${cbo ? ` (CBO ${cbo})` : ""}${area ? ` — área ${area}` : ""}${nivel ? ` — nível ${nivel}` : ""}.
${descricao ? `Descrição sumária:\n"""${descricao}"""\n` : ""}${pontos ? `Pontos obrigatórios informados pelo gestor:\n"""${pontos}"""\n` : ""}
Lista bruta de atividades extraída da tabela CBO/MTE (contém atividades genéricas da família ocupacional, válidas para outros ramos):
${atividades.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Tarefa: REVISAR essa lista deixando apenas o que se aplica ao ramo real da empresa.
Regras:
1. Remova atividades típicas de outros segmentos (ex.: para recepcionista de hotel, remova atividades hospitalares/clínicas/consultório).
2. Adapte a redação das que ficarem ao vocabulário do ramo da empresa (mantendo o sentido técnico do CBO).
3. Mantenha os títulos de tópico em MAIÚSCULAS quando existirem, descartando tópicos que ficaram vazios.
4. Pode acrescentar até 4 atividades próprias do ramo que faltarem, coerentes com o cargo.
5. Cada atividade começa com verbo no infinitivo. Sem markdown, sem numeração.

Responda SOMENTE JSON: {"atividades":["..."],"removidas":["..."],"resumo":"uma frase"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!r.ok) return json({ error: "A IA não conseguiu revisar as atividades agora." }, r.status);

    const d = await r.json();
    const raw = (d?.choices?.[0]?.message?.content || "{}").replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const out = Array.isArray(parsed?.atividades)
      ? parsed.atividades.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];
    if (!out.length) return json({ error: "Não foi possível revisar as atividades." }, 500);
    const removidas = Array.isArray(parsed?.removidas)
      ? parsed.removidas.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];
    return json({ atividades: out, removidas, resumo: String(parsed?.resumo || "").trim() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
