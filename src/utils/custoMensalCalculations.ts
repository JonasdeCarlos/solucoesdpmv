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
  simularExperiencia?: boolean;
  dataInicioExperiencia?: string; // yyyy-MM-dd
  dataFimExperiencia?: string; // yyyy-MM-dd
}

export interface RescisaoExperienciaResult {
  dataInicio: string;
  dataFim: string;
  dias: number;
  diasSaldo: number; // dias trabalhados no mês da rescisão
  mesesInteiros: number;
  avos: number;
  saldoSalario: number;
  cppPeriodo: number;
  ratPeriodo: number;
  terceirosPeriodo: number;
  encargosPeriodo: number;
  decimo13Prop: number;
  feriasProp: number;
  tercoFerias: number;
  fgtsSalarios: number;
  fgtsDecimo13: number;
  fgtsTotal: number;
  encargosDecimo13: number;
  totalVerbas: number;
  custoTotal: number;
}

export interface CustoTotalContratoResult {
  diasPrimeiroMes: number;
  diasUltimoMes: number;
  mesesCompletos: number;
  salarioPrimeiroMes: number;
  salarioMesesCompletos: number;
  salarioUltimoMes: number;
  totalSalarios: number;
  decimo13Prop: number;
  feriasProp: number;
  tercoFerias: number;
  cppTotal: number;
  ratTotal: number;
  terceirosTotal: number;
  encargosDecimo13: number;
  totalEncargos: number;
  fgtsSalarios: number;
  fgtsDecimo13: number;
  fgtsFerias: number;
  fgtsTotal: number;
  totalVerbas: number;
  custoTotal: number;
}

function parseISO(d?: string): Date | null {
  if (!d) return null;
  const [y, m, dd] = d.split('-').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd);
}

export function calcularRescisaoExperiencia(input: CustoMensalInput): RescisaoExperienciaResult {
  const base = input.baseCalculo;
  const inicio = parseISO(input.dataInicioExperiencia);
  const fim = parseISO(input.dataFimExperiencia);

  let dias = 0;
  if (inicio && fim && fim >= inicio) {
    dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
  }

  // Dias trabalhados no mês da rescisão (saldo de salário)
  let diasSaldo = 0;
  if (inicio && fim && fim >= inicio) {
    const mesmoMes = inicio.getFullYear() === fim.getFullYear() && inicio.getMonth() === fim.getMonth();
    const primeiroDiaDoMes = mesmoMes ? inicio.getDate() : 1;
    diasSaldo = fim.getDate() - primeiroDiaDoMes + 1;
    if (fim.getDate() === new Date(fim.getFullYear(), fim.getMonth() + 1, 0).getDate()) {
      // mês fechado: CLT considera 30 dias
      diasSaldo = mesmoMes ? diasSaldo : 30;
    }
  }

  const mesesInteiros = Math.floor(dias / 30);
  const resto = dias - mesesInteiros * 30;
  const avos = Math.min(12, mesesInteiros + (resto >= 15 ? 1 : 0));

  const saldoSalario = (base / 30) * diasSaldo;

  const cppAplicavel = !(input.simplesNacional && !input.recolheCPP);
  const cppPeriodo = cppAplicavel ? saldoSalario * 0.2 : 0;
  const ratPeriodo = saldoSalario * (input.ratPct / 100);
  const terceirosPeriodo = saldoSalario * (input.terceirosPct / 100);
  const encargosPeriodo = cppPeriodo + ratPeriodo + terceirosPeriodo;

  const decimo13Prop = (base / 12) * avos;
  const feriasProp = (base / 12) * avos;
  const tercoFerias = feriasProp / 3;

  const fgtsPctDec = input.fgtsPct / 100;
  const fgtsSalarios = saldoSalario * fgtsPctDec;
  const fgtsDecimo13 = decimo13Prop * fgtsPctDec;
  const fgtsTotal = fgtsSalarios + fgtsDecimo13;

  const encargosDecimo13 = decimo13Prop * ((cppAplicavel ? 20 : 0) + input.ratPct + input.terceirosPct) / 100;

  const totalVerbas = saldoSalario + decimo13Prop + feriasProp + tercoFerias;
  const custoTotal = totalVerbas + fgtsTotal + encargosPeriodo + encargosDecimo13;

  return {
    dataInicio: input.dataInicioExperiencia ?? '',
    dataFim: input.dataFimExperiencia ?? '',
    dias, diasSaldo, mesesInteiros, avos,
    saldoSalario,
    cppPeriodo, ratPeriodo, terceirosPeriodo, encargosPeriodo,
    decimo13Prop, feriasProp, tercoFerias,
    fgtsSalarios, fgtsDecimo13, fgtsTotal, encargosDecimo13,
    totalVerbas, custoTotal,
  };
}

export function calcularCustoTotalContrato(
  input: CustoMensalInput,
  e: RescisaoExperienciaResult
): CustoTotalContratoResult | null {
  const base = input.baseCalculo;
  const inicio = parseISO(input.dataInicioExperiencia);
  const fim = parseISO(input.dataFimExperiencia);
  if (!inicio || !fim || fim < inicio) return null;

  const cppAplicavel = !(input.simplesNacional && !input.recolheCPP);
  const fgtsPctDec = input.fgtsPct / 100;

  // Índices absolutos (ano*12+mês) para saber se início e fim caem no mesmo mês
  const idxInicio = inicio.getFullYear() * 12 + inicio.getMonth();
  const idxFim = fim.getFullYear() * 12 + fim.getMonth();
  const mesmoMes = idxInicio === idxFim;

  // Primeiro mês (quando início e fim são no mesmo mês, ele já é o saldo de rescisão)
  const primeiroMesCompleto = inicio.getDate() === 1;
  const ultimoDiaPrimeiroMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
  const diasPrimeiroMes = mesmoMes
    ? 0
    : primeiroMesCompleto
      ? 30
      : ultimoDiaPrimeiroMes - inicio.getDate() + 1;
  const salarioPrimeiroMes = mesmoMes ? 0 : (base / 30) * diasPrimeiroMes;

  // Meses completos entre o primeiro e o último mês
  const mesesCompletos = Math.max(0, idxFim - idxInicio - 1);
  const salarioMesesCompletos = base * mesesCompletos;

  // Último mês reaproveita o saldo de salário da rescisão
  const salarioUltimoMes = e.saldoSalario;
  const diasUltimoMes = e.diasSaldo;

  const totalSalarios = salarioPrimeiroMes + salarioMesesCompletos + salarioUltimoMes;

  const cppTotal = cppAplicavel ? totalSalarios * 0.2 : 0;
  const ratTotal = totalSalarios * (input.ratPct / 100);
  const terceirosTotal = totalSalarios * (input.terceirosPct / 100);
  const encargosDecimo13 = e.encargosDecimo13;
  const totalEncargos = cppTotal + ratTotal + terceirosTotal + encargosDecimo13;

  const decimo13Prop = e.decimo13Prop;
  const feriasProp = e.feriasProp;
  const tercoFerias = e.tercoFerias;

  const fgtsSalarios = totalSalarios * fgtsPctDec;
  const fgtsDecimo13 = decimo13Prop * fgtsPctDec;
  const fgtsFerias = (feriasProp + tercoFerias) * fgtsPctDec;
  const fgtsTotal = fgtsSalarios + fgtsDecimo13 + fgtsFerias;

  const totalVerbas = totalSalarios + decimo13Prop + feriasProp + tercoFerias;
  const custoTotal = totalVerbas + totalEncargos + fgtsTotal;

  return {
    diasPrimeiroMes,
    diasUltimoMes,
    mesesCompletos,
    salarioPrimeiroMes,
    salarioMesesCompletos,
    salarioUltimoMes,
    totalSalarios,
    decimo13Prop,
    feriasProp,
    tercoFerias,
    cppTotal,
    ratTotal,
    terceirosTotal,
    encargosDecimo13,
    totalEncargos,
    fgtsSalarios,
    fgtsDecimo13,
    fgtsFerias,
    fgtsTotal,
    totalVerbas,
    custoTotal,
  };
}

export function gerarMemoriaCustoTotalContrato(
  input: CustoMensalInput,
  e: RescisaoExperienciaResult,
  c: CustoTotalContratoResult
): MemoriaLinha[] {
  const g = 'Custo total do contrato de experiência';
  const cppAplicavel = !(input.simplesNacional && !input.recolheCPP);
  const linhas: MemoriaLinha[] = [];

  if (c.salarioPrimeiroMes > 0) {
    linhas.push({
      item: `Salário 1º mês (${c.diasPrimeiroMes} dias)`,
      base: formatBRL(input.baseCalculo),
      aliquota: `${c.diasPrimeiroMes}/30`,
      valor: formatBRL(c.salarioPrimeiroMes),
      grupo: g,
    });
  }
  if (c.mesesCompletos > 0) {
    linhas.push({
      item: `Salários meses completos (${c.mesesCompletos})`,
      base: formatBRL(input.baseCalculo),
      aliquota: `${c.mesesCompletos} × base`,
      valor: formatBRL(c.salarioMesesCompletos),
      grupo: g,
    });
  }
  linhas.push({
    item: `Salário último mês (${c.diasUltimoMes} dias)`,
    base: formatBRL(input.baseCalculo),
    aliquota: `${c.diasUltimoMes}/30`,
    valor: formatBRL(c.salarioUltimoMes),
    grupo: g,
  });
  linhas.push({
    item: 'Total de salários pagos',
    base: '—',
    aliquota: '—',
    valor: formatBRL(c.totalSalarios),
    grupo: g,
  });

  linhas.push({
    item: '13º proporcional',
    base: formatBRL(input.baseCalculo),
    aliquota: `${e.avos}/12`,
    valor: formatBRL(c.decimo13Prop),
    grupo: g,
  });
  linhas.push({
    item: 'Férias proporcionais',
    base: formatBRL(input.baseCalculo),
    aliquota: `${e.avos}/12`,
    valor: formatBRL(c.feriasProp),
    grupo: g,
  });
  linhas.push({
    item: '1/3 constitucional',
    base: formatBRL(c.feriasProp),
    aliquota: '1/3',
    valor: formatBRL(c.tercoFerias),
    grupo: g,
  });

  if (cppAplicavel) {
    linhas.push({
      item: 'CPP s/ salários',
      base: formatBRL(c.totalSalarios),
      aliquota: '20,00%',
      valor: formatBRL(c.cppTotal),
      grupo: g,
    });
  } else {
    linhas.push({
      item: 'CPP s/ salários',
      base: '—',
      aliquota: 'Simples (isento)',
      valor: formatBRL(0),
      grupo: g,
    });
  }
  linhas.push({
    item: 'RAT s/ salários',
    base: formatBRL(c.totalSalarios),
    aliquota: formatPct(input.ratPct),
    valor: formatBRL(c.ratTotal),
    grupo: g,
  });
  linhas.push({
    item: 'Terceiros s/ salários',
    base: formatBRL(c.totalSalarios),
    aliquota: formatPct(input.terceirosPct),
    valor: formatBRL(c.terceirosTotal),
    grupo: g,
  });
  linhas.push({
    item: 'Encargos s/ 13º',
    base: formatBRL(c.decimo13Prop),
    aliquota: formatPct((cppAplicavel ? 20 : 0) + input.ratPct + input.terceirosPct),
    valor: formatBRL(c.encargosDecimo13),
    grupo: g,
  });

  linhas.push({
    item: 'FGTS s/ salários',
    base: formatBRL(c.totalSalarios),
    aliquota: formatPct(input.fgtsPct),
    valor: formatBRL(c.fgtsSalarios),
    grupo: g,
  });
  linhas.push({
    item: 'FGTS s/ 13º',
    base: formatBRL(c.decimo13Prop),
    aliquota: formatPct(input.fgtsPct),
    valor: formatBRL(c.fgtsDecimo13),
    grupo: g,
  });
  linhas.push({
    item: 'FGTS s/ férias + 1/3',
    base: formatBRL(c.feriasProp + c.tercoFerias),
    aliquota: formatPct(input.fgtsPct),
    valor: formatBRL(c.fgtsFerias),
    grupo: g,
  });

  return linhas;
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
  return txt;
}

export function gerarMemoriaExperiencia(input: CustoMensalInput, e: RescisaoExperienciaResult): MemoriaLinha[] {
  const g = 'Rescisão ao fim da experiência';
  const cppAplicavel = !(input.simplesNacional && !input.recolheCPP);
  const linhas: MemoriaLinha[] = [
    { item: `Saldo de salário (${e.diasSaldo} dias)`, base: formatBRL(input.baseCalculo), aliquota: `${e.diasSaldo}/30`, valor: formatBRL(e.saldoSalario), grupo: g },
    { item: '13º proporcional', base: formatBRL(input.baseCalculo), aliquota: `${e.avos}/12`, valor: formatBRL(e.decimo13Prop), grupo: g },
    { item: 'Férias proporcionais', base: formatBRL(input.baseCalculo), aliquota: `${e.avos}/12`, valor: formatBRL(e.feriasProp), grupo: g },
    { item: '1/3 constitucional', base: formatBRL(e.feriasProp), aliquota: '1/3', valor: formatBRL(e.tercoFerias), grupo: g },
    { item: 'FGTS s/ saldo', base: formatBRL(e.saldoSalario), aliquota: formatPct(input.fgtsPct), valor: formatBRL(e.fgtsSalarios), grupo: g },
    { item: 'FGTS s/ 13º', base: formatBRL(e.decimo13Prop), aliquota: formatPct(input.fgtsPct), valor: formatBRL(e.fgtsDecimo13), grupo: g },
  ];
  if (cppAplicavel) {
    linhas.push({ item: 'CPP s/ saldo', base: formatBRL(e.saldoSalario), aliquota: '20,00%', valor: formatBRL(e.cppPeriodo), grupo: g });
  } else {
    linhas.push({ item: 'CPP s/ saldo', base: '—', aliquota: 'Simples (isento)', valor: formatBRL(0), grupo: g });
  }
  linhas.push({ item: 'RAT s/ saldo', base: formatBRL(e.saldoSalario), aliquota: formatPct(input.ratPct), valor: formatBRL(e.ratPeriodo), grupo: g });
  linhas.push({ item: 'Terceiros s/ saldo', base: formatBRL(e.saldoSalario), aliquota: formatPct(input.terceirosPct), valor: formatBRL(e.terceirosPeriodo), grupo: g });
  linhas.push({ item: 'Encargos s/ 13º', base: formatBRL(e.decimo13Prop), aliquota: formatPct((cppAplicavel ? 20 : 0) + input.ratPct + input.terceirosPct), valor: formatBRL(e.encargosDecimo13), grupo: g });
  return linhas;
}
