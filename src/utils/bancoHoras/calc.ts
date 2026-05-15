// Utilitários de cálculo do módulo Banco de Horas

export type Faixa = 'verde' | 'amarelo' | 'laranja' | 'vermelho';
export type Tendencia = 'alta' | 'queda' | 'estavel';

export function parseHHMM(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^([+\-]?)(\d{1,4}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  if (min >= 60) return null;
  return sign * (h * 60 + min);
}

export function formatHHMM(min: number | null | undefined, withSign = true): string {
  if (min == null || isNaN(min as number)) return '00:00';
  const sign = (min as number) < 0 ? '-' : '+';
  const abs = Math.abs(min as number);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const body = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (!withSign || min === 0) return body === '00:00' ? '00:00' : (min === 0 ? '00:00' : body);
  return `${sign}${body}`;
}

export function classifyFaixa(minutes: number): Faixa {
  const abs = Math.abs(minutes);
  if (abs < 16 * 60) return 'verde';
  if (abs < 31 * 60) return 'amarelo';
  if (abs < 51 * 60) return 'laranja';
  return 'vermelho';
}

export const FAIXA_LABEL: Record<Faixa, string> = {
  verde: 'Verde (até 15:59)',
  amarelo: 'Amarelo (16:00–30:59)',
  laranja: 'Laranja (31:00–50:59)',
  vermelho: 'Vermelho (51:00+)',
};

export const FAIXA_CLASS: Record<Faixa, string> = {
  verde: 'bg-green-100 text-green-800 border-green-300',
  amarelo: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  laranja: 'bg-orange-100 text-orange-900 border-orange-300',
  vermelho: 'bg-red-100 text-red-800 border-red-300',
};

export const FAIXA_DOT: Record<Faixa, string> = {
  verde: 'bg-green-500',
  amarelo: 'bg-yellow-500',
  laranja: 'bg-orange-500',
  vermelho: 'bg-red-500',
};

export function toDays(minutes: number, dailyMinutes: number): number {
  if (!dailyMinutes) return 0;
  return minutes / dailyMinutes;
}

export function classifyTrend(curr: number, prev: number | null, threshold = 60): Tendencia {
  if (prev == null) return 'estavel';
  const delta = curr - prev;
  if (delta > threshold) return 'alta';
  if (delta < -threshold) return 'queda';
  return 'estavel';
}

export function competenciaToISO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function competenciaLabel(iso: string): string {
  // iso YYYY-MM-DD → MM/YYYY
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}
