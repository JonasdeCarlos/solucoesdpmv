import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `Você recebe uma tabela/planilha/relatório de lançamentos de folha de pagamento enviada por uma empresa brasileira (pode ser foto, scan ou PDF; o formato varia).
Extraia TODOS os lançamentos no formato "uma linha por lançamento":
- codigo: código do funcionário se existir na tabela (só dígitos), senão ""
- nome: nome do funcionário como aparece
- evento: nome do evento/coluna (ex.: "Hora extra 50%", "Faltas", "Comissão", "Adiantamento") exatamente como no cabeçalho
- valor: o valor como aparece (ex.: "350,00", "12:30", "2")
Regras: ignore totais, subtotais e células vazias ou zeradas. Não invente dados. Se a tabela tiver uma coluna por evento, gere uma linha para cada célula preenchida.
Responda SOMENTE JSON: {"lancamentos":[{"codigo":"","nome":"","evento":"","valor":""}]}`;

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
          blocks.push({ type: "text", text: PROMPT });
          const ar = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model, max_tokens: 16000, temperature: 0, messages: [{ role: "user", content: blocks }] }),
          });
          if (ar.ok) raw = ((await ar.json())?.content || []).map((c: any) => c?.text || "").join("");
          else console.error("anthropic", ar.status, (await ar.text()).slice(0, 300));
        }
      } catch (e) { console.error("anthropic ex", e); }
    }
    if (!raw) {
      const KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!KEY) throw new Error("LOVABLE_API_KEY missing");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, ...parts.map((m) => ({ type: "image_url", image_url: { url: m[0] } }))] }],
        }),
      });
      if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente em instantes." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      const d = await r.json();
      if (!r.ok) return json({ error: d?.error?.message || "Falha na leitura" }, 500);
      raw = d?.choices?.[0]?.message?.content || "";
    }
    const txt = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }
    const lancamentos = (parsed.lancamentos || []).map((l: any) => ({
      codigo: String(l?.codigo ?? "").replace(/\D/g, ""),
      nome: String(l?.nome ?? "").trim(),
      evento: String(l?.evento ?? "").trim(),
      valor: String(l?.valor ?? "").trim(),
    })).filter((l: any) => (l.nome || l.codigo) && l.evento && l.valor);
    return json({ lancamentos });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
