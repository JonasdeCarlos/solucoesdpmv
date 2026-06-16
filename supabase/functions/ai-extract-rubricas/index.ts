import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  pdf_base64: z.string().min(1000),
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) return json({ error: parsedBody.error.flatten().fieldErrors }, 400);
    const { pdf_base64 } = parsedBody.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Você é especialista em folha de pagamento brasileira. Localize no PDF anexo a seção "Resumo por Rubrica" (geralmente no fim do documento — Extrato Mensal).

REGRAS:
1. Extraia EXCLUSIVAMENTE as linhas da seção "Resumo por Rubrica". Ignore os extratos individuais por empregado.
2. Cada linha tem: código numérico, nome da rubrica, referência (quantidade/horas/%), valor em R$, e um sufixo "P" (Provento) ou "D" (Desconto). Algumas podem ser informativas (sem P/D explícito; classifique como "informativa").
3. Os totais ficam em duas colunas (esquerda e direita) — extraia AMBAS as colunas como rubricas separadas.
4. NÃO invente. Se a seção não existir, retorne extraction_ok=false.
5. Mantenha o nome exato como aparece (pode estar truncado, ok).
6. valor deve ser número decimal (ex.: 1626.25). Use ponto como separador decimal.
7. Não inclua a linha "51 LIQUIDO RESCISAO" como rubrica útil — marque kind="informativa".
`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf_base64}` } },
          ],
        }],
        tools: [{
          type: "function",
          function: {
            name: "save_rubricas",
            description: "Salvar rubricas extraídas do Resumo por Rubrica",
            parameters: {
              type: "object",
              properties: {
                extraction_ok: { type: "boolean" },
                extraction_notes: { type: "string" },
                competencia: { type: "string", description: "MM/AAAA se identificada" },
                empresa: { type: "string" },
                rubricas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      name: { type: "string" },
                      kind: { type: "string", enum: ["provento", "desconto", "informativa"] },
                      referencia: { type: "string" },
                      valor: { type: "number" },
                    },
                    required: ["code", "name", "kind", "valor"],
                  },
                },
              },
              required: ["extraction_ok", "rubricas"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_rubricas" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: "ai gateway error", detail: t }, resp.status);
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};
    if (parsed.extraction_ok === false) {
      return json({ error: parsed.extraction_notes || "Seção 'Resumo por Rubrica' não encontrada." }, 422);
    }
    if (!Array.isArray(parsed.rubricas) || parsed.rubricas.length === 0) {
      return json({ error: "Nenhuma rubrica encontrada no documento." }, 422);
    }
    return json(parsed);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});