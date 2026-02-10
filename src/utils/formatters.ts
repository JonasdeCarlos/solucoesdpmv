export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function formatCurrencyInput(value: string): string {
  const num = value.replace(/\D/g, '');
  const cents = parseInt(num || '0', 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyToNumber(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export function diffMonths(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  let total = years * 12 + months;
  if (days >= 15) total += 1;
  return Math.max(0, total);
}

export function diffDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
