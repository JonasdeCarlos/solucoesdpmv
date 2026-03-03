import type { SeroObra, SeroParametro, SeroVauVal, SeroDeducao, SeroRetencao, SeroResultado } from '@/types/sero';

function getParam(params: SeroParametro[], chave: string, fallback: number): number {
  const p = params.find(x => x.chave === chave);
  return p ? Number(p.valor) : fallback;
}

export function calcularSero(
  obra: SeroObra,
  vauVal: SeroVauVal | null,
  params: SeroParametro[],
  deducoes: SeroDeducao[],
  retencoes: SeroRetencao[]
): SeroResultado {
  const areaTotal = Number(obra.area_principal) + Number(obra.area_complementar);

  if (!vauVal || areaTotal <= 0) {
    return emptyResult(areaTotal);
  }

  const valorM2 = Number(vauVal.valor_m2);
  const custoTotalObra = areaTotal * valorM2;

  // Percentual de MO por técnica
  const pctMoKey = `pct_mo_${obra.tecnica_construtiva}`;
  const pctMO = getParam(params, pctMoKey, 0.40);

  // Redutor por categoria
  let redutor = 1.0;
  if (obra.categoria !== 'obra_nova') {
    const redutorKey = `redutor_${obra.categoria}`;
    redutor = getParam(params, redutorKey, 1.0);
  }

  // Remuneração de MO estimada
  let remuneracaoMO = custoTotalObra * pctMO * redutor;

  // Deduções
  const deducoesTotal = deducoes.reduce((sum, d) => sum + Number(d.valor), 0);
  const remuneracaoLiquida = Math.max(0, remuneracaoMO - deducoesTotal);

  // Alíquotas
  const aliqPatronal = getParam(params, 'aliquota_patronal', 0.20);
  const aliqRat = getParam(params, 'aliquota_rat', 0.03);
  const aliqTerceiros = getParam(params, 'aliquota_terceiros', 0.058);

  const inssPatronal = remuneracaoLiquida * aliqPatronal;
  const inssRat = remuneracaoLiquida * aliqRat;
  const inssTerceiros = remuneracaoLiquida * aliqTerceiros;
  const inssDevido = inssPatronal + inssRat + inssTerceiros;

  // Cobertura: folha vinculada + retenções
  const rateioFator = Number(obra.rateio_valor) / 100;
  const inssFolha = (Number(obra.folha_total_projetada) + Number(obra.encargos_projetados)) * rateioFator;
  const inssRetencoes = retencoes.reduce((sum, r) => sum + Number(r.retencao_valor), 0);
  const inssCoberto = inssFolha + inssRetencoes;
  const saldoFinal = inssDevido - inssCoberto;
  const inssM2 = areaTotal > 0 ? inssDevido / areaTotal : 0;

  return {
    custoTotalObra,
    remuneracaoMO,
    deducoesTotal,
    remuneracaoLiquida,
    inssPatronal,
    inssRat,
    inssTerceiros,
    inssDevido,
    inssFolha,
    inssRetencoes,
    inssCoberto,
    saldoFinal,
    inssM2,
    areaTotal,
  };
}

function emptyResult(areaTotal: number): SeroResultado {
  return {
    custoTotalObra: 0, remuneracaoMO: 0, deducoesTotal: 0, remuneracaoLiquida: 0,
    inssPatronal: 0, inssRat: 0, inssTerceiros: 0, inssDevido: 0,
    inssFolha: 0, inssRetencoes: 0, inssCoberto: 0, saldoFinal: 0,
    inssM2: 0, areaTotal,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
