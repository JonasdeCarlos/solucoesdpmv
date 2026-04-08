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

function calcNoturnoMinutos(entrada: string, saida: string, noturnoInicio: string, noturnoFim: string): number {
  if (!entrada || !saida) return 0;
  const eMin = hhmmToMin(entrada);
  let sMin = hhmmToMin(saida);
  if (sMin <= eMin) sMin += 1440;

  const nIni = hhmmToMin(noturnoInicio);
  const nFim = hhmmToMin(noturnoFim);

  let total = 0;
  // Window 1: noturnoInicio to midnight (e.g. 22:00-24:00)
  if (nIni > nFim) {
    // crosses midnight
    const w1Start = Math.max(eMin, nIni);
    const w1End = Math.min(sMin, 1440);
    if (w1End > w1Start) total += w1End - w1Start;

    const w2Start = Math.max(eMin, 1440);
    const w2End = Math.min(sMin, 1440 + nFim);
    if (w2End > w2Start) total += w2End - w2Start;

    // Also check if entry is before midnight and exit after
    const w3Start = Math.max(eMin, 0);
    const w3End = Math.min(sMin, nFim);
    if (w3End > w3Start && eMin < nFim) total += w3End - w3Start;
  } else {
    const wStart = Math.max(eMin, nIni);
    const wEnd = Math.min(sMin, nFim);
    if (wEnd > wStart) total += wEnd - wStart;
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

  // Check order
  const mins = marks.map(hhmmToMin);
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] <= mins[i - 1]) {
      result.alertas.push(`Horários com ordem inválida no dia ${dia.dia} (saída anterior à entrada).`);
      return result;
    }
  }

  // Calculate work and intervals
  let totalWork = 0;
  let totalInterval = 0;
  let noturnoReal = 0;

  for (let i = 0; i < marks.length; i += 2) {
    const entradaMin = mins[i];
    const saidaMin = mins[i + 1];
    totalWork += saidaMin - entradaMin;

    if (params.noturnoHabilitado) {
      noturnoReal += calcNoturnoMinutos(marks[i], marks[i + 1], params.noturnoInicio, params.noturnoFim);
    }
  }

  // Intervals between pairs
  for (let i = 1; i < marks.length - 1; i += 2) {
    totalInterval += mins[i + 1] - mins[i];
  }

  result.totalTrabalhadoMin = totalWork - totalInterval; // net work
  result.totalIntervaloMin = totalInterval;
  result.noturnoRealMin = noturnoReal;
  result.noturnoConvertidoMin = Math.round(noturnoReal * 1.142857);

  // Check intrajornada
  const totalBruto = totalWork;
  if (totalBruto > 360 && totalBruto <= 480) {
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
      const lastExit = hhmmToMin(currMarks[currMarks.length - 1]);
      const firstEntry = hhmmToMin(nextMarks[0]);
      const gap = (1440 - lastExit) + firstEntry; // assuming next day
      if (gap < interjornadaMin) {
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
  };
}
