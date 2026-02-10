export type MotivoRescisao =
  | 'pedido_demissao'
  | 'dispensa_sem_justa_causa'
  | 'dispensa_justa_causa'
  | 'comum_acordo'
  | 'termino_contrato'
  | 'outros';

export const MOTIVO_LABELS: Record<MotivoRescisao, string> = {
  pedido_demissao: 'Pedido de demissão',
  dispensa_sem_justa_causa: 'Dispensa sem justa causa',
  dispensa_justa_causa: 'Dispensa por justa causa',
  comum_acordo: 'Rescisão em comum acordo (art. 484-A)',
  termino_contrato: 'Término de contrato por prazo determinado / experiência',
  outros: 'Outros',
};

export const MOTIVO_TERMO_TITULO: Record<MotivoRescisao, string> = {
  pedido_demissao: 'POR PEDIDO DE DEMISSÃO',
  dispensa_sem_justa_causa: 'POR DISPENSA SEM JUSTA CAUSA',
  dispensa_justa_causa: 'POR DISPENSA POR JUSTA CAUSA',
  comum_acordo: 'POR RESCISÃO EM COMUM ACORDO (ART. 484-A CLT)',
  termino_contrato: 'POR TÉRMINO DE CONTRATO POR PRAZO DETERMINADO',
  outros: '',
};

export const MOTIVO_TERMO_CORPO: Record<MotivoRescisao, string> = {
  pedido_demissao: 'por pedido de demissão',
  dispensa_sem_justa_causa: 'por dispensa sem justa causa',
  dispensa_justa_causa: 'por dispensa por justa causa',
  comum_acordo: 'por rescisão em comum acordo (art. 484-A CLT)',
  termino_contrato: 'por término de contrato por prazo determinado',
  outros: '',
};

export interface Step1Data {
  dataAdmissao: Date | null;
  dataDesligamento: Date | null;
  salarioMensal: number;
  motivo: MotivoRescisao;
  motivoOutroTexto: string;
  descontaAvisoPrevio: boolean;
  diasAvisoDesconto: number;
  temFeriasVencidas: boolean;
  periodosVencidos: number;
  calculaFGTS: boolean;
  calculaMultaFGTS: boolean;
  percentualMultaFGTS: number;
  calculaAvisoPrevioIndenizado: boolean;
  diasAvisoPrevioIndenizado: number;
}

export interface Step2Data {
  diasTrabalhadosMes: number;
  meses13Proporcional: number;
  mesesFeriasProporcional: number;
  consideraTercoFerias: boolean;
  outrosDescontos: number;
  outrosCreditos: number;
  incluir13AnosAnteriores: boolean;
  fgtsManual: number | null;
}

export interface VerbaRescisoria {
  id: string;
  verba: string;
  referencia: string;
  valor: number;
  tipo: 'credito' | 'debito';
}

export interface Step3Data {
  empregadorNome: string;
  empregadorCPF: string;
  empregadorEndereco: string;
  empregadorTipo: 'domestico' | 'empresa';
  empregadorCNPJ: string;
  empregadoNome: string;
  empregadoCPF: string;
  empregadoEndereco: string;
}

export function calcularVerbas(step1: Step1Data, step2: Step2Data): VerbaRescisoria[] {
  const verbas: VerbaRescisoria[] = [];
  const sal = step1.salarioMensal;

  // Saldo de salário
  const saldoSalario = (sal / 30) * step2.diasTrabalhadosMes;
  verbas.push({
    id: 'saldo_salario',
    verba: 'Saldo de salário',
    referencia: `${step2.diasTrabalhadosMes}/30 dias`,
    valor: round2(saldoSalario),
    tipo: 'credito',
  });

  // 13º proporcional
  const decimo = sal * (step2.meses13Proporcional / 12);
  verbas.push({
    id: '13_proporcional',
    verba: '13º salário proporcional',
    referencia: `${step2.meses13Proporcional}/12`,
    valor: round2(decimo),
    tipo: 'credito',
  });

  // Férias proporcionais
  const feriasProp = sal * (step2.mesesFeriasProporcional / 12);
  verbas.push({
    id: 'ferias_proporcionais',
    verba: 'Férias proporcionais',
    referencia: `${step2.mesesFeriasProporcional}/12`,
    valor: round2(feriasProp),
    tipo: 'credito',
  });

  // Férias vencidas
  let totalFerias = feriasProp;
  if (step1.temFeriasVencidas && step1.periodosVencidos > 0) {
    const feriasVenc = sal * step1.periodosVencidos;
    verbas.push({
      id: 'ferias_vencidas',
      verba: 'Férias vencidas',
      referencia: `${step1.periodosVencidos} período(s)`,
      valor: round2(feriasVenc),
      tipo: 'credito',
    });
    totalFerias += feriasVenc;
  }

  // 1/3 férias
  if (step2.consideraTercoFerias) {
    const terco = totalFerias / 3;
    verbas.push({
      id: 'terco_ferias',
      verba: '1/3 constitucional sobre férias',
      referencia: '1/3',
      valor: round2(terco),
      tipo: 'credito',
    });
  }

  // Aviso prévio indenizado
  if (step1.calculaAvisoPrevioIndenizado) {
    const aviso = (sal / 30) * step1.diasAvisoPrevioIndenizado;
    verbas.push({
      id: 'aviso_previo_indenizado',
      verba: 'Aviso prévio indenizado',
      referencia: `${step1.diasAvisoPrevioIndenizado} dias`,
      valor: round2(aviso),
      tipo: 'credito',
    });
  }

  // Desconto aviso prévio (pedido demissão)
  if (step1.motivo === 'pedido_demissao' && step1.descontaAvisoPrevio) {
    const desc = (sal / 30) * step1.diasAvisoDesconto;
    verbas.push({
      id: 'desconto_aviso',
      verba: 'Desconto aviso prévio',
      referencia: `${step1.diasAvisoDesconto} dias`,
      valor: round2(desc),
      tipo: 'debito',
    });
  }

  // FGTS
  if (step1.calculaFGTS) {
    let fgtsTotal: number;
    if (step2.fgtsManual !== null && step2.fgtsManual > 0) {
      fgtsTotal = step2.fgtsManual;
    } else {
      // Calcula base FGTS mês a mês considerando dias trabalhados
      let baseFGTS = 0;
      if (step1.dataAdmissao && step1.dataDesligamento) {
        const start = new Date(step1.dataAdmissao);
        const end = new Date(step1.dataDesligamento);
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

        while (cursor <= end) {
          const year = cursor.getFullYear();
          const month = cursor.getMonth();
          const totalDiasNoMes = new Date(year, month + 1, 0).getDate();

          // Primeiro dia trabalhado neste mês
          const inicioMes = new Date(year, month, 1);
          const primeiroDia = start > inicioMes ? start.getDate() : 1;

          // Último dia trabalhado neste mês
          const fimMes = new Date(year, month, totalDiasNoMes);
          const ultimoDia = end < fimMes ? end.getDate() : totalDiasNoMes;

          const diasTrabalhados = Math.max(0, ultimoDia - primeiroDia + 1);
          const proporcao = diasTrabalhados / totalDiasNoMes;
          baseFGTS += sal * proporcao;

          // Avança para o próximo mês
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
      // Adiciona 13º proporcional à base
      baseFGTS += decimo;
      if (step2.incluir13AnosAnteriores) {
        const mesesVinculo = step1.dataAdmissao && step1.dataDesligamento
          ? diffMonthsFull(step1.dataAdmissao, step1.dataDesligamento)
          : 0;
        if (mesesVinculo > 12) {
          const anosCompletos = Math.floor(mesesVinculo / 12);
          baseFGTS += sal * anosCompletos;
        }
      }
      fgtsTotal = baseFGTS * 0.08;
    }
    verbas.push({
      id: 'fgts',
      verba: 'FGTS do período',
      referencia: '8%',
      valor: round2(fgtsTotal),
      tipo: 'credito',
    });

    // Multa FGTS
    if (step1.calculaMultaFGTS && step1.percentualMultaFGTS > 0) {
      const multa = fgtsTotal * (step1.percentualMultaFGTS / 100);
      verbas.push({
        id: 'multa_fgts',
        verba: 'Multa FGTS',
        referencia: `${step1.percentualMultaFGTS}%`,
        valor: round2(multa),
        tipo: 'credito',
      });
    }
  }

  // Outros créditos
  if (step2.outrosCreditos > 0) {
    verbas.push({
      id: 'outros_creditos',
      verba: 'Outros créditos',
      referencia: '-',
      valor: round2(step2.outrosCreditos),
      tipo: 'credito',
    });
  }

  // Outros descontos
  if (step2.outrosDescontos > 0) {
    verbas.push({
      id: 'outros_descontos',
      verba: 'Outros descontos/adiantamentos',
      referencia: '-',
      valor: round2(step2.outrosDescontos),
      tipo: 'debito',
    });
  }

  return verbas;
}

export function calcularTotal(verbas: VerbaRescisoria[]): number {
  return round2(verbas.reduce((acc, v) => v.tipo === 'credito' ? acc + v.valor : acc - v.valor, 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function diffMonthsFull(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  let total = years * 12 + months;
  if (days >= 15) total += 1;
  return Math.max(0, total);
}
