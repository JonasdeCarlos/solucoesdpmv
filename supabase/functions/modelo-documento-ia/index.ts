import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    const b = await req.json().catch(() => ({}));
    const espacos = Array.isArray(b?.espacos) ? b.espacos.slice(0, 120) : [];
    const disponiveis = Array.isArray(b?.campos_disponiveis) ? b.campos_disponiveis.slice(0, 60) : [];
    if (!espacos.length) return json({ mapa: [] });
    const chaves = new Set(disponiveis.map((c: any) => String(c.key)));

    const prompt = `Você recebe um modelo de documento de RH (${String(b?.tipo || "documento").slice(0, 40)}) com espaços em branco para preencher.
Para cada espaço, escolha qual dado deve ser escrito nele, usando SOMENTE uma das chaves abaixo, ou "" se nenhuma servir (ex.: linha de assinatura).

Chaves disponíveis:
${disponiveis.map((c: any) => `- ${c.key}: ${c.label}`).join("\n")}

Espaços (o marcador [___] indica o espaço dentro da linha; "antes" é a linha anterior):
${espacos.map((e: any) => `#${Number(e.i)} | linha: ${String(e.contexto || "").slice(0, 220)} | antes: ${String(e.antes || "").slice(0, 160)}`).join("\n")}

Responda apenas com JSON no formato {"mapa":[{"i":0,"campo":"nome"}]} com um item para cada espaço. Sem markdown.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: "Você mapeia campos de formulários brasileiros de RH. Responde só JSON." },
          { role: "user", content: prompt },
        ],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });
    if (!r.ok || !r.body) {
      const txt = await r.text().catch(() => "");
      if (r.status === 429) return json({ error: "Limite de requisições de IA atingido. Tente novamente em instantes." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: txt || `Falha na IA (${r.status})` }, r.status);
    }

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        } catch { /* ignore */ }
      }
    }
    const m = out.match(/\{[\s\S]*\}/);
    let mapa: any[] = [];
    try { mapa = JSON.parse(m ? m[0] : out)?.mapa || []; } catch { mapa = []; }
    mapa = mapa
      .filter((x: any) => Number.isFinite(Number(x?.i)))
      .map((x: any) => ({ i: Number(x.i), campo: chaves.has(String(x.campo)) ? String(x.campo) : "" }));
    return json({ mapa });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
