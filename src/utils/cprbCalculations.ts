/**
 * Motor de cálculo comparativo CPRB x Folha
 * Conforme Lei 12.546/2011 e reoneração gradual Lei 14.973/2024
 */

export interface CprbLegalParam {
  aliquota_cprb: number;        // ex: 0.045
  percentual_cprb_transicao: number; // ex: 0.80
  percentual_folha_transicao: number; // ex: 0.05
  aliquota_patronal_folha: number;   // ex: 0.20
}

export interface CprbSimulationInput {
  competenciaInicial: string; // YYYY-MM
  horizonteMeses: number;
  receitaTotal: number;
  folhaTotal: number;
  decimoTerceiro: number;
  proLabore: number;
  percentualCrescimento: number; // ex: 0.02 = 2%/mês
  incluirFerias: boolean;
  incluirTercoFerias: boolean;
  incluirDecimoTerceiro: boolean;
  incluirFgts: boolean;
  incluirMultaFgts: boolean;
  percentualMultaFgts: number;
  incluirRatFap: boolean;
  aliquotaRatFap: number;
  incluirTerceiros: boolean;
  aliquotaTerceiros: number;
  percentualRotatividade: number;
  percentualAbsenteismo: number;
  areaM2Total: number;
  legalParams: CprbLegalParam[];  // um por mês (pode mudar se cruzar anos)
}

export interface CprbMonthResult {
  competencia: string;
  mesNumero: number;
  receitaMes: number;
  folhaMes: number;
  // Cenário A - CPRB
  cprbValor: number;           // CPRB sobre receita (com transição)
  contribFolhaTransicao: number; // contrib patronal sobre folha no cenário CPRB
  custoCenarioCprb: number;     // total cenário A
  // Cenário B - Folha
  contribPatronalFolha: number; // contrib patronal sobre folha (20%)
  custoCenarioFolha: number;    // total cenário B
  // Comparativo
  diferencaAbsoluta: number;
  diferencaPercentual: number;
  // Custo mão de obra
  custoMaoObraCprb: number;
  custoMaoObraFolha: number;
  custoM2Cprb: number;
  custoM2Folha: number;
}

export interface CprbConsolidatedResult {
  monthly: CprbMonthResult[];
  totalReceitaProjetada: number;
  totalFolhaProjetada: number;
  totalCustoCprb: number;
  totalCustoFolha: number;
  economiaCprb: number;
  economiaPercentual: number;
  indiceReceitaFolha: number;
  breakEvenRatio: number;
  vantajosidade: 'cprb' | 'folha' | 'empate';
  custoMaoObraTotalCprb: number;
  custoMaoObraTotalFolha: number;
  custoM2MedioCprb: number;
  custoM2MedioFolha: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Distribui um valor total em N meses com crescimento percentual
 */
export function distribuirMensal(
  total: number,
  meses: number,
  crescimentoMensal: number
): number[] {
  if (meses <= 0) return [];
  if (crescimentoMensal === 0) {
    const mensal = total / meses;
    return Array(meses).fill(round2(mensal));
  }
  // Calcula o fator base para que a soma dos meses = total
  // soma = base * (1 + (1+g) + (1+g)^2 + ... + (1+g)^(n-1))
  let somaFatores = 0;
  for (let i = 0; i < meses; i++) {
    somaFatores += Math.pow(1 + crescimentoMensal, i);
  }
  const base = total / somaFatores;
  return Array.from({ length: meses }, (_, i) =>
    round2(base * Math.pow(1 + crescimentoMensal, i))
  );
}

/**
 * Resolve o parâmetro legal para uma competência YYYY-MM
 */
export function getLegalParamForMonth(
  competencia: string,
  params: Array<{
    competencia_inicio: string;
    competencia_fim: string;
    aliquota_cprb: number;
    percentual_cprb_transicao: number;
    percentual_folha_transicao: number;
    aliquota_patronal_folha: number;
  }>
): CprbLegalParam {
  const found = params.find(
    (p) => competencia >= p.competencia_inicio && competencia <= p.competencia_fim
  );
  if (found) {
    return {
      aliquota_cprb: Number(found.aliquota_cprb),
      percentual_cprb_transicao: Number(found.percentual_cprb_transicao),
      percentual_folha_transicao: Number(found.percentual_folha_transicao),
      aliquota_patronal_folha: Number(found.aliquota_patronal_folha),
    };
  }
  // Fallback: usa 20% patronal, sem CPRB
  return {
    aliquota_cprb: 0,
    percentual_cprb_transicao: 0,
    percentual_folha_transicao: 0.20,
    aliquota_patronal_folha: 0.20,
  };
}

/**
 * Gera competência YYYY-MM a partir de uma inicial + offset
 */
export function addMonths(competencia: string, offset: number): string {
  const [y, m] = competencia.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

/**
 * Calcula encargos sobre a folha (férias, 13º, FGTS, etc.) - custo gerencial
 */
function calcularEncargosGerenciais(
  folhaMes: number,
  input: CprbSimulationInput
): number {
  let encargos = 0;
  if (input.incluirFerias) encargos += folhaMes * (1 / 12); // provisão mensal
  if (input.incluirTercoFerias) encargos += folhaMes * (1 / 12) * (1 / 3);
  if (input.incluirDecimoTerceiro) encargos += folhaMes * (1 / 12);
  if (input.incluirFgts) encargos += folhaMes * 0.08;
  if (input.incluirMultaFgts) {
    const fgtsMensal = folhaMes * 0.08;
    encargos += fgtsMensal * input.percentualMultaFgts * (input.percentualRotatividade || 0.1);
  }
  if (input.incluirRatFap) encargos += folhaMes * input.aliquotaRatFap;
  if (input.incluirTerceiros) encargos += folhaMes * input.aliquotaTerceiros;
  return round2(encargos);
}

/**
 * Motor principal de simulação
 */
export function calcularComparativoCprb(
  input: CprbSimulationInput,
  legalParamsDb: Array<{
    competencia_inicio: string;
    competencia_fim: string;
    aliquota_cprb: number;
    percentual_cprb_transicao: number;
    percentual_folha_transicao: number;
    aliquota_patronal_folha: number;
  }>
): CprbConsolidatedResult {
  const receitasMensais = distribuirMensal(
    input.receitaTotal,
    input.horizonteMeses,
    input.percentualCrescimento
  );
  const folhasMensais = distribuirMensal(
    input.folhaTotal,
    input.horizonteMeses,
    input.percentualCrescimento
  );

  const monthly: CprbMonthResult[] = [];
  let totalCustoCprb = 0;
  let totalCustoFolha = 0;
  let totalMaoObraCprb = 0;
  let totalMaoObraFolha = 0;

  for (let i = 0; i < input.horizonteMeses; i++) {
    const competencia = addMonths(input.competenciaInicial, i);
    const param = getLegalParamForMonth(competencia, legalParamsDb);
    const receitaMes = receitasMensais[i] || 0;
    const folhaMes = folhasMensais[i] || 0;

    // === Cenário A: CPRB ===
    // CPRB sobre receita (com percentual de transição)
    const cprbValor = round2(receitaMes * param.aliquota_cprb * param.percentual_cprb_transicao);
    // Contribuição sobre folha exigida no cenário CPRB (transição)
    const contribFolhaTransicao = round2(folhaMes * param.percentual_folha_transicao);
    const custoCenarioCprb = round2(cprbValor + contribFolhaTransicao);

    // === Cenário B: Folha ===
    const contribPatronalFolha = round2(folhaMes * param.aliquota_patronal_folha);
    const custoCenarioFolha = round2(contribPatronalFolha);

    // Diferença
    const diferencaAbsoluta = round2(custoCenarioFolha - custoCenarioCprb);
    const diferencaPercentual = custoCenarioFolha > 0
      ? round2((diferencaAbsoluta / custoCenarioFolha) * 100)
      : 0;

    // Custo gerencial de mão de obra
    const encargosGerenciais = calcularEncargosGerenciais(folhaMes, input);
    const custoMaoObraCprb = round2(folhaMes + encargosGerenciais + custoCenarioCprb);
    const custoMaoObraFolha = round2(folhaMes + encargosGerenciais + custoCenarioFolha);

    const areaM2 = input.areaM2Total || 1;
    const custoM2Cprb = round2(custoMaoObraCprb / areaM2);
    const custoM2Folha = round2(custoMaoObraFolha / areaM2);

    monthly.push({
      competencia,
      mesNumero: i + 1,
      receitaMes,
      folhaMes,
      cprbValor,
      contribFolhaTransicao,
      custoCenarioCprb,
      contribPatronalFolha,
      custoCenarioFolha,
      diferencaAbsoluta,
      diferencaPercentual,
      custoMaoObraCprb,
      custoMaoObraFolha,
      custoM2Cprb,
      custoM2Folha,
    });

    totalCustoCprb += custoCenarioCprb;
    totalCustoFolha += custoCenarioFolha;
    totalMaoObraCprb += custoMaoObraCprb;
    totalMaoObraFolha += custoMaoObraFolha;
  }

  const economiaCprb = round2(totalCustoFolha - totalCustoCprb);
  const economiaPercentual = totalCustoFolha > 0
    ? round2((economiaCprb / totalCustoFolha) * 100)
    : 0;
  const indiceReceitaFolha = input.folhaTotal > 0
    ? round2(input.receitaTotal / input.folhaTotal)
    : 0;

  // Break-even: Receita/Folha ratio where CPRB cost = Folha cost
  // CPRB cost = R * aliq_cprb * pct_trans + F * pct_folha_trans
  // Folha cost = F * aliq_patronal
  // At break-even: R * aliq_cprb * pct_trans = F * (aliq_patronal - pct_folha_trans)
  // R/F = (aliq_patronal - pct_folha_trans) / (aliq_cprb * pct_trans)
  const firstParam = getLegalParamForMonth(input.competenciaInicial, legalParamsDb);
  const denominator = firstParam.aliquota_cprb * firstParam.percentual_cprb_transicao;
  const breakEvenRatio = denominator > 0
    ? round2((firstParam.aliquota_patronal_folha - firstParam.percentual_folha_transicao) / denominator)
    : 0;

  const areaM2 = input.areaM2Total || 1;
  let vantajosidade: 'cprb' | 'folha' | 'empate';
  if (Math.abs(economiaCprb) < totalCustoFolha * 0.01) {
    vantajosidade = 'empate';
  } else if (economiaCprb > 0) {
    vantajosidade = 'cprb';
  } else {
    vantajosidade = 'folha';
  }

  return {
    monthly,
    totalReceitaProjetada: round2(input.receitaTotal),
    totalFolhaProjetada: round2(input.folhaTotal),
    totalCustoCprb: round2(totalCustoCprb),
    totalCustoFolha: round2(totalCustoFolha),
    economiaCprb: round2(economiaCprb),
    economiaPercentual,
    indiceReceitaFolha,
    breakEvenRatio,
    vantajosidade,
    custoMaoObraTotalCprb: round2(totalMaoObraCprb),
    custoMaoObraTotalFolha: round2(totalMaoObraFolha),
    custoM2MedioCprb: round2(totalMaoObraCprb / areaM2),
    custoM2MedioFolha: round2(totalMaoObraFolha / areaM2),
  };
}
