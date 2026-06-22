import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { nome, cbo, entrevista } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const prompt = `Com base no texto de entrevista fornecido e considerando o cargo "${nome}" (CBO: ${cbo || "n/i"}), reescreva de forma técnica e formal:
1. Descrição sumária do cargo (máximo 5 linhas, linguagem formal de RH).
2. Lista de atividades desenvolvidas (mínimo 8 itens, verbo no infinitivo + complemento).
3. Requisitos mínimos sugeridos: escolaridade, experiência e competências.

ENTREVISTA:
"""
${entrevista || ""}
"""

Retorne SOMENTE JSON: {"descricao_sumaria":"...","atividades":["..."],"requisitos":{"escolaridade":"...","experiencia":"...","competencias":["..."]}}`;
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