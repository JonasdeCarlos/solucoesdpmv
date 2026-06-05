import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const truncated = text.slice(0, 60000);
    const prompt = `Você é especialista em direito do trabalho. Analise o texto da CCT/ACT abaixo e extraia em JSON estruturado:
- sindicato (nome do sindicato laboral)
- union_base (base territorial/categoria)
- uf (sigla)
- data_base (mês ou data-base, ex.: "Janeiro")
- validity_start (AAAA-MM-DD)
- validity_end (AAAA-MM-DD)
- summary (resumo de 5 a 10 linhas, em pt-BR)
- clauses (array de {titulo, descricao}) com pisos salariais, adicionais, HE, intervalos, benefícios, contribuições e multas.

Texto:\n${truncated}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "save_cct",
            description: "Salvar dados extraídos da CCT",
            parameters: {
              type: "object",
              properties: {
                sindicato: { type: "string" },
                union_base: { type: "string" },
                uf: { type: "string" },
                data_base: { type: "string" },
                validity_start: { type: "string" },
                validity_end: { type: "string" },
                summary: { type: "string" },
                clauses: { type: "array", items: { type: "object", properties: { titulo: { type: "string" }, descricao: { type: "string" } }, required: ["titulo", "descricao"] } },
              },
              required: ["summary", "clauses"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_cct" } }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "ai gateway error", detail: t }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});