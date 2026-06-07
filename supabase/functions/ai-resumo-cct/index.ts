import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  text: z.string().optional(),
  pdf_base64: z.string().optional(),
}).refine((b) => (b.text && b.text.trim().length >= 120) || (b.pdf_base64 && b.pdf_base64.length > 1000), {
  message: "Envie texto extraído (>=120 chars) ou pdf_base64 do arquivo.",
});

const looksLikeCct = (text: string) => {
  const normalized = text.toLowerCase();
  const requiredSignals = [
    /conven[cç][aã]o coletiva/,
    /acordo coletivo/,
    /cct\b/,
    /sindicato/,
  ];
  const laborSignals = [
    /data[-\s]?base/,
    /vig[eê]ncia/,
    /cl[áa]usula/,
    /piso salarial/,
    /categoria profissional/,
  ];
  return requiredSignals.some((r) => r.test(normalized)) && laborSignals.some((r) => r.test(normalized));
};

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) return jsonResponse({ error: body.error.flatten().fieldErrors }, 400);
    const { text, pdf_base64 } = body.data;
    const useVision = !text || text.trim().length < 120 || !looksLikeCct(text);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    if (useVision && !pdf_base64) {
      return jsonResponse({
        error: "O texto extraído não parece ser uma CCT/ACT válida. Reenvie informando o PDF para OCR.",
      }, 422);
    }

    const compactText = (text || "").replace(/\s+/g, " ").trim();
    const truncated = compactText.slice(0, 90000);
    const promptCore = `Você é especialista em direito do trabalho brasileiro e está auditando uma CCT/ACT.

REGRAS OBRIGATÓRIAS:
1. Use EXCLUSIVAMENTE o conteúdo do documento fornecido (texto ou PDF anexo). Não use conhecimento externo, exemplos ou dados prováveis.
2. Se uma informação não estiver literalmente no documento, retorne string vazia para o campo.
3. Não invente sindicato, datas, pisos, benefícios, percentuais ou locais.
4. Cada cláusula extraída deve conter um trecho_base curto copiado do documento que justifique a descrição.
5. Se o documento não contiver CCT/ACT ou o texto estiver ilegível, retorne extraction_ok=false e explique em extraction_notes.
6. O resumo deve mencionar apenas fatos encontrados no texto.

Retorne JSON estruturado com:
- extraction_ok: boolean
- extraction_notes: string
- sindicato: nome do sindicato laboral, somente se explícito
- union_base: base territorial/categoria, somente se explícita
- uf: sigla, somente se explícita
- data_base: mês/data-base, somente se explícita
- validity_start: AAAA-MM-DD, somente se explícita
- validity_end: AAAA-MM-DD, somente se explícita
- summary: resumo objetivo em pt-BR baseado apenas no documento
- clauses: array de {titulo, descricao, trecho_base} com pisos salariais, adicionais, HE, intervalos, benefícios, contribuições e multas encontrados.`;

    const userContent: any[] = [{ type: "text", text: promptCore }];
    if (useVision && pdf_base64) {
      userContent.push({ type: "text", text: "Extraia via OCR o conteúdo do PDF anexo." });
      userContent.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf_base64}` } });
    } else {
      userContent.push({ type: "text", text: `<documento>\n${truncated}\n</documento>` });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [{ role: "user", content: userContent }],
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
                extraction_ok: { type: "boolean" },
                extraction_notes: { type: "string" },
                summary: { type: "string" },
                clauses: { type: "array", items: { type: "object", properties: { titulo: { type: "string" }, descricao: { type: "string" }, trecho_base: { type: "string" } }, required: ["titulo", "descricao", "trecho_base"] } },
              },
              required: ["extraction_ok", "extraction_notes", "summary", "clauses"]
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
    if (parsed.extraction_ok === false) {
      return jsonResponse({ error: parsed.extraction_notes || "A IA não conseguiu validar o conteúdo como CCT/ACT." }, 422);
    }
    const meaningfulClauses = Array.isArray(parsed.clauses)
      ? parsed.clauses.filter((cl: { trecho_base?: string }) => cl.trecho_base && cl.trecho_base.trim().length >= 12)
      : [];
    if (!parsed.summary || meaningfulClauses.length === 0) {
      return jsonResponse({ error: "A IA não encontrou cláusulas comprovadas no texto extraído da CCT." }, 422);
    }
    return jsonResponse({ ...parsed, clauses: meaningfulClauses });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});