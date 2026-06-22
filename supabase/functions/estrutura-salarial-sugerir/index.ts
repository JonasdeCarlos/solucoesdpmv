import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cargos, empresa } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const prompt = `Para a empresa "${empresa || ""}", com base nos cargos listados, sugira uma estrutura salarial com:
1. Agrupamento em faixas salariais (mínimo 4 faixas).
2. Para cada faixa: nome, cargos que a compõem, salário mínimo, ponto médio e salário máximo sugeridos (em BRL, valores numéricos).
3. Escala de evolução (5 etapas: Inicial, Em desenvolvimento, Pleno, Sênior, Referência) com percentuais de incremento base.

CARGOS:
${JSON.stringify(cargos, null, 2)}

Retorne JSON: {"faixas":[{"nome":"...","cargos":["..."],"min":0,"mid":0,"max":0}],"escala_evolucao":[{"etapa":"...","percentual_base":0,"descricao":"..."}]}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});