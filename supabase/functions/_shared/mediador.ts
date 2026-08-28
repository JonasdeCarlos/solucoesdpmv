// Cliente direto do Sistema Mediador (MTE) — consulta avançada por base territorial (município).
// O Mediador guarda o município selecionado num buffer de sessão no servidor; por isso é
// necessário executar a sequência: página inicial -> UF -> marcar município -> gravar buffer -> consultar.

const BASE = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo';

export type MediadorInstrumento = {
  numero_registro: string;
  numero_solicitacao: string;
  tipo: string;
  vigencia: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  vigente: boolean;
  partes: string[];
  cnpj_registro?: string;
  url_visualizar: string;
  url_download: string;
};

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function resolverCodigoIbge(municipio: string, uf: string): Promise<{ codigo: string; nome: string } | null> {
  try {
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const lista = (await r.json()) as { id: number; nome: string }[];
    const alvo = norm(municipio);
    const hit = lista.find((m) => norm(m.nome) === alvo) || lista.find((m) => norm(m.nome).includes(alvo));
    return hit ? { codigo: String(hit.id), nome: hit.nome } : null;
  } catch (_e) {
    return null;
  }
}

type Cookies = Record<string, string>;

const guardarCookies = (jar: Cookies, res: Response) => {
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase() !== 'set-cookie') continue;
    for (const part of v.split(/,(?=[^;]+?=)/)) {
      const [nome, valor] = part.split(';')[0].split('=');
      if (nome && valor !== undefined) jar[nome.trim()] = valor.trim();
    }
  }
};

const cookieHeader = (jar: Cookies) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

async function req(jar: Cookies, path: string, body?: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE,
      Cookie: cookieHeader(jar),
      ...(body === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  guardarCookies(jar, res);
  if (!res.ok) throw new Error(`Mediador ${path} => ${res.status}`);
  return await res.text();
}

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' | ')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, d) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s*\|\s*(\|\s*)+/g, ' | ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

const pega = (txt: string, re: RegExp) => txt.match(re)?.[1]?.replace(/\s*\|\s*/g, ' ').trim() || '';

const paraData = (br: string) => {
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`) : null;
};

export function parseInstrumentos(html: string): { total: number; instrumentos: MediadorInstrumento[] } {
  const totalTxt = stripTags(html).match(/Resultado:\s*(\d+)/);
  const total = totalTxt ? Number(totalTxt[1]) : 0;
  const blocos = html.split(/<tr\s+indice="/i).slice(1);
  const hoje = new Date();
  const instrumentos: MediadorInstrumento[] = [];

  for (const bruto of blocos) {
    const solicitacao = bruto.slice(0, bruto.indexOf('"'));
    const txt = stripTags(bruto);
    const registro = pega(txt, /N[ºo°]\s*do Registro\s*\|?\s*([A-Z]{2}\d+\/\d{4})/i);
    const tipo = pega(txt, /Tipo do Instrumento\s*\|\s*([^|]+)\|/i);
    const vigIni = pega(txt, /Vig[êe]ncia\s*\|\s*(\d{2}\/\d{2}\/\d{4})/i);
    const vigFim = pega(txt, /Vig[êe]ncia\s*\|\s*\d{2}\/\d{2}\/\d{4}\s*\|?\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
    const partesHtml = bruto.match(/class="textoConsulta2"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || '';
    const partes = partesHtml
      .split(/<br\s*\/?>/i)
      .map((p) => stripTags(p).replace(/\s*\|\s*/g, ' ').trim())
      .filter((p) => p.length > 4);
    const fim = paraData(vigFim);
    instrumentos.push({
      numero_registro: registro,
      numero_solicitacao: solicitacao,
      tipo: tipo || '—',
      vigencia: vigIni && vigFim ? `${vigIni} - ${vigFim}` : vigIni || '',
      vigencia_inicio: vigIni || undefined,
      vigencia_fim: vigFim || undefined,
      vigente: fim ? fim >= hoje : true,
      partes,
      cnpj_registro: bruto.match(/fDownload\('[^']+','(\d{14})'\)/)?.[1] || '',
      url_visualizar: `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar?NrSolicitacao=${encodeURIComponent(solicitacao)}`,
      url_download: `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/resumoVisualizarSalvarMsWordDoc?NrSolicitacao=${encodeURIComponent(solicitacao)}`,
    });
  }
  return { total, instrumentos };
}

export type ConsultaMediador = {
  uf: string;
  codigoIbge?: string;
  categoria?: string;
  razaoSocial?: string;
  cnpj?: string;
  apenasVigentes?: boolean;
  pagina?: number;
  /** Filtra pelo tipo do instrumento, conforme o portal do MTE (ex.: 'Convenção Coletiva de Trabalho'). */
  tipos?: string[];
};

/** Tipos de instrumento disponíveis no Sistema Mediador. */
export const TIPOS_INSTRUMENTO = [
  'Convenção Coletiva de Trabalho',
  'Acordo Coletivo de Trabalho',
  'Termo Aditivo a Convenção Coletiva de Trabalho',
  'Termo Aditivo a Acordo Coletivo de Trabalho',
] as const;

const chaveTipo = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function filtrarPorTipo(instrumentos: MediadorInstrumento[], tipos?: string[]) {
  const alvos = (tipos || []).map(chaveTipo).filter(Boolean);
  if (!alvos.length) return instrumentos;
  return instrumentos.filter((i) => {
    const t = chaveTipo(i.tipo || '');
    return alvos.some((a) => t === a || t.startsWith(a) || a.startsWith(t));
  });
}

export async function consultarMediador(p: ConsultaMediador): Promise<{ total: number; instrumentos: MediadorInstrumento[] }> {
  const jar: Cookies = {};
  await req(jar, '');

  const municipal = !!p.codigoIbge;
  const baseSel = municipal ? 'Municipal, ' : '';
  if (municipal) {
    await req(jar, '/getPartMunicipiosPelaUF', `UF=${p.uf}&BaseSelecionada=${encodeURIComponent(baseSel)}`);
    await req(
      jar,
      '/getPartMunicipiosMunicipioMarcado',
      `marcar=true&cdMunicipio=${p.codigoIbge}&BaseSelecionada=${encodeURIComponent(baseSel)}`,
    );
    await req(jar, '/getPartAbrangenciaGravarBufferDaUFAtiva', '');
  }

  const body = new URLSearchParams();
  if (p.cnpj) body.set('nrCnpj', p.cnpj);
  if (p.razaoSocial) body.set('noRazaoSocial', p.razaoSocial);
  if (p.categoria) body.set('dsCategoria', p.categoria);
  body.set('tpVigencia', p.apenasVigentes === false ? '' : '1');
  if (municipal) {
    body.set('dsTipoAbrangencia', baseSel);
    body.set('ufsAbrangidasTotalmente', p.uf);
  } else {
    body.set('sgUfDeRegistro', p.uf);
  }
  body.set('excel', 'false');
  body.set('pagina', String(p.pagina || 1));
  body.set('qtdTotalRegistro', '-1');

  const html = await req(jar, '/getConsultaAvancada', body.toString());
  const r = parseInstrumentos(html);
  const instrumentos = filtrarPorTipo(r.instrumentos, p.tipos);
  return { total: p.tipos?.length ? instrumentos.length : r.total, instrumentos };
}
