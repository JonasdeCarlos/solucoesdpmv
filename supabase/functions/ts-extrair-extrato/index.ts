import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const pdf = typeof body?.pdf_base64 === "string" ? body.pdf_base64 : "";
    const empresaId = typeof body?.empresa_id === "string" ? body.empresa_id : null;
    if (!pdf || pdf.length > 25_000_000) return json({ error: "PDF ausente ou muito grande" }, 400);

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const model = "google/gemini-2.5-flash";
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Você extrai dados de extratos de folha de pagamento brasileiros (sistema Domínio e similares). Responda somente JSON." },
          {
            role: "user",
            content: [
              { type: "text", text: 'Extraia TODOS os empregados deste extrato. Para cada um: codigo (código do empregado, só dígitos), nome, rendimento_bruto (total de proventos/rendimento bruto, número com ponto decimal). Retorne {"funcionarios":[{"codigo":"95","nome":"FULANO","rendimento_bruto":1234.56}]}' },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf}` } },
            ],
          },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message || "Falha na IA" }, 500);
    let parsed: any = {};
    try { parsed = JSON.parse(d?.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }
    const lista = (Array.isArray(parsed) ? parsed : parsed.funcionarios || [])
      .map((f: any) => ({
        codigo: String(f.codigo ?? "").replace(/\D/g, ""),
        nome: String(f.nome ?? "").trim(),
        rendimento_bruto: Number(f.rendimento_bruto) || 0,
      }))
      .filter((f: any) => f.codigo);

    const us = d?.usage || {};
    const pt = Number(us.prompt_tokens || 0), ct = Number(us.completion_tokens || 0);
    try {
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await admin.from("ai_usage_log").insert({
        client_id: empresaId, function_name: "ts-extrair-extrato", model,
        prompt_tokens: pt, completion_tokens: ct, total_tokens: Number(us.total_tokens || pt + ct),
        credits_estimate: +((pt * 0.00003) + (ct * 0.00025)).toFixed(6), meta: { count: lista.length },
      });
    } catch (_) { /* noop */ }
    return json(lista);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
