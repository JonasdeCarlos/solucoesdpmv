import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cbo, nome } = await req.json();
    const code = String(cbo || "").replace(/\D/g, "");
    if (!code) throw new Error("Informe o código CBO.");
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Você é um especialista em CBO (Classificação Brasileira de Ocupações) do MTE/MTb. Liste as ÁREAS DE ATIVIDADE oficiais da família ocupacional CBO ${code}${nome ? ` (cargo informado: ${nome})` : ""}, EXATAMENTE como aparecem no site oficial do MTE (cbo.mte.gov.br → "Áreas de Atividade") — organizadas em GACs (Grandes Áreas de Competência) identificadas por letra (A, B, C, D, ...), cada uma com seu título (ex.: "CRIAR PRATOS", "ELABORAR CARDÁPIO") e as atividades específicas (verbo no infinitivo + complemento) que aparecem ao expandir o "+" daquele tópico.

Regras:
- Use APENAS conteúdo oficial do CBO/MTE; NÃO invente.
- Mantenha as letras de ordem (A, B, C...) e os títulos dos GACs em CAIXA ALTA, idênticos ao site.
- Para cada GAC, liste TODAS as atividades expandidas.
- Se o código não existir, retorne areas_de_atividade vazio e explique em "observacao".

Retorne SOMENTE JSON neste formato:
{
  "cbo": "${code}",
  "titulo_oficial": "...",
  "descricao_sumaria": "...",
  "areas_de_atividade": [
    { "ordem": "A", "titulo": "CRIAR PRATOS", "atividades": ["criar receitas", "..."] },
    { "ordem": "B", "titulo": "ELABORAR CARDÁPIO", "atividades": ["..."] }
  ],
  "observacao": ""
}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições à IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});