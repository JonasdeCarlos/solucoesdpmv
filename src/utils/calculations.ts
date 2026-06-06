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
  termino_contrato: 'POR TÉRMINO DE CONTRATO POR PRAZO DETERMINADO/EXPERIÊNCIA',
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
  calcula13AnosAnteriores: boolean;
  anos13Selecionados: number[];
}

export interface Step2Data {
  diasTrabalhadosMes: number;
  meses13Proporcional: number;
  mesesFeriasProporcional: number;
  consideraTercoFerias: boolean;
  outrosDescontos: LinhaExtra[];
  outrosCreditos: LinhaExtra[];
  incluir13AnosAnteriores: boolean;
  fgtsManual: number | null;
}

export type TipoCalculoLinha = 'manual' | 'dias' | 'horas' | 'hora_extra' | 'adicional_noturno';

export interface LinhaExtra {
  id?: string;
  descricao: string;
  valor: number;
  tipoCalculo?: TipoCalculoLinha;
  quantidade?: number;
  adicionalPercent?: number;
  _horaInput?: string;
  calculaDSR?: boolean;
  diasUteis?: number;
  diasNaoUteis?: number;
  isDSR?: boolean;
  dsrParentId?: string;
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
  localAssinatura: string;
  dataAssinatura: string;
}

export function calcularVerbas(step1: Step1Data, step2: Step2Data): VerbaRescisoria[] {
  const verbas: VerbaRescisoria[] = [];
  const sal = step1.salarioMensal;

  // Saldo de salário (teto: 30/30 = salário integral)
  const diasSaldo = Math.min(step2.diasTrabalhadosMes, 30);
  const saldoSalario = diasSaldo >= 30 ? sal : (sal / 30) * diasSaldo;
  verbas.push({
    id: 'saldo_salario',
    verba: 'Saldo de salário',
    referencia: `${diasSaldo}/30 dias`,
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

  // Aviso prévio indenizado + dias por ano completo + reflexos (projeção)
  if (step1.calculaAvisoPrevioIndenizado) {
    const diasAvisoBase = step1.diasAvisoPrevioIndenizado;
    const avisoBase = (sal / 30) * diasAvisoBase;
    verbas.push({
      id: 'aviso_previo_indenizado',
      verba: 'Aviso prévio indenizado',
      referencia: `${diasAvisoBase} dias`,
      valor: round2(avisoBase),
      tipo: 'credito',
    });

    // Dias indenizados por ano completo (3 dias por ano completo de serviço)
    let anosCompletos = 0;
    if (step1.dataAdmissao && step1.dataDesligamento) {
      const totalMeses = diffMonthsFull(step1.dataAdmissao, step1.dataDesligamento);
      anosCompletos = Math.floor(totalMeses / 12);
    }
    const diasPorAno = anosCompletos * 3;
    let valorDiasPorAno = 0;
    if (diasPorAno > 0) {
      valorDiasPorAno = (sal / 30) * diasPorAno;
      verbas.push({
        id: 'dias_indenizados_ano',
        verba: 'Dias indenizados por ano completo',
        referencia: `${anosCompletos} ano(s) × 3 = ${diasPorAno} dias`,
        valor: round2(valorDiasPorAno),
        tipo: 'credito',
      });
    }

    // Total de dias para projeção = aviso base + dias por ano
    const diasTotalProjecao = diasAvisoBase + diasPorAno;
    const mesesProjecao = diasTotalProjecao / 30;
    const avosProjecao = Math.round(mesesProjecao);

    // Projeção no 13º
    const reflexo13 = (sal / 12) * mesesProjecao;
    verbas.push({
      id: 'reflexo_aviso_13',
      verba: '13º salário — projeção aviso prévio',
      referencia: `${avosProjecao}/12 avos`,
      valor: round2(reflexo13),
      tipo: 'credito',
    });

    // Projeção nas férias
    const reflexoFerias = (sal / 12) * mesesProjecao;
    verbas.push({
      id: 'reflexo_aviso_ferias',
      verba: 'Férias — projeção aviso prévio',
      referencia: `${avosProjecao}/12 avos`,
      valor: round2(reflexoFerias),
      tipo: 'credito',
    });

    // 1/3 sobre férias da projeção
    if (step2.consideraTercoFerias) {
      const tercoReflexo = reflexoFerias / 3;
      verbas.push({
        id: 'reflexo_aviso_terco',
        verba: '1/3 férias — projeção aviso prévio',
        referencia: '1/3',
        valor: round2(tercoReflexo),
        tipo: 'credito',
      });
    }
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
      // Calcula base FGTS mês a mês: salário/30 × dias trabalhados no mês
      let baseFGTS = 0;
      if (step1.dataAdmissao && step1.dataDesligamento) {
        const start = new Date(step1.dataAdmissao);
        const end = new Date(step1.dataDesligamento);

        // Itera mês a mês do contrato
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cursor.getFullYear() < end.getFullYear() || 
               (cursor.getFullYear() === end.getFullYear() && cursor.getMonth() <= end.getMonth())) {
          const year = cursor.getFullYear();
          const month = cursor.getMonth();
          const totalDiasNoMes = new Date(year, month + 1, 0).getDate();

          const isFirstMonth = year === start.getFullYear() && month === start.getMonth();
          const isLastMonth = year === end.getFullYear() && month === end.getMonth();

          let diasTrabalhados: number;
          if (isFirstMonth && isLastMonth) {
            // Usa o mesmo nº de dias informado pelo usuário (saldo de salário)
            diasTrabalhados = Math.min(step2.diasTrabalhadosMes, 30);
          } else if (isFirstMonth) {
            const diasReais = totalDiasNoMes - start.getDate() + 1;
            diasTrabalhados = start.getDate() === 1 ? 30 : diasReais;
          } else if (isLastMonth) {
            // Mês do desligamento: usa o mesmo valor informado no saldo de salário
            diasTrabalhados = Math.min(step2.diasTrabalhadosMes, 30);
          } else {
            // Mês completo: sempre salário integral (padrão CLT)
            diasTrabalhados = 30;
          }

          // FGTS: mês completo = salário integral; parcial = proporcional
          baseFGTS += diasTrabalhados >= 30 ? sal : (sal / 30) * diasTrabalhados;

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

    // FGTS sobre aviso prévio indenizado, dias por ano e reflexos
    let fgtsSobreAviso = 0;
    if (step1.calculaAvisoPrevioIndenizado) {
      const diasAvisoBase = step1.diasAvisoPrevioIndenizado;
      let anosComp = 0;
      if (step1.dataAdmissao && step1.dataDesligamento) {
        anosComp = Math.floor(diffMonthsFull(step1.dataAdmissao, step1.dataDesligamento) / 12);
      }
      const diasPorAno = anosComp * 3;
      const diasTotalProj = diasAvisoBase + diasPorAno;
      const avisoVal = (sal / 30) * diasAvisoBase;
      const valDiasPorAno = (sal / 30) * diasPorAno;
      const mesesProj = diasTotalProj / 30;
      const reflexo13 = (sal / 12) * mesesProj;
      const reflexoFerias = (sal / 12) * mesesProj;
      const tercoReflexo = step2.consideraTercoFerias ? reflexoFerias / 3 : 0;
      const baseAviso = avisoVal + valDiasPorAno + reflexo13 + reflexoFerias + tercoReflexo;
      fgtsSobreAviso = baseAviso * 0.08;
      verbas.push({
        id: 'fgts_aviso',
        verba: 'FGTS sobre aviso prévio e reflexos',
        referencia: '8%',
        valor: round2(fgtsSobreAviso),
        tipo: 'credito',
      });
    }

    // Multa FGTS (sobre FGTS total + FGTS aviso)
    if (step1.calculaMultaFGTS && step1.percentualMultaFGTS > 0) {
      const fgtsTotalComAviso = fgtsTotal + fgtsSobreAviso;
      const multa = fgtsTotalComAviso * (step1.percentualMultaFGTS / 100);
      verbas.push({
        id: 'multa_fgts',
        verba: 'Multa FGTS',
        referencia: `${step1.percentualMultaFGTS}%`,
        valor: round2(multa),
        tipo: 'credito',
      });
    }
  }

  // 13º de anos anteriores
  if (step1.calcula13AnosAnteriores && step1.anos13Selecionados.length > 0) {
    for (const ano of step1.anos13Selecionados) {
      // Verificar quantos meses trabalhou naquele ano
      const inicioAno = new Date(ano, 0, 1);
      const fimAno = new Date(ano, 11, 31);
      const inicioEfetivo = step1.dataAdmissao && step1.dataAdmissao > inicioAno ? step1.dataAdmissao : inicioAno;
      const fimEfetivo = step1.dataDesligamento && step1.dataDesligamento < fimAno ? step1.dataDesligamento : fimAno;
      const mesesNoAno = Math.min(12, diffMonthsFull(inicioEfetivo, fimEfetivo));
      const valor13Ano = sal * (mesesNoAno / 12);
      verbas.push({
        id: `13_ano_${ano}`,
        verba: `13º salário — ${ano}`,
        referencia: `${mesesNoAno}/12`,
        valor: round2(valor13Ano),
        tipo: 'credito',
      });
    }
  }

  // Outros créditos (múltiplas linhas)
  if (step2.outrosCreditos.length > 0) {
    step2.outrosCreditos.forEach((c, idx) => {
      if (c.valor > 0) {
        verbas.push({
          id: `outros_creditos_${idx}`,
          verba: c.descricao || 'Outros créditos',
          referencia: '-',
          valor: round2(c.valor),
          tipo: 'credito',
        });
      }
    });
  }

  // Outros descontos (múltiplas linhas)
  if (step2.outrosDescontos.length > 0) {
    step2.outrosDescontos.forEach((d, idx) => {
      if (d.valor > 0) {
        verbas.push({
          id: `outros_descontos_${idx}`,
          verba: d.descricao || 'Outros descontos',
          referencia: '-',
          valor: round2(d.valor),
          tipo: 'debito',
        });
      }
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
