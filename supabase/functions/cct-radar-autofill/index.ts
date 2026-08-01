import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extrairCnpjs(texto: string): string[] {
  const re = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
  const out: string[] = [];
  for (const m of texto.match(re) || []) {
    const d = m.replace(/\D/g, '');
    if (d.length !== 14) continue;
    const cnpj = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
    if (!out.includes(cnpj)) out.push(cnpj);
  }
  return out;
}

const HOSTS_IGNORADOS = [
  'gov.br', 'planalto', 'jusbrasil', 'facebook', 'instagram', 'youtube', 'wikipedia',
  'linkedin', 'twitter', 'x.com', 'google', 'duckduckgo', 'bing', 'w3.org', 'adobe.com',
  'whatsapp', 'gstatic', 'schema.org', 'blogspot.com', 'wa.me',
];

function hostValido(u: string): boolean {
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (!host.includes('.')) return false;
    return !HOSTS_IGNORADOS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

function extrairUrls(texto: string): string[] {
  const matches = (texto.match(/https?:\/\/[^\s<>"'\)\]\}]+/gi) || []).map((u) => u.replace(/[.,;]+$/, ''));
  return Array.from(new Set(matches)).filter(hostValido);
}

const EMAILS_GENERICOS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'live.com', 'icloud.com',
];

function extrairDominiosDeEmail(texto: string): string[] {
  const re = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const dom = m[1].toLowerCase().replace(/[.,;]+$/, '');
    if (EMAILS_GENERICOS.includes(dom)) continue;
    const url = `https://${dom}`;
    if (hostValido(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

function normalizarNome(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const RE_SINDICAL = /sind|sinttel|feder|fetr|contrac|trabalhador|hotei|comerc|sinttel|sinpro/;

function candidatosDeHtml(html: string): string[] {
  const urls: string[] = [];
  const push = (u: string) => {
    if (!hostValido(u)) return;
    try {
      const base = `https://${new URL(u).hostname.toLowerCase()}`;
      if (!urls.includes(base)) urls.push(base);
    } catch { /* ignora */ }
  };
  let m: RegExpExecArray | null;
  const reUddg = /uddg=([^"&]+)/g;
  while ((m = reUddg.exec(html)) !== null) push(decodeURIComponent(m[1]));
  const reHref = /href="(https?:\/\/[^"]+)"/g;
  while ((m = reHref.exec(html)) !== null) push(m[1]);
  return urls;
}

async function buscarEm(url: string, init?: RequestInit): Promise<string[]> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', ...(init?.headers || {}) },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    return candidatosDeHtml(await res.text());
  } catch {
    return [];
  }
}

/** Busca o site oficial do sindicato em vários buscadores públicos (sem chave de API). */
async function buscarSiteOficial(nome: string, uf?: string | null): Promise<string | null> {
  const query = `${nome} ${uf || ''} sindicato site oficial`.replace(/\s+/g, ' ').trim();
  const q = encodeURIComponent(query);
  const fontes: Array<() => Promise<string[]>> = [
    () => buscarEm(`https://lite.duckduckgo.com/lite/?q=${q}`),
    () => buscarEm(`https://html.duckduckgo.com/html/?q=${q}`),
    () => buscarEm(`https://www.bing.com/search?q=${q}&setlang=pt-br`),
    () => buscarEm(`https://search.marcia.cc/search?q=${q}`),
  ];

  let primeiro: string | null = null;
  for (const fonte of fontes) {
    const candidatos = await fonte();
    for (const base of candidatos) {
      const host = base.replace('https://', '');
      if (!primeiro) primeiro = base;
      if (RE_SINDICAL.test(host)) return base;
    }
  }
  if (primeiro) return primeiro;
  // Buscadores costumam bloquear o runtime das edge functions: usa a IA e valida o domínio.
  return await sugerirSitePorIa(nome, uf);
}

/** Confirma que o domínio existe e realmente pertence ao sindicato indicado. */
async function validarSite(url: string, nome: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const texto = normalizarNome(await res.text()).toLowerCase();
    const palavras = normalizarNome(nome)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 4 && !['sindicato', 'estado', 'empregados', 'trabalhadores', 'federacao'].includes(p));
    const acertos = palavras.filter((p) => texto.includes(p)).length;
    return /sindicato|federacao|convencao coletiva/.test(texto) && acertos >= Math.min(2, palavras.length);
  } catch {
    return false;
  }
}

/** Pede à IA candidatos de site oficial e valida cada um antes de aceitar. */
async function sugerirSitePorIa(nome: string, uf?: string | null): Promise<string | null> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Você conhece sindicatos brasileiros. Responda APENAS com um JSON no formato {"dominios":["exemplo.com.br"]} com até 3 domínios prováveis do site oficial. Sem texto extra. Se não souber, retorne {"dominios":[]}.',
          },
          { role: 'user', content: `Site oficial do sindicato: ${nome}${uf ? ` (UF ${uf})` : ''}` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? '';
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) return null;
    const dominios: string[] = JSON.parse(match[0])?.dominios ?? [];
    for (const d of dominios.slice(0, 3)) {
      const url = `https://${String(d).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()}`;
      if (!hostValido(url)) continue;
      if (await validarSite(url, nome)) return url;
    }
  } catch { /* ignora */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const somenteId: string | null = body?.client_cct_id ?? null;
    const sobrescrever: boolean = body?.sobrescrever === true;

    let q = admin
      .from('client_ccts')
      .select(
        'id, sindicato, union_base, uf, numero_registro_mte, sindicato_laboral_nome, sindicato_laboral_cnpj, sindicato_laboral_endereco, sindicato_patronal_nome, sindicato_patronal_cnpj, sindicato_patronal_endereco, cct_analysis_id, radar_site_oficial, radar_cnpjs, radar_termos, radar_mediador_registro, radar_enabled',
      )
      .is('deleted_at', null);
    if (somenteId) q = q.eq('id', somenteId);
    const { data: ccts, error } = await q;
    if (error) throw error;

    const detalhes: any[] = [];
    let atualizados = 0;
    const ano = new Date().getFullYear();

    for (const c of (ccts || []) as any[]) {
      // 1) Análise vinculada (por id direto ou pelo vínculo reverso)
      let analise: any = null;
      if (c.cct_analysis_id) {
        const { data } = await admin
          .from('cct_analyses')
          .select('ai_summary, identification, unions, ocr_text')
          .eq('id', c.cct_analysis_id)
          .maybeSingle();
        analise = data;
      }
      if (!analise) {
        const { data } = await admin
          .from('cct_analyses')
          .select('ai_summary, identification, unions, ocr_text')
          .eq('client_cct_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        analise = data;
      }

      const textos: string[] = [];
      if (analise?.ai_summary) textos.push(String(analise.ai_summary));
      if (analise?.identification) textos.push(JSON.stringify(analise.identification));
      if (analise?.unions) textos.push(JSON.stringify(analise.unions));
      if (analise?.ocr_text) textos.push(String(analise.ocr_text).slice(0, 300000));
      if (c.sindicato_laboral_endereco) textos.push(String(c.sindicato_laboral_endereco));
      if (c.sindicato_patronal_endereco) textos.push(String(c.sindicato_patronal_endereco));
      const texto = textos.join('\n');

      // 2) CNPJs: colunas já cadastradas + encontrados no documento
      const cnpjsBase = [c.sindicato_laboral_cnpj, c.sindicato_patronal_cnpj]
        .filter(Boolean)
        .map((v: string) => String(v).trim());
      const cnpjs = Array.from(
        new Set([...(sobrescrever ? [] : c.radar_cnpjs || []), ...cnpjsBase, ...extrairCnpjs(texto)]),
      );

      // 3) Site oficial: cadastrado > URL no documento > domínio de e-mail > busca web
      let siteOficial: string | null = sobrescrever ? null : c.radar_site_oficial || null;
      if (!siteOficial) siteOficial = extrairUrls(texto)[0] || null;
      if (!siteOficial) siteOficial = extrairDominiosDeEmail(texto)[0] || null;
      const nomeLaboral = normalizarNome(c.sindicato_laboral_nome || c.sindicato || '');
      const nomePatronal = normalizarNome(c.sindicato_patronal_nome || '');
      if (!siteOficial && nomeLaboral) siteOficial = await buscarSiteOficial(nomeLaboral, c.uf);
      if (!siteOficial && nomePatronal) siteOficial = await buscarSiteOficial(nomePatronal, c.uf);

      // 4) Registro no Mediador
      const mediador = (sobrescrever ? null : c.radar_mediador_registro) || c.numero_registro_mte || null;

      // 5) Termos de busca
      const termosPadrao: string[] = [];
      for (const nome of [nomeLaboral, nomePatronal].filter(Boolean)) {
        termosPadrao.push(`"${nome}" convenção coletiva ${ano} ${c.uf || ''} vigência`.replace(/\s+/g, ' ').trim());
        termosPadrao.push(`"${nome}" termo aditivo convenção coletiva ${ano}`);
      }
      for (const cnpj of cnpjsBase) termosPadrao.push(`"${cnpj}" convenção coletiva ${ano}`);
      if (mediador) termosPadrao.push(`"${mediador}" mediador convenção coletiva`);
      if (c.union_base) {
        termosPadrao.push(`${c.union_base} convenção coletiva ${ano} ${c.uf || ''}`.replace(/\s+/g, ' ').trim());
      }

      const termosExistentes: string[] = sobrescrever
        ? []
        : Array.isArray(c.radar_termos)
          ? c.radar_termos
          : [];
      const termos = Array.from(new Set([...termosPadrao, ...termosExistentes]))
        .map((t) => String(t).trim())
        .filter((t) => t.length > 3);

      const { error: updErr } = await admin
        .from('client_ccts')
        .update({
          radar_site_oficial: siteOficial,
          radar_cnpjs: cnpjs,
          radar_termos: termos,
          radar_mediador_registro: mediador,
          radar_enabled: c.radar_enabled !== false,
        })
        .eq('id', c.id);

      if (!updErr) {
        atualizados++;
        detalhes.push({
          id: c.id,
          sindicato: c.sindicato,
          site_oficial: siteOficial,
          cnpjs: cnpjs.length,
          termos: termos.length,
          mediador,
          usou_analise: !!analise,
        });
      }
    }

    const semSite = detalhes.filter((d) => !d.site_oficial).length;

    return new Response(JSON.stringify({ ok: true, atualizados, sem_site: semSite, detalhes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});