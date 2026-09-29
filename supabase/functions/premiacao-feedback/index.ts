import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    const b = await req.json().catch(() => ({}));

    const linhas = Array.isArray(b?.ocorrencias)
      ? b.ocorrencias.map((o: any) => `- ${o.tipo === "desabono" ? "Desabono" : "Medalha"} ${o.codigo || ""}: ${o.descricao || ""} (${o.pontos} pts)${o.observacao ? ` — obs: ${o.observacao}` : ""}`).join("\n")
      : "";
    const metas = Array.isArray(b?.metas)
      ? b.metas.map((m: any) => `- ${m.nome}: ${m.atingida ? "atingida" : "não atingida"} (${m.realizado ?? "—"}/${m.alvo}) ${m.pontos} pts`).join("\n")
      : "";

    const prompt = `Você é especialista em gestão de pessoas e feedback não-violento (CNV), no Brasil.
Escreva um feedback individual (6 a 10 frases, parágrafos corridos, pt-BR) sobre o desempenho no programa de premiação por pontos.

Dados:
- Empresa: ${b?.empresa || "—"}
- Colaborador: ${b?.colaborador || "—"} (função: ${b?.funcao || "—"})
- Competência: ${b?.competencia || "—"}
- Saldo inicial: ${b?.saldo_inicial ?? 0} pontos
- Pontos de medalhas: ${b?.pontos_medalhas ?? 0}
- Pontos de troféus (metas): ${b?.pontos_trofeus ?? 0}
- Pontos de desabonos: -${b?.pontos_desabonos ?? 0}
- Saldo do mês: ${b?.saldo_apurado ?? 0}
- Pontuação de referência (gatilho): ${b?.pontuacao_referencia ?? 0}
- Pontos premiados: ${b?.pontos_premiaveis ?? 0}
- Valor do prêmio: R$ ${Number(b?.valor_bonificacao || 0).toFixed(2)}
- Saldo transportado: ${b?.saldo_transportado ?? 0}
Ocorrências do mês:
${linhas || "- (sem ocorrências registradas)"}
Metas:
${metas || "- (sem metas)"}
Observação do gestor: ${b?.observacao || "—"}

Regras:
- Explique que a referência funciona como gatilho: ao ultrapassá-la, o colaborador recebe o prêmio sobre todos os pontos do mês.
- Reconheça de forma específica os destaques positivos citando serviços/medalhas.
- Se houver desabonos, trate com fatos, sem punição, ameaça, advertência ou demissão, e proponha 1 ou 2 combinados práticos.
- Se não atingiu a referência, use tom acolhedor e indique o caminho para o próximo mês.
- Não use markdown, títulos, listas ou emojis. Apenas o texto do feedback.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: "Você escreve feedback profissional, respeitoso e não-violento em português do Brasil, sem markdown." },
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

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", r.headers.get("Content-Type") ?? "text/event-stream");
    return new Response(r.body, { status: 200, headers });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
