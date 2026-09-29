import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
// mammoth/xlsx são carregados só quando necessários (evita estourar memória no boot)

type FileIn = { name: string; mime: string; data_base64: string };
const METRICAS = ["faturamento_direto", "realizado_meta", "realizado_meta_inverso", "percentual", "nota_generica", "sim_nao"];
const PERIODOS = ["mensal", "quinzenal", "bimestral", "trimestral", "semestral", "anual"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "Chave de IA não configurada." }, 500);
    const body = await req.json().catch(() => ({}));
    const descricao = String(body?.descricao || "").slice(0, 20000);
    const ajustes = String(body?.ajustes || "").slice(0, 5000);
    const anterior = body?.anterior ? JSON.stringify(body.anterior).slice(0, 20000) : "";
    const atividade = String(body?.atividade || "").slice(0, 500);
    const verba = String(body?.verba_label || "Prêmio").slice(0, 60);
    const files: FileIn[] = Array.isArray(body?.files) ? body.files.slice(0, 6) : [];
    if (!descricao.trim() && files.length === 0) return json({ error: "Descreva a política ou anexe arquivos." }, 400);
    const totalB64 = files.reduce((s, f) => s + String(f?.data_base64 || "").length, 0);
    if (totalB64 > 11_000_000) return json({ error: "Os anexos somam mais de 8 MB. Envie arquivos menores ou menos arquivos." }, 400);

    let extra = "";
    const media: any[] = [];
    for (const f of files) {
      const mime = String(f.mime || "").toLowerCase();
      const name = String(f.name || "arquivo");
      try {
        if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
          media.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${f.data_base64}` });
        } else if (mime.startsWith("image/")) {
          media.push({ type: "input_image", image_url: `data:${mime};base64,${f.data_base64}` });
        } else {
          const bin = decodeBase64(f.data_base64);
          f.data_base64 = "";
          let txt = "";
          if (/\.docx$/i.test(name) || mime.includes("wordprocessingml")) {
            const mammoth = (await import("npm:mammoth@1.8.0")).default;
            txt = (await mammoth.extractRawText({ arrayBuffer: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) })).value || "";
          } else if (/\.(xlsx|xls|csv)$/i.test(name) || mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) {
            if (/\.csv$/i.test(name) || mime.includes("csv")) {
              txt = new TextDecoder().decode(bin);
            } else {
              const XLSX = await import("npm:xlsx@0.18.5");
              const wb = XLSX.read(bin, { type: "array", dense: true });
              txt = wb.SheetNames.slice(0, 5).map((s: string) => `# ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`).join("\n\n");
            }
          } else {
            txt = new TextDecoder().decode(bin);
          }
          extra += `\n\n---- ${name} ----\n${txt.slice(0, 30000)}`;
        }
      } catch (e) {
        extra += `\n\n---- ${name} (não foi possível ler: ${e instanceof Error ? e.message : String(e)}) ----`;
      }
    }

    const prompt = `Você é especialista brasileiro em remuneração variável (prêmios, art. 457 §2º e §4º CLT).
Monte uma política de ${verba} NOVA e COMPLETA, pronta para um sistema de apuração, a partir da explicação do usuário e dos arquivos.

Atividade da empresa: ${atividade || "(não informada)"}
Explicação do usuário:
${descricao || "(nenhuma)"}
${anterior ? `\nVersão anterior gerada (ajuste-a):\n${anterior}\nAjustes pedidos:\n${ajustes || "(nenhum)"}` : ""}
Texto extraído dos anexos:${extra || " (ver arquivos anexos)"}

MODELO DO SISTEMA:
- Existe uma "base de cálculo" em R$ (ex.: faturamento, vendas, lucro). Cada indicador coletivo tem um peso_pct (% da base) e 4 faixas: piso, meta_0, meta_1, meta_2. Cada faixa tem "pct" (% aplicado sobre a parte da base daquele indicador) e "alvo" (piso tem alvo null).
- Tipos de métrica: "faturamento_direto" (alvo = faturamento/dia em R$), "realizado_meta" (valor realizado, maior é melhor), "realizado_meta_inverso" (menor é melhor: perdas, faltas, reclamações — alvo de meta_2 é o MENOR), "percentual" (0-100), "nota_generica" (nota média; informe escala_max), "sim_nao" (atingiu = meta_2, não = piso).
- split_coletivo + split_individual = 100. A parte individual é avaliada por critérios comportamentais com escala (Excelente 100 / Muito Bom 75 / Bom 50 / Regular 25 / Insatisfatório 0).
- rateio: "pontos" (proporcional a pontos por colaborador) ou "igualitario".

Retorne APENAS JSON:
{"nome":"","objetivo":"","regra_premiacao":"","periodo_tipo":"mensal","base_label":"Faturamento total (R$)","split_coletivo":80,"split_individual":20,"individual_pct_distribuicao":1,"rateio":"pontos",
"indicadores":[{"nome":"","descricao":"","metrica":"realizado_meta","unidade":"R$|%|un|nota","escala_max":null,"peso_pct":10,"faixas":[{"nivel":"piso","pct":1,"alvo":null},{"nivel":"meta_0","pct":1.5,"alvo":0},{"nivel":"meta_1","pct":2,"alvo":0},{"nivel":"meta_2","pct":2.5,"alvo":0}]}],
"criterios_individuais":[{"nome":"","descricao":"como avaliar, comportamentos observáveis","peso":5}],
"observacoes":"premissas assumidas e pontos que o usuário deve confirmar"}
Regras: números sem R$ e sem separador de milhar; 2 a 6 indicadores; 3 a 6 critérios individuais; sem critérios discriminatórios; respeite fielmente o que o usuário descreveu; infira valores razoáveis quando faltar informação e explique em observacoes.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: [
          { role: "system", content: "Responda somente com JSON válido, sem markdown." },
          { role: "user", content: [{ type: "input_text", text: prompt }, ...media] },
        ],
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
      }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      const msg = r.status === 429 ? "Muitas solicitações à IA. Aguarde um pouco e tente de novo."
        : r.status === 402 ? "Créditos de IA esgotados. Adicione créditos no workspace."
        : `Falha na IA (${r.status}): ${t.slice(0, 300)}`;
      return json({ error: msg }, r.status >= 400 && r.status < 600 ? r.status : 500);
    }

    // Consome SSE e acumula o texto final
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", streamErr = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta || "";
          else if (ev.type === "error" || ev.type === "response.failed") streamErr = ev.error?.message || ev.response?.error?.message || "erro na IA";
        } catch { /* ignore */ }
      }
    }
    if (!text.trim()) return json({ error: streamErr || "A IA não retornou conteúdo." }, 502);
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    let p: any;
    try { p = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)); }
    catch { return json({ error: "Resposta da IA em formato inválido. Tente novamente." }, 502); }

    const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const splitCol = Math.min(Math.max(num(p.split_coletivo, 80), 0), 100);
    const indicadores = (Array.isArray(p.indicadores) ? p.indicadores : []).slice(0, 10).map((c: any, idx: number) => {
      const faixas = ["piso", "meta_0", "meta_1", "meta_2"].map((n) => {
        const f = (Array.isArray(c.faixas) ? c.faixas : []).find((x: any) => x?.nivel === n) || {};
        return { nivel: n, pct: Math.max(0, num(f.pct, 0)), alvo: n === "piso" ? null : num(f.alvo, 0) };
      });
      return {
        id: `ind_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        nome: String(c.nome || `Indicador ${idx + 1}`).slice(0, 100),
        descricao: String(c.descricao || "").slice(0, 600),
        metrica: METRICAS.includes(c.metrica) ? c.metrica : "realizado_meta",
        unidade: c.unidade ? String(c.unidade).slice(0, 12) : null,
        escala_max: c.escala_max ? num(c.escala_max) : null,
        canal: null,
        peso_pct: Math.max(0, num(c.peso_pct, 10)),
        faixas,
      };
    });
    return json({
      politica: {
        nome: String(p.nome || "").slice(0, 120),
        objetivo: String(p.objetivo || "").slice(0, 1500),
        regra_premiacao: String(p.regra_premiacao || "").slice(0, 3000),
        periodo_tipo: PERIODOS.includes(p.periodo_tipo) ? p.periodo_tipo : "mensal",
        base_label: String(p.base_label || "Base de cálculo (R$)").slice(0, 80),
        split_coletivo: splitCol,
        split_individual: 100 - splitCol,
        individual_pct_distribuicao: Math.max(0, num(p.individual_pct_distribuicao, 1)),
        rateio: p.rateio === "igualitario" ? "igualitario" : "pontos",
        indicadores,
        criterios_individuais: (Array.isArray(p.criterios_individuais) ? p.criterios_individuais : []).slice(0, 10)
          .map((c: any) => ({ nome: String(c.nome || "").slice(0, 100), descricao: String(c.descricao || "").slice(0, 800), peso: Math.min(Math.max(num(c.peso, 1), 1), 100) }))
          .filter((c: any) => c.nome),
        observacoes: String(p.observacoes || "").slice(0, 2000),
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
