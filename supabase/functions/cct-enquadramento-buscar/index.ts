const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Hit = { title: string; url: string; snippet: string };

async function jinaDdg(query: string, limit: number): Promise<Hit[]> {
  const target = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await fetch(`https://r.jina.ai/${target}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnquadramentoCCT/1.0)', 'X-Return-Format': 'markdown' },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`jina ${r.status}`);
  const md = await r.text();
  const out: Hit[] = [];
  const re = /^#{2,3}\s*\[([^\]]+)\]\(([^)]+)\)\s*([\s\S]*?)(?=^#{2,3}\s*\[|\Z)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) && out.length < limit) {
    const raw = m[2];
    const url = decodeURIComponent(raw.match(/uddg=([^&]+)/)?.[1] || raw);
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com/.test(url)) continue;
    const snippet = m[3]
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    out.push({ url, title: m[1].trim(), snippet });
  }
  return out;
}

async function ddgHtml(query: string, limit: number): Promise<Hit[]> {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`ddg ${r.status}`);
  const html = await r.text();
  const out: Hit[] = [];
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="result__a"|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const raw = m[1];
    const url = decodeURIComponent(raw.match(/uddg=([^&]+)/)?.[1] || raw);
    const snip = strip(m[3].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] || '').slice(0, 500);
    out.push({ url, title: strip(m[2]), snippet: snip });
  }
  return out;
}

async function ddgLite(query: string, limit: number): Promise<Hit[]> {
  const r = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`ddglite ${r.status}`);
  const html = await r.text();
  const out: Hit[] = [];
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  const re = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="result-link"|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const raw = m[1];
    const url = decodeURIComponent(raw.match(/uddg=([^&]+)/)?.[1] || raw);
    const snip = strip(m[3].match(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/)?.[1] || '').slice(0, 500);
    out.push({ url, title: strip(m[2]), snippet: snip });
  }
  return out;
}

async function bing(query: string, limit: number): Promise<Hit[]> {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-br&cc=BR`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`bing ${r.status}`);
  const html = await r.text();
  const out: Hit[] = [];
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  const re = /<li class="b_algo"[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    out.push({ url: m[1], title: strip(m[2]), snippet: strip(m[3] || '').slice(0, 500) });
  }
  return out;
}

async function search(query: string, limit = 8): Promise<Hit[]> {
  for (const engine of [jinaDdg, ddgHtml, ddgLite, bing]) {
    try {
      const hits = await engine(query, limit);
      if (hits.length) return hits;
    } catch (e) {
      console.log('search engine falhou', engine.name, String(e));
    }
  }
  return [];
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
    const results = (await Promise.all(queries.map((q) => search(q, 8)))).flat();
    const seen = new Set<string>();
    const hits = results.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true))).slice(0, 28);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY ausente.' }, 500);

    const system = `Você é especialista em enquadramento sindical brasileiro (CLT art. 511, categoria econômica x profissional).
Com base na atividade/CNAE e no município/UF, classifique a categoria e selecione, APENAS entre os resultados de busca fornecidos, os sindicatos patronais (categoria econômica) e laborais (categoria profissional) mais prováveis para a base territorial.
Regras: nunca invente CNPJ nem site; se não constar nas evidências, deixe vazio. Confiança: alta somente se nome + base territorial + categoria batem claramente. Sempre traga a URL da fonte usada. Máximo 5 candidatos por lista. Responda em pt-BR.`;

    const semEvidencias = hits.length === 0;
    const systemFinal = semEvidencias
      ? `${system}

ATENÇÃO: nenhuma evidência de busca foi obtida. Nesse caso, sugira os sindicatos mais prováveis com base no seu conhecimento da estrutura sindical brasileira (nome provável da entidade e base territorial), marcando SEMPRE confianca="baixa", cnpj e site vazios, fonte_url="http://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo" e deixando claro em observacoes que as buscas externas falharam e que tudo deve ser confirmado no CNES/Mediador.`
      : system;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          { role: 'system', content: systemFinal },
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
