import { consultarMediador, resolverCodigoIbge, type MediadorInstrumento } from '../_shared/mediador.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEDIADOR_URL = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo';

// Palavras-chave úteis do nome do sindicato para a busca por razão social no Mediador.
const nucleoNome = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['SINDICATO', 'SINDICATOS', 'DOS', 'DAS', 'DES', 'PARA', 'REGIAO', 'ESTADO'].includes(w))
    .slice(0, 3)
    .join(' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { sindicato, cnpj, municipio, uf } = await req.json();
    if (!sindicato && !cnpj) return json({ error: 'Informe o sindicato ou o CNPJ.' }, 400);
    if (!uf) return json({ error: 'Informe a UF.' }, 400);

    const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
    const mun = municipio ? await resolverCodigoIbge(String(municipio), String(uf)) : null;

    const tentativas: { rotulo: string; params: Parameters<typeof consultarMediador>[0] }[] = [];
    if (cnpjDigits.length === 14) {
      tentativas.push({ rotulo: 'CNPJ + município', params: { uf, cnpj: cnpjDigits, codigoIbge: mun?.codigo } });
      tentativas.push({ rotulo: 'CNPJ (UF)', params: { uf, cnpj: cnpjDigits } });
    }
    const nucleo = nucleoNome(String(sindicato || ''));
    if (nucleo) {
      tentativas.push({ rotulo: 'Razão social + município', params: { uf, razaoSocial: nucleo, codigoIbge: mun?.codigo } });
      tentativas.push({ rotulo: 'Razão social (UF)', params: { uf, razaoSocial: nucleo } });
    }

    let instrumentos: MediadorInstrumento[] = [];
    let estrategia = '';
    const erros: string[] = [];
    for (const t of tentativas) {
      try {
        const r = await consultarMediador(t.params);
        if (r.instrumentos.length) {
          instrumentos = r.instrumentos;
          estrategia = t.rotulo;
          break;
        }
      } catch (e) {
        erros.push(`${t.rotulo}: ${String(e)}`);
      }
    }

    // Prioriza CCT vigente mais recente
    const ordem = (i: MediadorInstrumento) => (i.vigente ? 0 : 1) * 10 + (/conven/i.test(i.tipo) ? 0 : 1);
    instrumentos.sort((a, b) => ordem(a) - ordem(b) || (b.vigencia_fim || '').localeCompare(a.vigencia_fim || ''));

    return json({
      instrumentos: instrumentos.slice(0, 20).map((i) => ({
        titulo: `${i.tipo} ${i.numero_registro || i.numero_solicitacao}`,
        tipo: i.tipo,
        numero_registro: i.numero_registro,
        numero_solicitacao: i.numero_solicitacao,
        vigencia: i.vigencia,
        vigente: i.vigente,
        partes: i.partes,
        url: i.url_visualizar,
        url_download: i.url_download,
        is_pdf: false,
        fonte: 'Sistema Mediador (MTE)',
      })),
      total: instrumentos.length,
      estrategia,
      municipio_ibge: mun?.codigo || null,
      observacoes: instrumentos.length
        ? `Consulta direta no Sistema Mediador (${estrategia}). O download abre o documento oficial registrado.`
        : `Nenhum instrumento localizado no Mediador para os filtros informados.${erros.length ? ` (${erros.join(' | ')})` : ''}`,
      mediador_url: MEDIADOR_URL,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
