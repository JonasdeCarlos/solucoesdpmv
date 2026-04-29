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

/** Normalize markings into a continuous timeline, adding 24h when a marking crosses midnight. */
function normalizeMarks(marks: number[]): number[] {
  const normalized: number[] = [];

  marks.forEach((mark, index) => {
    let value = mark;
    if (index > 0) {
      while (value <= normalized[index - 1]) value += 24 * 60;
    }
    normalized.push(value);
  });

  return normalized;
}

/** Calculate overlap in minutes against a daily recurring window on an absolute minute timeline. */
function overlapRecurringWindow(workStart: number, workEnd: number, winStart: number, winEnd: number): number {
  if (workEnd <= workStart) return 0;

  let total = 0;
  const maxDay = Math.ceil(workEnd / (24 * 60)) + 1;

  for (let day = -1; day <= maxDay; day++) {
    const base = day * 24 * 60;
    const start = base + winStart;
    const end = base + (winStart >= winEnd ? 24 * 60 + winEnd : winEnd);
    const overlapStart = Math.max(workStart, start);
    const overlapEnd = Math.min(workEnd, end);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
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

  // Parse all valid markings. Empty interval fields are ignored, so a night shift can be
  // entered only as Entrada/Saída (e.g. 19:00 → 06:30) even in the 4-column layout.
  const validMarks = dia.marcacoes.map(m => parseHHMM(m)).filter(m => !isNaN(m));

  if (validMarks.length < 2) {
    // Not enough markings to calculate
    const cumprir = parseHHMM(dia.horasACumprir);
    if (!isNaN(cumprir) && (dia.tipoDia === 'normal' || dia.tipoDia === 'feriado')) {
      result.saldoMinutos = -cumprir;
      result.saldoAntesTolerancia = -cumprir;
    }
    return result;
  }

  const normalizedMarks = normalizeMarks(validMarks);

  // Calculate as pairs: Entrada/Saída, Entrada/Saída... This supports both
  // full interval markings and direct overnight pairs without forcing the last column.
  let totalTrabalho = 0;
  for (let i = 0; i < normalizedMarks.length - 1; i += 2) {
    totalTrabalho += normalizedMarks[i + 1] - normalizedMarks[i];
  }

  let totalIntervalos = 0;
  for (let i = 1; i < normalizedMarks.length - 1; i += 2) {
    totalIntervalos += normalizedMarks[i + 1] - normalizedMarks[i];
  }

  result.trabalhoBruto = totalTrabalho + totalIntervalos;
  result.intervalos = totalIntervalos;
  result.trabalhoLiquido = totalTrabalho;

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
    let nightWork = 0;
    for (let i = 0; i < normalizedMarks.length - 1; i += 2) {
      nightWork += overlapRecurringWindow(normalizedMarks[i], normalizedMarks[i + 1], noturnoInicio, noturnoFim);
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
