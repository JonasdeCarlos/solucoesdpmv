const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Hit = { title: string; url: string; snippet: string };

async function ddg(query: string, limit = 10): Promise<Hit[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnquadramentoCCT/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    while ((m = re.exec(html)) && out.length < limit) {
      const url = decodeURIComponent((m[1].match(/uddg=([^&]+)/)?.[1]) || m[1]);
      out.push({ url, title: strip(m[2]), snippet: strip(m[3]).slice(0, 500) });
    }
    return out;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { municipio, uf, cnae, atividade } = await req.json();
    if (!municipio || !uf) return json({ error: 'Informe município e UF.' }, 400);

    const base = `${atividade || ''} ${cnae || ''} ${municipio} ${uf}`.trim();
    const queries = [
      `sindicato patronal ${base}`,
      `sindicato dos trabalhadores ${base}`,
      `sindicato ${cnae || atividade || ''} ${uf} CNPJ site oficial`,
      `convenção coletiva ${base} sindicato`,
    ];
    const results = (await Promise.all(queries.map((q) => ddg(q, 8)))).flat();
    const seen = new Set<string>();
    const hits = results.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true))).slice(0, 28);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY ausente.' }, 500);

    const system = `Você é especialista em enquadramento sindical brasileiro (CLT art. 511, categoria econômica x profissional).
Com base na atividade/CNAE e no município/UF, classifique a categoria e selecione, APENAS entre os resultados de busca fornecidos, os sindicatos patronais (categoria econômica) e laborais (categoria profissional) mais prováveis para a base territorial.
Regras: nunca invente CNPJ nem site; se não constar nas evidências, deixe vazio. Confiança: alta somente se nome + base territorial + categoria batem claramente. Sempre traga a URL da fonte usada. Máximo 5 candidatos por lista. Responda em pt-BR.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Município: ${municipio}\nUF: ${uf}\nCNAE: ${cnae || '(não informado)'}\nAtividade: ${atividade || '(não informada)'}\n\n<resultados_busca>\n${hits
              .map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.snippet}`)
              .join('\n\n')}\n</resultados_busca>`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'responder_enquadramento',
            description: 'Classificação e candidatos a sindicatos',
            parameters: {
              type: 'object',
              properties: {
                categoria_termos: { type: 'array', items: { type: 'string' } },
                observacoes: { type: 'string' },
                patronais: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nome: { type: 'string' },
                      cnpj: { type: 'string' },
                      site: { type: 'string' },
                      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
                      fonte_url: { type: 'string' },
                      justificativa: { type: 'string' },
                    },
                    required: ['nome', 'confianca', 'fonte_url'],
                  },
                },
                laborais: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nome: { type: 'string' },
                      cnpj: { type: 'string' },
                      site: { type: 'string' },
                      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
                      fonte_url: { type: 'string' },
                      justificativa: { type: 'string' },
                    },
                    required: ['nome', 'confianca', 'fonte_url'],
                  },
                },
              },
              required: ['categoria_termos', 'patronais', 'laborais'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'responder_enquadramento' } },
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      if (resp.status === 429) return json({ error: 'Limite de requisições da IA atingido. Tente novamente em instantes.' }, 429);
      if (resp.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
      return json({ error: 'Falha na IA', detail }, 500);
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { categoria_termos: [], patronais: [], laborais: [] };
    return json({ ...parsed, fontes_consultadas: hits.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
