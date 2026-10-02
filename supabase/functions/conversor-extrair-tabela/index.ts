import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();
const dist = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

const PROMPT = `Você recebe uma tabela/planilha/relatório de lançamentos de folha de pagamento enviada por uma empresa brasileira (pode ser foto, scan ou PDF; o formato varia).

PASSO 1 — LEIA O CABEÇALHO: liste em "colunas" TODOS os títulos de coluna, da esquerda para a direita, exatamente como escritos (inclusive títulos de duas linhas, juntando-os: "Total" + "Refeição" = "Total Refeição"). Não pule nenhuma coluna.
PASSO 2 — EXTRAIA: para cada funcionário (linha) e cada coluna de evento, gere um lançamento:
- codigo: código do funcionário se existir (só dígitos), senão ""
- nome: nome do funcionário como aparece
- evento: o título EXATO da coluna de onde o valor saiu (nunca troque por coluna vizinha nem por nome parecido)
- valor: o valor exatamente como impresso (ex.: "1.350,00", "12:30", "2")

REGRAS IMPORTANTES:
- Colunas cujo título começa com "Total" (ex.: "Total Refeição", "Total Transporte", "Total Recebido") SÃO eventos e devem ser extraídas, cada uma separadamente. "Total Refeição" ≠ "Total Recebido".
- Ignore apenas LINHAS de total/subtotal/soma geral no fim da tabela ou de grupos — nunca colunas.
- Ignore colunas de identificação (código, nome, CPF, cargo, setor, admissão, assinatura).
- Ignore células vazias, "-" ou zeradas.
- Siga cada linha horizontalmente com cuidado para não misturar valores de funcionários adjacentes; confira o alinhamento coluna a coluna.
- Leia dígitos com atenção (6/8, 1/7, 3/8, 5/6, 0/9); mantenha vírgula decimal e ponto de milhar como no documento. Não arredonde.
- Se houver uma coluna de total por linha, use-a para conferir: a soma dos componentes deve bater; se não bater, releia os valores.
- NOMES: copie cada nome letra por letra como está impresso. NUNCA invente, complete, corrija ou "adivinhe" um nome. Só gere lançamentos para linhas que realmente existem no documento. Se um nome estiver ilegível, use o que for legível e não crie variações. Cada funcionário aparece uma única vez por linha — não duplique linhas nem crie pessoas a partir de cabeçalhos, rodapés, assinaturas, nomes da empresa ou do responsável.
- Não invente dados.
Responda SOMENTE JSON: {"colunas":["..."],"lancamentos":[{"codigo":"","nome":"","evento":"","valor":""}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const arquivos: { dataUrl: string }[] = Array.isArray(body?.arquivos) ? body.arquivos.slice(0, 8) : [];
    const parts = arquivos.map((a) => String(a?.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/)).filter(Boolean) as RegExpMatchArray[];
    if (!parts.length) return json({ error: "Nenhum arquivo enviado" }, 400);
    if (parts.reduce((s, m) => s + m[2].length, 0) > 25_000_000) return json({ error: "Arquivos muito grandes" }, 400);

    const conhecidos: { nome: string; codigo: string }[] = Array.isArray(body?.conhecidos) ? body.conhecidos.slice(0, 600).map((x: any) => ({ nome: String(x?.nome || "").slice(0, 120), codigo: String(x?.codigo || "").replace(/\D/g, "").slice(0, 10) })).filter((x: any) => x.nome) : [];
    const PROMPT_FULL = PROMPT + (conhecidos.length ? `\n\nFuncionários já cadastrados desta empresa (use como referência de grafia; se o nome do documento corresponder claramente a um deles, use a grafia e o código cadastrados; se não corresponder, mantenha o nome como impresso — nunca troque por um cadastrado parecido sem certeza):\n${conhecidos.map((c) => `${c.codigo || "-"} | ${c.nome}`).join("\n")}` : "");
    let raw = "";
    const ANTH = Deno.env.get("ANTHROPIC_API_KEY");
    if (ANTH) {
      try {
        const lm = await fetch("https://api.anthropic.com/v1/models?limit=50", { headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01" } });
        const ids: string[] = lm.ok ? ((await lm.json())?.data || []).map((m: any) => String(m?.id || "")) : [];
        const model = ids.find((m) => m.includes("sonnet-4-5")) || ids.find((m) => m.includes("sonnet-4")) || ids.find((m) => m.includes("sonnet")) || ids[0];
        if (model) {
          const blocks: any[] = parts.map((m) => m[1] === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: m[2] } }
            : { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
          blocks.push({ type: "text", text: PROMPT_FULL });
          const ar = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model, max_tokens: 32000, temperature: 0, messages: [{ role: "user", content: blocks }] }),
          });
          if (ar.ok) raw = ((await ar.json())?.content || []).map((c: any) => c?.text || "").join("");
          else console.error("anthropic", ar.status, (await ar.text()).slice(0, 300));
        }
      } catch (e) { console.error("anthropic ex", e); }
    }
    if (!raw) {
      const KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!KEY) throw new Error("LOVABLE_API_KEY missing");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          store: false,
          reasoning: { effort: "high" },
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: PROMPT_FULL },
              ...parts.map((m, i) => m[1] === "application/pdf"
                ? { type: "input_file", filename: `arquivo${i + 1}.pdf`, file_data: m[0] }
                : { type: "input_image", image_url: m[0] }),
            ],
          }],
        }),
      });
      if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente em instantes." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      const d = await r.json();
      if (!r.ok) return json({ error: d?.error?.message || "Falha na leitura" }, 500);
      raw = d?.output_text || (d?.output || []).flatMap((o: any) => o?.content || []).map((c: any) => c?.text || "").join("");
    }
    const txt = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }
    const lancamentos = (parsed.lancamentos || []).map((l: any) => ({
      codigo: String(l?.codigo ?? "").replace(/\D/g, ""),
      nome: String(l?.nome ?? "").trim(),
      evento: String(l?.evento ?? "").trim(),
      valor: String(l?.valor ?? "").trim(),
    })).filter((l: any) => (l.nome || l.codigo) && l.evento && l.valor).map((l: any) => {
      if (!conhecidos.length) return l;
      const n = norm(l.nome);
      const byCod = l.codigo && conhecidos.find((c) => c.codigo === l.codigo);
      let best = byCod || conhecidos.find((c) => norm(c.nome) === n);
      if (!best) {
        let bd = 1;
        for (const c of conhecidos) { const d = dist(n, norm(c.nome)) / Math.max(n.length, 1); if (d < bd) { bd = d; best = c; } }
        if (bd > 0.15) best = undefined;
      }
      return best ? { ...l, nome: best.nome, codigo: l.codigo || best.codigo } : l;
    });
    return json({ lancamentos, colunas: Array.isArray(parsed.colunas) ? parsed.colunas.map(String) : [] });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
