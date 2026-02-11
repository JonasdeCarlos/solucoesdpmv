export interface CustoMensalInput {
  salario: number;
  baseCalculo: number;
  simplesNacional: boolean;
  recolheCPP: boolean; // only relevant if simplesNacional
  ratPct: number;
  terceirosPct: number;
  fgtsPct: number;
  multaFgtsPct: number;
  competencia: string; // yyyy-MM (optional display)
}

export interface CustoMensalResult {
  base: number;

  // Encargos diretos
  cppValor: number;
  cppPct: number;
  cppAplicavel: boolean;
  ratValor: number;
  terceirosValor: number;
  fgtsMes: number;

  // Provisões
  prov13: number;
  provFerias: number;
  provTercoFerias: number;
  totalProvisoes: number;

  // FGTS reflexos
  fgts13: number;
  fgtsFerias: number;
  fgtsTercoFerias: number;
  totalFgtsReflexos: number;
  fgtsTotal: number;

  // Multa FGTS
  baseMultaFgts: number;
  provMultaFgts: number;

  // Totais
  custoEncargos: number;
  custoMensalTotal: number;
  percentualEfetivo: number;
}

export function calcularCustoMensal(input: CustoMensalInput): CustoMensalResult {
  const base = input.baseCalculo;

  // CPP
  const cppPct = 20;
  const cppAplicavel = !(input.simplesNacional && !input.recolheCPP);
  const cppValor = cppAplicavel ? base * (cppPct / 100) : 0;

  // RAT & Terceiros
  const ratValor = base * (input.ratPct / 100);
  const terceirosValor = base * (input.terceirosPct / 100);

  // FGTS do mês
  const fgtsMes = base * (input.fgtsPct / 100);

  // Provisões mensais
  const prov13 = base / 12;
  const provFerias = base / 12;
  const provTercoFerias = base / 36;
  const totalProvisoes = prov13 + provFerias + provTercoFerias;

  // FGTS reflexos
  const fgtsPctDec = input.fgtsPct / 100;
  const fgts13 = prov13 * fgtsPctDec;
  const fgtsFerias = provFerias * fgtsPctDec;
  const fgtsTercoFerias = provTercoFerias * fgtsPctDec;
  const totalFgtsReflexos = fgts13 + fgtsFerias + fgtsTercoFerias;
  const fgtsTotal = fgtsMes + totalFgtsReflexos;

  // Multa FGTS provisão
  const baseMultaFgts = fgtsTotal;
  const provMultaFgts = baseMultaFgts * (input.multaFgtsPct / 100);

  // Totais
  const custoEncargos = cppValor + ratValor + terceirosValor + fgtsMes;
  const custoMensalTotal = base + cppValor + ratValor + terceirosValor + fgtsMes + totalProvisoes + totalFgtsReflexos + provMultaFgts;
  const percentualEfetivo = base > 0 ? (custoMensalTotal / base) * 100 : 0;

  return {
    base,
    cppValor, cppPct, cppAplicavel,
    ratValor, terceirosValor, fgtsMes,
    prov13, provFerias, provTercoFerias, totalProvisoes,
    fgts13, fgtsFerias, fgtsTercoFerias, totalFgtsReflexos, fgtsTotal,
    baseMultaFgts, provMultaFgts,
    custoEncargos, custoMensalTotal, percentualEfetivo,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

export interface MemoriaLinha {
  item: string;
  base: string;
  aliquota: string;
  valor: string;
  grupo?: string;
}

export function gerarMemoriaCalculo(input: CustoMensalInput, r: CustoMensalResult): MemoriaLinha[] {
  const linhas: MemoriaLinha[] = [];

  linhas.push({ item: 'Salário / Base', base: '—', aliquota: '—', valor: formatBRL(r.base), grupo: 'Base' });

  // Encargos
  if (r.cppAplicavel) {
    linhas.push({ item: 'CPP (INSS Patronal)', base: formatBRL(r.base), aliquota: formatPct(r.cppPct), valor: formatBRL(r.cppValor), grupo: 'Encargos Diretos' });
  } else {
    linhas.push({ item: 'CPP (INSS Patronal)', base: '—', aliquota: 'Simples (isento)', valor: formatBRL(0), grupo: 'Encargos Diretos' });
  }
  linhas.push({ item: 'RAT', base: formatBRL(r.base), aliquota: formatPct(input.ratPct), valor: formatBRL(r.ratValor), grupo: 'Encargos Diretos' });
  linhas.push({ item: 'Terceiros', base: formatBRL(r.base), aliquota: formatPct(input.terceirosPct), valor: formatBRL(r.terceirosValor), grupo: 'Encargos Diretos' });
  linhas.push({ item: 'FGTS do mês', base: formatBRL(r.base), aliquota: formatPct(input.fgtsPct), valor: formatBRL(r.fgtsMes), grupo: 'Encargos Diretos' });

  // Provisões
  linhas.push({ item: 'Provisão 13º', base: formatBRL(r.base), aliquota: '1/12', valor: formatBRL(r.prov13), grupo: 'Provisões Mensais' });
  linhas.push({ item: 'Provisão Férias', base: formatBRL(r.base), aliquota: '1/12', valor: formatBRL(r.provFerias), grupo: 'Provisões Mensais' });
  linhas.push({ item: 'Provisão 1/3 Férias', base: formatBRL(r.base), aliquota: '1/36', valor: formatBRL(r.provTercoFerias), grupo: 'Provisões Mensais' });

  // FGTS reflexos
  linhas.push({ item: 'FGTS s/ 13º', base: formatBRL(r.prov13), aliquota: formatPct(input.fgtsPct), valor: formatBRL(r.fgts13), grupo: 'FGTS Reflexos' });
  linhas.push({ item: 'FGTS s/ Férias', base: formatBRL(r.provFerias), aliquota: formatPct(input.fgtsPct), valor: formatBRL(r.fgtsFerias), grupo: 'FGTS Reflexos' });
  linhas.push({ item: 'FGTS s/ 1/3 Férias', base: formatBRL(r.provTercoFerias), aliquota: formatPct(input.fgtsPct), valor: formatBRL(r.fgtsTercoFerias), grupo: 'FGTS Reflexos' });

  // Multa
  linhas.push({ item: 'Prov. Multa FGTS', base: formatBRL(r.fgtsTotal), aliquota: formatPct(input.multaFgtsPct), valor: formatBRL(r.provMultaFgts), grupo: 'Multa FGTS (provisão)' });

  return linhas;
}

export function gerarTextoCopiavel(input: CustoMensalInput, r: CustoMensalResult): string {
  const linhas = gerarMemoriaCalculo(input, r);
  let txt = '=== CUSTO MENSAL DE CONTRATAÇÃO ===\n';
  if (input.competencia) txt += `Competência: ${input.competencia}\n`;
  txt += `Salário: ${formatBRL(input.salario)} | Base: ${formatBRL(r.base)}\n`;
  txt += `Simples Nacional: ${input.simplesNacional ? 'Sim' : 'Não'}`;
  if (input.simplesNacional) txt += ` | Recolhe CPP: ${input.recolheCPP ? 'Sim' : 'Não'}`;
  txt += '\n\n';

  let lastGrupo = '';
  for (const l of linhas) {
    if (l.grupo && l.grupo !== lastGrupo) {
      txt += `\n--- ${l.grupo} ---\n`;
      lastGrupo = l.grupo!;
    }
    txt += `${l.item.padEnd(25)} | Base: ${l.base.padEnd(14)} | Alíq: ${l.aliquota.padEnd(14)} | ${l.valor}\n`;
  }

  txt += `\n=== TOTAIS ===\n`;
  txt += `Custo direto (salário+encargos+FGTS): ${formatBRL(r.base + r.custoEncargos)}\n`;
  txt += `Total provisões: ${formatBRL(r.totalProvisoes)}\n`;
  txt += `Total FGTS reflexos: ${formatBRL(r.totalFgtsReflexos)}\n`;
  txt += `Provisão multa FGTS: ${formatBRL(r.provMultaFgts)}\n`;
  txt += `CUSTO MENSAL TOTAL ESTIMADO: ${formatBRL(r.custoMensalTotal)}\n`;
  txt += `Percentual efetivo sobre base: ${formatPct(r.percentualEfetivo)}\n`;
  txt += `\n⚠️ Cálculo estimativo. Alíquotas variam por CNAE/FPAS/FAP, regras do Simples/CPP, CCT e particularidades do contrato.`;
  return txt;
}
