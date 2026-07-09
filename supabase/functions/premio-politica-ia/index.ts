import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import mammoth from "npm:mammoth@1.8.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

type FileIn = { name: string; mime: string; data_base64: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const { verba_label, contexto, files } = body || {};
    const verba = String(verba_label || "Prêmio").trim();
    const filesArr: FileIn[] = Array.isArray(files) ? files : [];

    // Extrair textos localmente (docx/pdf) e enviar imagens direto ao modelo
    let extraText = "";
    const imageBlocks: any[] = [];
    for (const f of filesArr) {
      const mime = (f.mime || "").toLowerCase();
      try {
        const bin = Uint8Array.from(atob(f.data_base64), (c) => c.charCodeAt(0));
        if (mime.includes("word") || mime.includes("officedocument.wordprocessingml") || /\.docx$/i.test(f.name || "")) {
          const res = await mammoth.extractRawText({ buffer: bin });
          extraText += `\n\n---- ${f.name} ----\n${(res.value || "").slice(0, 30000)}`;
        } else if (mime === "application/pdf" || /\.pdf$/i.test(f.name || "")) {
          const pdf = await getDocumentProxy(bin);
          const t = await extractText(pdf, { mergePages: true });
          const txt = Array.isArray(t.text) ? t.text.join("\n") : String(t.text || "");
          extraText += `\n\n---- ${f.name} ----\n${txt.slice(0, 30000)}`;
        } else if (mime.startsWith("image/")) {
          imageBlocks.push({ type: "image_url", image_url: { url: `data:${mime};base64,${f.data_base64}` } });
        } else {
          // Tenta como texto puro
          extraText += `\n\n---- ${f.name} ----\n${new TextDecoder().decode(bin).slice(0, 20000)}`;
        }
      } catch (e) {
        extraText += `\n\n---- ${f.name} (erro ao extrair: ${e instanceof Error ? e.message : String(e)}) ----`;
      }
    }

    const prompt = `Você é especialista em remuneração variável no Brasil.
Analise os documentos anexos (regulamentos, minutas, políticas, planilhas ou fotos) e produza uma POLÍTICA COMPLETA de ${verba} com faixas de remuneração variável e critérios individuais.

Contexto adicional informado pelo usuário:
${contexto || "(nenhum)"}

Conteúdo extraído dos documentos anexos:
${extraText || "(sem texto extraído)"}

REGRAS DE SAÍDA — retorne APENAS JSON válido, sem markdown, no seguinte formato:
{
  "nome": "nome sugerido da política (curto)",
  "objetivo": "1-3 frases explicando o objetivo",
  "periodo_tipo": "mensal|quinzenal|bimestral|trimestral|semestral|anual",
  "valor_base": 0,
  "remuneracao_variavel": true,
  "rv_base": "faturamento|faturamento_liquido|lucro|meta_vendas|outro",
  "rv_base_label": "descrição textual da base (obrigatório se rv_base=outro)",
  "rv_tiers": [
    {"ate": 100000, "percentual": 5},
    {"ate": 300000, "percentual": 7},
    {"ate": null, "percentual": 10}
  ],
  "rv_pct_individual": 60,
  "rv_pct_igualitario": 40,
  "rv_observacoes": "regras adicionais, tetos, exclusões",
  "criterios": [
    {"nome": "Pontualidade", "descricao": "...", "peso": 3, "essencial": false}
  ]
}

Observações OBRIGATÓRIAS:
- Números sempre em formato numérico bruto (sem R$, sem separador de milhar).
- rv_pct_individual + rv_pct_igualitario deve ser <= 100.
- Gere de 4 a 8 critérios objetivos (pontualidade, assiduidade, qualidade, produtividade, atendimento, segurança, conformidade etc.).
- Nunca use critérios discriminatórios.
- Se os documentos NÃO trouxerem faixas explícitas, INFIRA faixas razoáveis para o segmento identificado.`;

    const userContent: any[] = [{ type: "text", text: prompt }, ...imageBlocks];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido, sem markdown, sem comentários." },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!r.ok) {
      const t = await r.text();
      return json({ error: `Falha IA (${r.status}): ${t.slice(0, 500)}` }, 500);
    }
    const d = await r.json();
    const raw = d?.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }

    // sanitize
    const politica = {
      nome: String(parsed.nome || "").slice(0, 120),
      objetivo: String(parsed.objetivo || "").slice(0, 1000),
      periodo_tipo: ["mensal","quinzenal","bimestral","trimestral","semestral","anual"].includes(parsed.periodo_tipo) ? parsed.periodo_tipo : "mensal",
      valor_base: Number(parsed.valor_base || 0),
      remuneracao_variavel: parsed.remuneracao_variavel !== false,
      rv_base: ["faturamento","faturamento_liquido","lucro","meta_vendas","outro"].includes(parsed.rv_base) ? parsed.rv_base : "faturamento",
      rv_base_label: parsed.rv_base_label ? String(parsed.rv_base_label).slice(0, 200) : null,
      rv_tiers: Array.isArray(parsed.rv_tiers) ? parsed.rv_tiers.map((t: any) => ({
        ate: t?.ate === null || t?.ate === undefined || t?.ate === "" ? null : Number(t.ate),
        percentual: Math.min(Math.max(Number(t?.percentual || 0), 0), 100),
      })) : [],
      rv_pct_individual: Math.min(Math.max(Number(parsed.rv_pct_individual || 60), 0), 100),
      rv_pct_igualitario: Math.min(Math.max(Number(parsed.rv_pct_igualitario || 40), 0), 100),
      rv_observacoes: parsed.rv_observacoes ? String(parsed.rv_observacoes).slice(0, 2000) : null,
      criterios: Array.isArray(parsed.criterios) ? parsed.criterios.map((c: any) => ({
        nome: String(c.nome || "").slice(0, 100),
        descricao: String(c.descricao || "").slice(0, 500),
        peso: Math.min(Math.max(Number(c.peso || 1), 1), 5),
        essencial: !!c.essencial,
      })).filter((c: any) => c.nome) : [],
    };

    return json({ politica });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}