import type { JornadaDiaConfig, JornadaParams, JornadaDiaResultado, JornadaAnalise } from '@/types/jornada';

function hhmmToMin(hhmm: string): number {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToHHMM(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcNoturnoMinutosCrossMidnight(entradaMin: number, saidaMin: number, noturnoInicio: string, noturnoFim: string): number {
  if (saidaMin <= entradaMin) return 0;
  const nIni = hhmmToMin(noturnoInicio);
  const nFim = hhmmToMin(noturnoFim);

  let total = 0;
  // The shift may span multiple calendar days (entradaMin/saidaMin can exceed 1440).
  // We check every possible noturno window that overlaps.
  // Noturno windows repeat every 1440 min. If nIni > nFim (crosses midnight, e.g. 22-05),
  // each "day d" has a window [d*1440+nIni, (d+1)*1440+nFim].
  // If nIni < nFim (same day, e.g. 00-05), window is [d*1440+nIni, d*1440+nFim].

  const maxDay = Math.ceil(saidaMin / 1440) + 1;
  for (let d = -1; d <= maxDay; d++) {
    let wStart: number, wEnd: number;
    if (nIni >= nFim) {
      // crosses midnight: e.g. 22:00 to 05:00
      wStart = d * 1440 + nIni;
      wEnd = (d + 1) * 1440 + nFim;
    } else {
      wStart = d * 1440 + nIni;
      wEnd = d * 1440 + nFim;
    }
    const overlapStart = Math.max(entradaMin, wStart);
    const overlapEnd = Math.min(saidaMin, wEnd);
    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart;
    }
  }

  return total;
}

function calcularDia(dia: JornadaDiaConfig, params: JornadaParams): JornadaDiaResultado {
  const result: JornadaDiaResultado = {
    dia: dia.dia,
    ativo: dia.ativo,
    marcacoes: dia.marcacoes,
    totalTrabalhadoMin: 0,
    totalIntervaloMin: 0,
    noturnoRealMin: 0,
    noturnoConvertidoMin: 0,
    alertas: [],
  };

  if (!dia.ativo) return result;

  const marks = dia.marcacoes.filter(m => m && m.includes(':'));
  if (marks.length === 0) return result;

  // Check incomplete slots
  if (marks.length % 2 !== 0) {
    result.alertas.push(`Slots incompletos no dia ${dia.dia} (faltando entrada/saída).`);
    return result;
  }

  // Normalize times: if a mark is <= previous, it crossed midnight, add 1440
  const rawMins = marks.map(hhmmToMin);
  const mins = [rawMins[0]];
  for (let i = 1; i < rawMins.length; i++) {
    let val = rawMins[i];
    while (val <= mins[i - 1]) {
      val += 1440;
    }
    mins.push(val);
  }

  // Calculate work and intervals
  let totalWork = 0;
  let totalInterval = 0;
  let noturnoReal = 0;

  for (let i = 0; i < mins.length; i += 2) {
    const entradaMin = mins[i];
    const saidaMin = mins[i + 1];
    totalWork += saidaMin - entradaMin;

    if (params.noturnoHabilitado) {
      noturnoReal += calcNoturnoMinutosCrossMidnight(entradaMin, saidaMin, params.noturnoInicio, params.noturnoFim);
    }
  }

  // Intervals between pairs
  for (let i = 1; i < mins.length - 1; i += 2) {
    totalInterval += mins[i + 1] - mins[i];
  }

  result.totalTrabalhadoMin = totalWork; // work periods already exclude intervals
  result.totalIntervaloMin = totalInterval;
  result.noturnoRealMin = noturnoReal;
  result.noturnoConvertidoMin = Math.round(noturnoReal * 1.142857);

  // Check intrajornada — use gross span (work + intervals) to determine threshold
  const totalBruto = totalWork + totalInterval;
  if (totalBruto > 360) {
    // > 6h: need minimum interval
    const minIntervalo = hhmmToMin(params.intervaloMinimoAcima6h);
    if (totalInterval < minIntervalo) {
      result.alertas.push(`Intervalo intrajornada insuficiente no dia ${dia.dia} (apurado: ${minutesToHHMM(totalInterval)}; mínimo: ${params.intervaloMinimoAcima6h}).`);
    }
  } else if (totalBruto >= 240 && totalBruto <= 360) {
    // 4-6h: need 15 min
    const minIntervalo = hhmmToMin(params.intervaloMinimo4a6h);
    if (totalInterval < minIntervalo) {
      result.alertas.push(`Intervalo intrajornada insuficiente no dia ${dia.dia} (apurado: ${minutesToHHMM(totalInterval)}; mínimo: ${params.intervaloMinimo4a6h}).`);
    }
  }

  return result;
}

export function analisarJornada(dias: JornadaDiaConfig[], params: JornadaParams): JornadaAnalise {
  const resultados = dias.map(d => calcularDia(d, params));
  const totalSemanalMin = resultados.reduce((s, d) => s + d.totalTrabalhadoMin, 0);
  const cargaContratadaMin = hhmmToMin(params.cargaSemanalContratada);
  const saldoMin = totalSemanalMin - cargaContratadaMin;

  const apontamentos: string[] = [];

  // Collect day-level alerts
  resultados.forEach(d => apontamentos.push(...d.alertas));

  // Weekly > 44h
  if (totalSemanalMin > cargaContratadaMin) {
    apontamentos.push(`Jornada semanal acima de ${params.cargaSemanalContratada} (apurado: ${minutesToHHMM(totalSemanalMin)}).`);
  }

  // Interjornada check (between consecutive active days)
  const activeDays = resultados.filter(d => d.ativo && d.marcacoes.some(m => m));
  const interjornadaMin = hhmmToMin(params.interjornadaMinima);
  for (let i = 0; i < activeDays.length - 1; i++) {
    const curr = activeDays[i];
    const next = activeDays[i + 1];
    const currMarks = curr.marcacoes.filter(m => m && m.includes(':'));
    const nextMarks = next.marcacoes.filter(m => m && m.includes(':'));
    if (currMarks.length >= 2 && nextMarks.length >= 2) {
      // Normalize the last exit: reconstruct the normalized time
      const currRaw = currMarks.map(hhmmToMin);
      const currNorm = [currRaw[0]];
      for (let j = 1; j < currRaw.length; j++) {
        let v = currRaw[j];
        while (v <= currNorm[j - 1]) v += 1440;
        currNorm.push(v);
      }
      const lastExitNorm = currNorm[currNorm.length - 1]; // may be > 1440 if cross-midnight
      const firstEntry = hhmmToMin(nextMarks[0]);
      // Gap = time from last exit to next entry (next calendar day)
      const nextEntryAbsolute = 1440 + firstEntry; // next day's entry
      const gap = nextEntryAbsolute - lastExitNorm;
      if (gap > 0 && gap < interjornadaMin) {
        apontamentos.push(`Interjornada inferior a ${params.interjornadaMinima} entre ${curr.dia} e ${next.dia} (apurado: ${minutesToHHMM(gap)}).`);
      }
    }
  }

  // DSR check (at least 1 day without work)
  const diasSemJornada = resultados.filter(d => !d.ativo || d.totalTrabalhadoMin === 0);
  if (diasSemJornada.length === 0) {
    apontamentos.push('Ausência de descanso semanal (nenhum dia sem jornada na semana).');
  }

  const statusGeral = apontamentos.length === 0 ? 'ok' : (apontamentos.some(a => a.includes('insuficiente') || a.includes('inferior') || a.includes('inválida') || a.includes('Ausência')) ? 'critico' : 'atencao');

  return {
    dias: resultados,
    totalSemanalMin,
    cargaContratadaMin,
    saldoMin,
    statusGeral,
    apontamentos,
    tempoParcial: avaliarTempoParcial(totalSemanalMin),
  };
}

// Art. 58-A da CLT: tempo parcial = até 30h/semana sem horas suplementares,
// ou até 26h/semana com acréscimo de até 6 horas suplementares semanais.
export function avaliarTempoParcial(totalSemanalMin: number): import('@/types/jornada').TempoParcialAnalise {
  const total = minutesToHHMM(totalSemanalMin);
  if (totalSemanalMin === 0) {
    return {
      elegivel: false,
      modalidade: null,
      titulo: 'Não avaliado',
      detalhe: 'Não há marcações suficientes para avaliar o enquadramento em contrato a tempo parcial (art. 58-A da CLT).',
    };
  }
  if (totalSemanalMin <= 26 * 60) {
    return {
      elegivel: true,
      modalidade: '26h',
      titulo: 'Passível de contrato a tempo parcial',
      detalhe: `A jornada semanal apurada (${total}) não excede 26 horas, enquadrando-se no art. 58-A, caput, da CLT (modalidade de até 26h semanais, com possibilidade de acréscimo de até 6 horas suplementares por semana, pagas com adicional mínimo de 50%).`,
    };
  }
  if (totalSemanalMin <= 30 * 60) {
    return {
      elegivel: true,
      modalidade: '30h',
      titulo: 'Passível de contrato a tempo parcial',
      detalhe: `A jornada semanal apurada (${total}) não excede 30 horas, enquadrando-se no art. 58-A, caput, da CLT (modalidade de até 30h semanais, vedada a realização de horas suplementares).`,
    };
  }
  return {
    elegivel: false,
    modalidade: null,
    titulo: 'Não passível de contrato a tempo parcial',
    detalhe: `A jornada semanal apurada (${total}) supera o limite de 30 horas previsto no art. 58-A da CLT, não sendo cabível a celebração de contrato a tempo parcial. Deve ser mantido o regime de jornada integral.`,
  };
}
