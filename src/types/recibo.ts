export interface ReciboLinha {
  id: string;
  descricao: string;
  pd: 'P' | 'D';
  ref: string;
  valor: number;
  incideFGTS: boolean;
  tipoCalculo: 'manual' | 'dias' | 'horas' | 'hora_extra' | 'adicional_noturno';
  // Campos para cálculos automáticos
  quantidade?: number; // dias ou horas (centesimal)
  adicionalPercent?: number; // para hora extra / adicional noturno
  _horaInput?: string; // campo auxiliar para digitação HH:MM
}

export interface ReciboData {
  emitidoPor: string;
  clienteId: string;
  clienteNome: string;
  clienteDoc: string;
  clienteTipo: 'PF' | 'PJ';
  recebedorNome: string;
  recebedorCPF: string;
  cidadeUF: string;
  competencia: string; // MM/AAAA
  diasUteis: number;
  diasNaoUteis: number;
  dataEmissao: string; // YYYY-MM-DD
  salarioBase: number;
  jornadaMensal: number;
  divisorDiario: number;
  calcularFGTS: boolean;
  aliquotaFGTS: number;
  linhas: ReciboLinha[];
}

export function createEmptyReciboData(): ReciboData {
  return {
    emitidoPor: 'MONTE VERDE CONTABILIDADE S/S LTDA, CNPJ 09.250.785/0001-25',
    clienteId: '',
    clienteNome: '',
    clienteDoc: '',
    clienteTipo: 'PJ',
    recebedorNome: '',
    recebedorCPF: '',
    cidadeUF: 'Monte Verde',
    competencia: '',
    diasUteis: 0,
    diasNaoUteis: 0,
    dataEmissao: new Date().toISOString().split('T')[0],
    salarioBase: 0,
    jornadaMensal: 220,
    divisorDiario: 30,
    calcularFGTS: true,
    aliquotaFGTS: 8,
    linhas: [],
  };
}

export function createEmptyLinha(): ReciboLinha {
  return {
    id: crypto.randomUUID(),
    descricao: '',
    pd: 'P',
    ref: '',
    valor: 0,
    incideFGTS: true,
    tipoCalculo: 'manual',
    quantidade: 0,
    adicionalPercent: 50,
  };
}

export function calcularValorLinha(
  linha: ReciboLinha,
  salarioBase: number,
  jornadaMensal: number,
  divisorDiario: number
): number {
  if (linha.tipoCalculo === 'manual') return linha.valor;
  if (salarioBase <= 0) return linha.valor;

  const qtd = linha.quantidade || 0;

  switch (linha.tipoCalculo) {
    case 'dias':
      return round2((salarioBase / divisorDiario) * qtd);
    case 'horas':
      return round2((salarioBase / jornadaMensal) * qtd);
    case 'hora_extra': {
      const adicional = (linha.adicionalPercent || 50) / 100;
      return round2(qtd * (salarioBase / jornadaMensal) * (1 + adicional));
    }
    case 'adicional_noturno': {
      const adicionalNot = (linha.adicionalPercent || 20) / 100;
      return round2(qtd * (salarioBase / jornadaMensal) * adicionalNot);
    }
    default:
      return linha.valor;
  }
}

export function calcularTotaisRecibo(linhas: ReciboLinha[], calcularFGTS: boolean, aliquotaFGTS: number) {
  const proventos = linhas.filter((l) => l.pd === 'P').reduce((s, l) => s + l.valor, 0);
  const descontos = linhas.filter((l) => l.pd === 'D').reduce((s, l) => s + l.valor, 0);

  let fgtsValor = 0;
  if (calcularFGTS) {
    const baseFGTS = linhas
      .filter((l) => l.incideFGTS && l.pd === 'P')
      .reduce((s, l) => s + l.valor, 0);
    fgtsValor = round2(baseFGTS * (aliquotaFGTS / 100));
  }

  const totalLiquido = round2(proventos + fgtsValor - descontos);

  return { proventos: round2(proventos), descontos: round2(descontos), fgtsValor, totalLiquido };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
