import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    const b = await req.json().catch(() => ({}));
    const dados = JSON.stringify(b?.dados || {}).slice(0, 20000);
    const prompt = `Você é consultor de RH de um escritório contábil. Explique ao CLIENTE (empresário, linguagem simples, pt-BR) por que o setor abaixo precisa do número de pessoas indicado em cada dia, a partir do horário de funcionamento, da intensidade do movimento e da jornada do novo marco legal (redução para 42h/40h, escala 5x2).
Use só os números fornecidos, não invente. Estrutura: 1 parágrafo de visão geral; depois uma linha por dia que tenha aumento (alto/pico) ou falta de pessoas, dizendo o motivo; por fim 2 ou 3 recomendações práticas (contratação parcial, deslocar folgas para dias de menor movimento, banco de horas dentro da lei). Máximo 220 palavras, sem markdown de títulos.

Dados: ${dados}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: MODEL, input: [{ role: "user", content: prompt }], store: false, reasoning: { effort: "low" } }),
    });
    if (!r.ok) {
      if (r.status === 429) return json({ error: "Limite de requisições de IA atingido. Tente novamente em instantes." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: `Falha na IA (${r.status})` }, r.status);
    }
    const d = await r.json();
    const texto = d.output_text || (d.output || []).flatMap((o: any) => o.content || []).map((c: any) => c.text || "").join("").trim();
    return json({ texto });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
