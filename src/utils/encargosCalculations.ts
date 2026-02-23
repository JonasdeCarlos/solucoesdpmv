// ===== Tabelas parametrizáveis por ano =====

export interface FaixaINSS {
  ate: number;
  aliquota: number; // ex.: 7.5
}

export interface FaixaIRRF {
  ate: number; // Infinity para última
  aliquota: number; // ex.: 7.5
  deducao: number;
}

export interface TabelaEncargos {
  ano: number;
  inss: FaixaINSS[];
  irrf: FaixaIRRF[];
  deducaoDependente: number;
  limiteDescontoSimplificado: number;
  // Redução mensal 2026
  reducaoMensal: {
    limiteIsencao: number;       // até esse valor → redução zera o imposto (máx reducaoMaxima)
    reducaoMaxima: number;       // R$ 312,89
    limiteRegressao: number;     // 7350
    coeficiente: number;         // 0.133145
    constante: number;           // 978.62
  };
}

export const TABELAS: Record<number, TabelaEncargos> = {
  2026: {
    ano: 2026,
    inss: [
      { ate: 1621.00, aliquota: 7.5 },
      { ate: 2902.84, aliquota: 9 },
      { ate: 4354.27, aliquota: 12 },
      { ate: 8475.55, aliquota: 14 },
    ],
    irrf: [
      { ate: 2428.80, aliquota: 0, deducao: 0 },
      { ate: 2826.65, aliquota: 7.5, deducao: 182.16 },
      { ate: 3751.05, aliquota: 15, deducao: 394.16 },
      { ate: 4664.68, aliquota: 22.5, deducao: 675.49 },
      { ate: Infinity, aliquota: 27.5, deducao: 908.73 },
    ],
    deducaoDependente: 189.59,
    limiteDescontoSimplificado: 607.20,
    reducaoMensal: {
      limiteIsencao: 5000,
      reducaoMaxima: 312.89,
      limiteRegressao: 7350,
      coeficiente: 0.133145,
      constante: 978.62,
    },
  },
};

export function getTabelaAnos(): number[] {
  return Object.keys(TABELAS).map(Number).sort((a, b) => b - a);
}

// ===== Tipos de entrada/saída =====

export interface EncargosInput {
  salarioBruto: number;
  outrasTributaveis: number;
  outrasIsentas: number;
  dependentes: number;
  pensaoAlimenticia: number;
  descontoSimplificado: boolean;
  ano: number;
}

export interface FaixaINSSDetalhe {
  de: number;
  ate: number;
  aliquota: number;
  contribuicao: number;
}

export interface EncargosResult {
  baseINSS: number;
  faixasINSS: FaixaINSSDetalhe[];
  totalINSS: number;
  rendimentoTributavel: number;
  deducaoINSS: number;
  deducaoDependentes: number;
  deducaoPensao: number;
  deducaoSimplificado: number;
  totalDeducoes: number;
  baseIRRF: number;
  aliquotaIR: number;
  parcelaDeducaoIR: number;
  irrfBruto: number;
  baseReducao: number;
  reducaoMensal: number;
  irrfFinal: number;
  totalDescontos: number;
  salarioLiquido: number;
}

// ===== Cálculo =====

export function calcularEncargos(input: EncargosInput): EncargosResult {
  const tabela = TABELAS[input.ano] || TABELAS[2026];

  // 3.1 Base INSS
  const baseINSS = input.salarioBruto + input.outrasTributaveis;

  // 3.2 INSS progressivo
  const faixasINSS: FaixaINSSDetalhe[] = [];
  let restante = baseINSS;
  let anterior = 0;
  for (const faixa of tabela.inss) {
    if (restante <= 0) break;
    const faixaBase = Math.min(restante, faixa.ate - anterior);
    const contrib = round2(faixaBase * faixa.aliquota / 100);
    faixasINSS.push({
      de: anterior,
      ate: Math.min(faixa.ate, baseINSS),
      aliquota: faixa.aliquota,
      contribuicao: contrib,
    });
    restante -= faixaBase;
    anterior = faixa.ate;
  }
  const totalINSS = round2(faixasINSS.reduce((s, f) => s + f.contribuicao, 0));

  // 3.3 Base IRRF
  const rendimentoTributavel = input.salarioBruto + input.outrasTributaveis;
  const deducaoINSS = totalINSS;
  const deducaoDependentes = round2(input.dependentes * tabela.deducaoDependente);
  const deducaoPensao = round2(input.pensaoAlimenticia);

  let deducaoSimplificado = 0;
  let deducaoLegal = deducaoINSS + deducaoDependentes + deducaoPensao;

  if (input.descontoSimplificado) {
    deducaoSimplificado = Math.min(tabela.limiteDescontoSimplificado, rendimentoTributavel);
    // Usar o maior entre simplificado e legal
    if (deducaoSimplificado > deducaoLegal) {
      // Usa simplificado, zera os outros
      deducaoSimplificado = deducaoSimplificado;
    } else {
      deducaoSimplificado = 0; // legal é maior, usar legal
    }
  }

  const totalDeducoes = input.descontoSimplificado && deducaoSimplificado > 0
    ? deducaoSimplificado
    : deducaoLegal;

  const baseIRRF = Math.max(0, rendimentoTributavel - totalDeducoes);

  // 3.4 IRRF
  let aliquotaIR = 0;
  let parcelaDeducaoIR = 0;
  for (const faixa of tabela.irrf) {
    if (baseIRRF <= faixa.ate) {
      aliquotaIR = faixa.aliquota;
      parcelaDeducaoIR = faixa.deducao;
      break;
    }
  }
  const irrfBruto = round2(Math.max(0, baseIRRF * aliquotaIR / 100 - parcelaDeducaoIR));

  // Redução mensal 2026
  const red = tabela.reducaoMensal;
  const baseReducao = baseIRRF;
  let reducaoMensal = 0;
  if (baseReducao <= red.limiteIsencao) {
    reducaoMensal = Math.min(red.reducaoMaxima, irrfBruto);
  } else if (baseReducao <= red.limiteRegressao) {
    reducaoMensal = round2(Math.max(0, red.constante - red.coeficiente * baseReducao));
  }
  reducaoMensal = Math.min(reducaoMensal, irrfBruto);

  const irrfFinal = round2(Math.max(0, irrfBruto - reducaoMensal));
  const totalDescontos = round2(totalINSS + irrfFinal);
  const salarioLiquido = round2(input.salarioBruto + input.outrasTributaveis + input.outrasIsentas - totalDescontos - input.pensaoAlimenticia);

  return {
    baseINSS,
    faixasINSS,
    totalINSS,
    rendimentoTributavel,
    deducaoINSS,
    deducaoDependentes,
    deducaoPensao,
    deducaoSimplificado,
    totalDeducoes,
    baseIRRF,
    aliquotaIR,
    parcelaDeducaoIR,
    irrfBruto,
    baseReducao,
    reducaoMensal,
    irrfFinal,
    totalDescontos,
    salarioLiquido,
  };
}

// ===== Memória de cálculo =====

export interface LinhaMemoria {
  grupo: string;
  item: string;
  base: string;
  aliquota: string;
  valor: string;
}

export function gerarMemoriaEncargos(input: EncargosInput, r: EncargosResult): LinhaMemoria[] {
  const tabela = TABELAS[input.ano] || TABELAS[2026];
  const lines: LinhaMemoria[] = [];

  // INSS por faixa
  for (const f of r.faixasINSS) {
    lines.push({
      grupo: 'INSS Empregado (progressivo)',
      item: `Faixa ${formatBRL(f.de)} a ${formatBRL(f.ate)}`,
      base: formatBRL(f.ate - f.de),
      aliquota: formatPct(f.aliquota),
      valor: formatBRL(f.contribuicao),
    });
  }
  lines.push({
    grupo: 'INSS Empregado (progressivo)',
    item: 'Total INSS',
    base: formatBRL(r.baseINSS),
    aliquota: '—',
    valor: formatBRL(r.totalINSS),
  });

  // Deduções IR
  const gDed = 'Deduções para IRRF';
  if (input.descontoSimplificado && r.deducaoSimplificado > 0) {
    lines.push({ grupo: gDed, item: 'Desconto simplificado', base: '—', aliquota: `Limite ${formatBRL(tabela.limiteDescontoSimplificado)}`, valor: formatBRL(r.deducaoSimplificado) });
  } else {
    lines.push({ grupo: gDed, item: 'INSS descontado', base: '—', aliquota: '—', valor: formatBRL(r.deducaoINSS) });
    if (input.dependentes > 0) {
      lines.push({ grupo: gDed, item: `Dependentes (${input.dependentes} × ${formatBRL(tabela.deducaoDependente)})`, base: '—', aliquota: '—', valor: formatBRL(r.deducaoDependentes) });
    }
    if (input.pensaoAlimenticia > 0) {
      lines.push({ grupo: gDed, item: 'Pensão alimentícia', base: '—', aliquota: '—', valor: formatBRL(r.deducaoPensao) });
    }
  }
  lines.push({ grupo: gDed, item: 'Total deduções', base: '—', aliquota: '—', valor: formatBRL(r.totalDeducoes) });
  lines.push({ grupo: gDed, item: 'Base de cálculo IRRF', base: formatBRL(r.rendimentoTributavel), aliquota: `− ${formatBRL(r.totalDeducoes)}`, valor: formatBRL(r.baseIRRF) });

  // IRRF
  const gIR = 'IRRF';
  lines.push({ grupo: gIR, item: 'IRRF bruto', base: formatBRL(r.baseIRRF), aliquota: r.aliquotaIR > 0 ? `${formatPct(r.aliquotaIR)} − ${formatBRL(r.parcelaDeducaoIR)}` : 'Isento', valor: formatBRL(r.irrfBruto) });
  if (r.reducaoMensal > 0) {
    lines.push({ grupo: gIR, item: 'Redução mensal (Lei 2026)', base: formatBRL(r.baseReducao), aliquota: 'Tabela de redução', valor: `(${formatBRL(r.reducaoMensal)})` });
  }
  lines.push({ grupo: gIR, item: 'IRRF final', base: '—', aliquota: '—', valor: formatBRL(r.irrfFinal) });

  // Resumo
  const gRes = 'Resumo';
  lines.push({ grupo: gRes, item: 'Salário bruto', base: '—', aliquota: '—', valor: formatBRL(input.salarioBruto) });
  if (input.outrasTributaveis > 0) lines.push({ grupo: gRes, item: 'Outras verbas tributáveis', base: '—', aliquota: '—', valor: formatBRL(input.outrasTributaveis) });
  if (input.outrasIsentas > 0) lines.push({ grupo: gRes, item: 'Outras verbas isentas', base: '—', aliquota: '—', valor: formatBRL(input.outrasIsentas) });
  lines.push({ grupo: gRes, item: 'INSS descontado', base: '—', aliquota: '—', valor: `(${formatBRL(r.totalINSS)})` });
  lines.push({ grupo: gRes, item: 'IRRF descontado', base: '—', aliquota: '—', valor: `(${formatBRL(r.irrfFinal)})` });
  if (input.pensaoAlimenticia > 0) lines.push({ grupo: gRes, item: 'Pensão alimentícia', base: '—', aliquota: '—', valor: `(${formatBRL(input.pensaoAlimenticia)})` });
  lines.push({ grupo: gRes, item: 'SALÁRIO LÍQUIDO ESTIMADO', base: '—', aliquota: '—', valor: formatBRL(r.salarioLiquido) });

  return lines;
}

export function gerarTextoEncargos(input: EncargosInput, r: EncargosResult): string {
  const lines: string[] = [];
  lines.push('=== SIMULAÇÃO DE ENCARGOS NO SALÁRIO (INSS + IRRF) ===');
  lines.push(`Ano/Tabela: ${input.ano}`);
  lines.push(`Salário bruto: ${formatBRL(input.salarioBruto)}`);
  if (input.outrasTributaveis) lines.push(`Outras tributáveis: ${formatBRL(input.outrasTributaveis)}`);
  if (input.outrasIsentas) lines.push(`Outras isentas: ${formatBRL(input.outrasIsentas)}`);
  if (input.dependentes) lines.push(`Dependentes: ${input.dependentes}`);
  if (input.pensaoAlimenticia) lines.push(`Pensão alimentícia: ${formatBRL(input.pensaoAlimenticia)}`);
  lines.push(`Desconto simplificado: ${input.descontoSimplificado ? 'Sim' : 'Não'}`);
  lines.push('');
  lines.push('--- INSS ---');
  for (const f of r.faixasINSS) {
    lines.push(`  ${formatBRL(f.de)} a ${formatBRL(f.ate)}: ${formatPct(f.aliquota)} = ${formatBRL(f.contribuicao)}`);
  }
  lines.push(`  Total INSS: ${formatBRL(r.totalINSS)}`);
  lines.push('');
  lines.push('--- IRRF ---');
  lines.push(`  Base IRRF: ${formatBRL(r.baseIRRF)}`);
  lines.push(`  IRRF bruto: ${formatBRL(r.irrfBruto)}`);
  if (r.reducaoMensal > 0) lines.push(`  Redução mensal: (${formatBRL(r.reducaoMensal)})`);
  lines.push(`  IRRF final: ${formatBRL(r.irrfFinal)}`);
  lines.push('');
  lines.push(`Total descontos: ${formatBRL(r.totalDescontos)}`);
  lines.push(`SALÁRIO LÍQUIDO ESTIMADO: ${formatBRL(r.salarioLiquido)}`);
  lines.push('');
  lines.push('⚠️ Simulação. Pode variar conforme natureza das verbas, decisões judiciais, CCT e parametrizações internas.');
  return lines.join('\n');
}

// ===== Helpers =====

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export function formatPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}
