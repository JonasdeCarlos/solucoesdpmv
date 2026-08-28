const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Hit = { title: string; url: string; snippet: string };

async function jinaDdg(query: string, limit: number): Promise<Hit[]> {
  const target = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await fetch(`https://r.jina.ai/${target}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MediadorCCT/1.0)', 'X-Return-Format': 'markdown' },
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
    const snippet = m[3].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 500);
    out.push({ url, title: m[1].trim(), snippet });
  }
  return out;
}

async function ddgHtml(query: string, limit: number): Promise<Hit[]> {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
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
  for (const engine of [jinaDdg, ddgHtml, bing]) {
    try {
      const hits = await engine(query, limit);
      if (hits.length) return hits;
    } catch (e) {
      console.log('engine falhou', engine.name, String(e));
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { sindicato, cnpj, municipio, uf } = await req.json();
    if (!sindicato) return json({ error: 'Informe o sindicato.' }, 400);
    const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
    const ano = new Date().getFullYear();

    const queries = [
      `mediador MTE convenção coletiva "${sindicato}" ${ano}`,
      `"${sindicato}" convenção coletiva ${ano} ${municipio || ''} ${uf || ''} pdf`,
      cnpjDigits
        ? `mediador convenção coletiva CNPJ ${cnpjDigits} ${uf || ''}`
        : `"${sindicato}" convenção coletiva ${ano - 1}/${ano} registro MR mediador`,
    ];

    const results: Hit[] = [];
    for (const q of queries) {
      results.push(...(await search(q, 8)));
      await new Promise((r) => setTimeout(r, 700));
    }
    const seen = new Set<string>();
    const hits = results.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true))).slice(0, 24);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY ausente.' }, 500);

    const system = `Você identifica a CCT/ACT VIGENTE registrada no Sistema Mediador (MTE) de um sindicato.
Use APENAS as evidências fornecidas. Nunca invente URL, número de registro (MR) ou vigência.
Priorize documentos do mte.gov.br/mediador e PDFs oficiais do sindicato. Ordene do mais recente para o mais antigo.
Se não houver evidência confiável, retorne lista vazia e explique em observacoes.
Responda em pt-BR.`;

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
            content: `Sindicato: ${sindicato}\nCNPJ: ${cnpjDigits || '(não informado)'}\nBase: ${municipio || ''}/${uf || ''}\nAno atual: ${ano}\n\n<resultados_busca>\n${hits
              .map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.snippet}`)
              .join('\n\n')}\n</resultados_busca>`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'responder_instrumentos',
            description: 'Instrumentos coletivos localizados',
            parameters: {
              type: 'object',
              properties: {
                observacoes: { type: 'string' },
                instrumentos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      titulo: { type: 'string' },
                      tipo: { type: 'string' },
                      numero_registro: { type: 'string' },
                      vigencia: { type: 'string' },
                      vigente: { type: 'boolean' },
                      url: { type: 'string' },
                      is_pdf: { type: 'boolean' },
                      fonte: { type: 'string' },
                    },
                    required: ['titulo', 'url'],
                  },
                },
              },
              required: ['instrumentos'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'responder_instrumentos' } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return json({ error: 'Limite de requisições da IA atingido.' }, 429);
      if (resp.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
      return json({ error: 'Falha na IA', detail: await resp.text() }, 500);
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { instrumentos: [] };
    return json({
      ...parsed,
      fontes_consultadas: hits.length,
      mediador_url: 'http://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
