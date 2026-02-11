import { type PontoDia, type PontoDiaCalculado, type PontoConfig } from '@/types/ponto';

/** Parse "hh:mm" to total minutes. Returns NaN if invalid. */
export function parseHHMM(val: string): number {
  if (!val || val.length < 5) return NaN;
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

/** Format minutes to "hh:mm". Handles negatives with "-" prefix. */
export function minutesToHHMM(mins: number): string {
  if (isNaN(mins)) return '--:--';
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format raw 4-digit input to hh:mm */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

/** Validate a "hh:mm" string */
export function isValidTime(val: string): boolean {
  return !isNaN(parseHHMM(val));
}

/** Calculate minutes between two times, handling overnight (next day) */
function diffMinutes(start: number, end: number): number {
  if (end >= start) return end - start;
  return (24 * 60 - start) + end; // overnight
}

/** Calculate overlap in minutes between [a1,a2) and [b1,b2), handling overnight windows */
function overlapMinutes(workStart: number, workEnd: number, winStart: number, winEnd: number): number {
  // Normalize overnight ranges by extending to next day concept
  const ranges: [number, number][] = [];
  
  // Work range
  const wRanges: [number, number][] = [];
  if (workEnd > workStart) {
    wRanges.push([workStart, workEnd]);
  } else if (workEnd < workStart) {
    // overnight work
    wRanges.push([workStart, 24 * 60]);
    wRanges.push([0, workEnd]);
  }

  // Night window range
  const nRanges: [number, number][] = [];
  if (winEnd > winStart) {
    nRanges.push([winStart, winEnd]);
  } else if (winEnd < winStart) {
    // overnight window (e.g. 22:00-05:00)
    nRanges.push([winStart, 24 * 60]);
    nRanges.push([0, winEnd]);
  }

  let total = 0;
  for (const w of wRanges) {
    for (const n of nRanges) {
      const start = Math.max(w[0], n[0]);
      const end = Math.min(w[1], n[1]);
      if (end > start) total += end - start;
    }
  }

  return total;
}

export function calcularDia(dia: PontoDia, config: PontoConfig): PontoDiaCalculado {
  const result: PontoDiaCalculado = {
    ...dia,
    trabalhoBruto: 0,
    intervalos: 0,
    trabalhoLiquido: 0,
    saldoMinutos: 0,
    saldoAntesTolerancia: 0,
    noturnoReal: 0,
    noturnoConvertido: 0,
    alertaIntervalo: false,
    intervaloDevido: 0,
  };

  // Parse all valid markings
  const marks = dia.marcacoes.map(m => parseHHMM(m));
  const validMarks = marks.filter(m => !isNaN(m));

  if (validMarks.length < 2) {
    // Not enough markings to calculate
    const cumprir = parseHHMM(dia.horasACumprir);
    if (!isNaN(cumprir) && (dia.tipoDia === 'normal' || dia.tipoDia === 'feriado')) {
      result.saldoMinutos = -cumprir;
      result.saldoAntesTolerancia = -cumprir;
    }
    return result;
  }

  // Calculate based on pairs: Entry/Exit pattern
  // For 4 marks: [entry, exitInt, entryInt, exit]
  // For 6 marks: [entry, exitInt1, entryInt1, exitInt2, entryInt2, exit]
  const numMarks = dia.marcacoes.length;
  const entrada = marks[0];
  const saida = marks[numMarks - 1];

  if (isNaN(entrada) || isNaN(saida)) {
    const cumprir = parseHHMM(dia.horasACumprir);
    if (!isNaN(cumprir) && dia.tipoDia === 'normal') {
      result.saldoMinutos = -cumprir;
      result.saldoAntesTolerancia = -cumprir;
    }
    return result;
  }

  // Gross work
  result.trabalhoBruto = diffMinutes(entrada, saida);

  // Calculate intervals (pairs of exits/entries in the middle)
  let totalIntervalos = 0;
  // Middle marks form interval pairs: [1,2], [3,4] for 6-mark mode; [1,2] for 4-mark mode
  for (let i = 1; i < numMarks - 1; i += 2) {
    const exitInt = marks[i];
    const entryInt = marks[i + 1];
    if (!isNaN(exitInt) && !isNaN(entryInt)) {
      totalIntervalos += diffMinutes(exitInt, entryInt);
    }
  }
  result.intervalos = totalIntervalos;
  result.trabalhoLiquido = result.trabalhoBruto - totalIntervalos;

  // Interval alert
  const intervaloMin = parseHHMM(config.intervaloMinimo);
  if (!isNaN(intervaloMin) && totalIntervalos < intervaloMin && totalIntervalos > 0) {
    result.alertaIntervalo = true;
    result.intervaloDevido = intervaloMin - totalIntervalos;
  }
  if (totalIntervalos === 0 && result.trabalhoLiquido > 6 * 60) {
    // No interval registered but worked > 6h
    result.alertaIntervalo = true;
    result.intervaloDevido = intervaloMin || 60;
  }

  // Hours to fulfill
  const cumprir = parseHHMM(dia.horasACumprir);
  const cumprirVal = isNaN(cumprir) ? 0 : cumprir;

  result.saldoAntesTolerancia = result.trabalhoLiquido - cumprirVal;
  result.saldoMinutos = result.saldoAntesTolerancia;

  // Tolerance
  if (config.tolerancia10min && Math.abs(result.saldoMinutos) <= 10) {
    result.saldoMinutos = 0;
  }

  // Night hours calculation
  const noturnoInicio = parseHHMM(config.noturnoInicio);
  const noturnoFim = parseHHMM(config.noturnoFim);

  if (!isNaN(noturnoInicio) && !isNaN(noturnoFim)) {
    // Total night work = overlap of gross period minus overlap of intervals
    let nightWork = overlapMinutes(entrada, saida, noturnoInicio, noturnoFim);

    // Subtract interval overlaps with night window
    for (let i = 1; i < numMarks - 1; i += 2) {
      const exitInt = marks[i];
      const entryInt = marks[i + 1];
      if (!isNaN(exitInt) && !isNaN(entryInt)) {
        nightWork -= overlapMinutes(exitInt, entryInt, noturnoInicio, noturnoFim);
      }
    }

    result.noturnoReal = Math.max(0, nightWork);
    result.noturnoConvertido = Math.round(result.noturnoReal * 1.142857);
  }

  return result;
}

export interface PontoResumo {
  totalTrabalhado: number;
  totalACumprir: number;
  totalSaldoPositivo: number;
  totalSaldoNegativo: number;
  saldoFinal: number;
  totalFeriados: number;
  totalFolgasDsr: number;
  totalNoturnoReal: number;
  totalNoturnoConvertido: number;
  totalIntervaloDevido: number;
}

export function calcularResumo(dias: PontoDiaCalculado[]): PontoResumo {
  const resumo: PontoResumo = {
    totalTrabalhado: 0,
    totalACumprir: 0,
    totalSaldoPositivo: 0,
    totalSaldoNegativo: 0,
    saldoFinal: 0,
    totalFeriados: 0,
    totalFolgasDsr: 0,
    totalNoturnoReal: 0,
    totalNoturnoConvertido: 0,
    totalIntervaloDevido: 0,
  };

  for (const d of dias) {
    resumo.totalTrabalhado += d.trabalhoLiquido;
    resumo.totalACumprir += parseHHMM(d.horasACumprir) || 0;

    if (d.saldoMinutos > 0) resumo.totalSaldoPositivo += d.saldoMinutos;
    if (d.saldoMinutos < 0) resumo.totalSaldoNegativo += d.saldoMinutos;

    if (d.tipoDia === 'feriado') resumo.totalFeriados += d.trabalhoLiquido;
    if (d.tipoDia === 'folga_dsr') resumo.totalFolgasDsr += d.trabalhoLiquido;

    resumo.totalNoturnoReal += d.noturnoReal;
    resumo.totalNoturnoConvertido += d.noturnoConvertido;
    resumo.totalIntervaloDevido += d.intervaloDevido;
  }

  resumo.saldoFinal = resumo.totalSaldoPositivo + resumo.totalSaldoNegativo;

  return resumo;
}
