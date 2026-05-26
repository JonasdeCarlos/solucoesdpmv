import { formatCurrency } from './formatters';

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface FgtsMesDetalhe {
  mes: string; // "Jan/2024"
  diasTrabalhados: number;
  valorBase: number; // (sal/30) * dias
}

export interface FgtsDetalheResult {
  meses: FgtsMesDetalhe[];
  baseSalarial: number;
  baseDecimo: number;
  base13Anterior: number;
  baseTotal: number;
  fgtsTotal: number;
}

export function calcularFgtsDetalhado(
  salario: number,
  dataAdmissao: Date | null,
  dataDesligamento: Date | null,
  decimoProporcional: number,
  incluir13Anteriores: boolean,
  diasTrabalhadosMesDesligamento?: number,
): FgtsDetalheResult {
  const meses: FgtsMesDetalhe[] = [];
  let baseSalarial = 0;

  if (dataAdmissao && dataDesligamento) {
    const start = new Date(dataAdmissao);
    const end = new Date(dataDesligamento);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (
      cursor.getFullYear() < end.getFullYear() ||
      (cursor.getFullYear() === end.getFullYear() && cursor.getMonth() <= end.getMonth())
    ) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const totalDiasNoMes = new Date(year, month + 1, 0).getDate();

      const isFirstMonth = year === start.getFullYear() && month === start.getMonth();
      const isLastMonth = year === end.getFullYear() && month === end.getMonth();

      let diasTrabalhados: number;
      if (isFirstMonth && isLastMonth) {
        diasTrabalhados = typeof diasTrabalhadosMesDesligamento === 'number'
          ? Math.min(diasTrabalhadosMesDesligamento, 30)
          : ((end.getDate() >= totalDiasNoMes && start.getDate() === 1) ? 30 : (end.getDate() - start.getDate() + 1));
      } else if (isFirstMonth) {
        const diasReais = totalDiasNoMes - start.getDate() + 1;
        diasTrabalhados = start.getDate() === 1 ? 30 : diasReais;
      } else if (isLastMonth) {
        diasTrabalhados = typeof diasTrabalhadosMesDesligamento === 'number'
          ? Math.min(diasTrabalhadosMesDesligamento, 30)
          : (end.getDate() >= totalDiasNoMes ? 30 : end.getDate());
      } else {
        diasTrabalhados = 30;
      }

      // Mês completo = salário integral (padrão CLT)
      const valorBase = diasTrabalhados >= 30 ? salario : (salario / 30) * diasTrabalhados;
      baseSalarial += valorBase;

      meses.push({
        mes: `${MESES_NOMES[month]}/${year}`,
        diasTrabalhados,
        valorBase: Math.round(valorBase * 100) / 100,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  let base13Anterior = 0;
  if (incluir13Anteriores && dataAdmissao && dataDesligamento) {
    const diffY = dataDesligamento.getFullYear() - dataAdmissao.getFullYear();
    const diffM = dataDesligamento.getMonth() - dataAdmissao.getMonth();
    const diffD = dataDesligamento.getDate() - dataAdmissao.getDate();
    let totalMeses = diffY * 12 + diffM;
    if (diffD >= 15) totalMeses += 1;
    if (totalMeses > 12) {
      const anosCompletos = Math.floor(totalMeses / 12);
      base13Anterior = salario * anosCompletos;
    }
  }

  const baseTotal = baseSalarial + decimoProporcional + base13Anterior;
  const fgtsTotal = Math.round(baseTotal * 0.08 * 100) / 100;

  return {
    meses,
    baseSalarial: Math.round(baseSalarial * 100) / 100,
    baseDecimo: Math.round(decimoProporcional * 100) / 100,
    base13Anterior: Math.round(base13Anterior * 100) / 100,
    baseTotal: Math.round(baseTotal * 100) / 100,
    fgtsTotal,
  };
}
