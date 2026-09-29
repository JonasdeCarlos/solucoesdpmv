import { round2 } from './rateio';

export type Regime = 'simples' | 'demais';
export const TETO_RETENCAO: Record<Regime, number> = { simples: 20, demais: 33 };

export function calcularValores(arrecadado: number, percentual: number, saldoUtilizado: number) {
  const retido = round2(arrecadado * (percentual / 100));
  const liquido = round2(arrecadado - retido + saldoUtilizado);
  return { retido, liquido };
}

export function validarValores(p: { regime: Regime; percentual: number; saldoUtilizado: number; saldoDisponivel: number; arrecadado: number }): string[] {
  const e: string[] = [];
  const teto = TETO_RETENCAO[p.regime];
  if (p.arrecadado < 0) e.push('Valor arrecadado não pode ser negativo.');
  if (p.percentual < 0) e.push('Percentual de retenção não pode ser negativo.');
  if (p.percentual > teto)
    e.push(`Retenção de ${p.percentual}% acima do teto legal de ${teto}% para ${p.regime === 'simples' ? 'Simples Nacional' : 'demais regimes'} (Lei 13.419/2017, art. 457 §6º CLT).`);
  if (p.saldoUtilizado < 0) e.push('Saldo utilizado não pode ser negativo.');
  if (round2(p.saldoUtilizado) > round2(Math.max(0, p.saldoDisponivel)))
    e.push(`Saldo utilizado acima do disponível (${fmt(Math.max(0, p.saldoDisponivel))}).`);
  return e;
}

export const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const parseNum = (s: string | number | null | undefined): number => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const t = String(s).trim().replace(/[R$\s]/g, '');
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(n) || 0;
};

export const competenciaAAAAMM = (d: string) => d.slice(0, 4) + d.slice(5, 7);
export const competenciaLabel = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;
