import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface CctDoc { id: string; sindicato: string; text: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { question, docs } = await req.json() as { question: string; docs: CctDoc[] };
    if (!question || !Array.isArray(docs) || docs.length === 0) {
      return new Response(JSON.stringify({ error: "Envie pergunta e ao menos uma CCT." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const corpus = docs.map((d, i) => `<cct id="${d.id}" indice="${i + 1}" sindicato="${(d.sindicato || '').replace(/"/g, "'")}">\n${(d.text || '').slice(0, 120000)}\n</cct>`).join("\n\n");

    const system = `Você é auditor de CCT/ACT. O usuário fará uma pergunta temática (ex.: "plano de saúde").
REGRAS:
1. Interprete o tema de forma AMPLA e inclua sinônimos e correlatos. Ex.: "plano de saúde" cobre assistência médica, auxílio-saúde, convênio médico, plano odontológico, reembolso médico, saúde ocupacional (quando pago pelo empregador), custeio de mensalidade, coparticipação, dependentes.
2. Analise APENAS o texto das CCTs fornecidas. Não invente. Se nada for encontrado em uma CCT, marque regulamentado=false para ela.
3. Cada achado deve conter: cláusula/título (se identificável), trecho literal curto (máx. 400 chars) copiado da CCT, e uma explicação objetiva em 1-2 frases.
4. Ao final, produza um resumo consolidado em pt-BR.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Pergunta: ${question}\n\n<documentos>\n${corpus}\n</documentos>` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "responder_busca",
            description: "Retornar achados por CCT",
            parameters: {
              type: "object",
              properties: {
                resumo_geral: { type: "string" },
                resultados: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cct_id: { type: "string" },
                      sindicato: { type: "string" },
                      regulamentado: { type: "boolean" },
                      resumo: { type: "string" },
                      achados: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            titulo: { type: "string" },
                            trecho: { type: "string" },
                            explicacao: { type: "string" },
                          },
                          required: ["titulo", "trecho", "explicacao"],
                        },
                      },
                    },
                    required: ["cct_id", "sindicato", "regulamentado", "resumo", "achados"],
                  },
                },
              },
              required: ["resumo_geral", "resultados"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "responder_busca" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "ai gateway error", detail: t }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { resumo_geral: "", resultados: [] };
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});