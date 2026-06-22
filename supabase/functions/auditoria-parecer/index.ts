import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { empresa, resumo, itens, acoes, tipo } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const escopo = tipo === "final"
      ? "Gere um PARECER FINAL técnico (3-5 parágrafos) com principais achados, riscos críticos e recomendações estratégicas."
      : "Gere um RESUMO DIAGNÓSTICO narrativo (2-3 parágrafos) do panorama da auditoria.";
    const prompt = `Empresa: ${empresa}.
Resumo quantitativo: ${JSON.stringify(resumo)}.
Itens (resumido): ${JSON.stringify((itens||[]).slice(0,80))}.
Ações (resumido): ${JSON.stringify((acoes||[]).slice(0,50))}.

${escopo}
Retorne JSON: {"texto":"..."}`;
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