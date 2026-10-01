import { describe, it, expect } from 'vitest';
import { calcular, reverso, percQuinquenio, DEFAULT_RUBRICAS, DEFAULT_MODELO, type Params } from '../motor';
import { gerarTxt } from '../exportTxt';

const base = (over: Partial<Params> = {}): Params => ({ salario: 1750, admissao: '2014-01-01', competencia: '2026-08', diasUteis: 25, diasDsr: 5, divisor: 220, formato: 'hhmm', rubricas: DEFAULT_RUBRICAS, ...over });
const min = (h: number, m: number) => h * 60 + m;

describe('bruto alvo', () => {
  it('teste 1', () => {
    const r = calcular(base(), { AD_NOT: min(38, 2), HE60: min(14, 51), HE120: min(7, 9), HE120_DOM: min(8, 5) });
    expect(r.valorQuinq).toBe(175);
    expect(r.horaBase).toBeCloseTo(8.75, 8);
    expect(r.variaveis.map((v) => v.valor)).toEqual([66.56, 207.9, 137.64, 155.6]);
    expect(r.dsrNoturno).toBe(13.31);
    expect(r.dsrExtras).toBe(100.23);
    expect(r.bruto).toBe(2606.24);
  });
  it('teste 2', () => {
    const r = calcular(base({ admissao: '2024-01-01' }), { AD_NOT: min(49, 54) });
    expect(r.variaveis[0].valor).toBe(79.39);
  });
  it('teste 3', () => {
    expect([4, 5, 9, 10, 11, 14, 15].map((a) => percQuinquenio(a))).toEqual([0, 5, 5, 10, 10, 10, 15]);
  });
  it('teste 4', () => {
    const p = base();
    const r = reverso(p, DEFAULT_MODELO, 2500);
    expect(Math.abs(r.diferenca)).toBeLessThanOrEqual(0.05);
    const txt = gerarTxt([{ codigo: '25', unidades: r.unidades }], p.rubricas.map((x) => ({ ...x, codigo_rubrica_dominio: '100' })), 'hhmm', '202608', '11', '1');
    expect(txt.erros).toEqual([]);
    expect(txt.linhas.length).toBe(Object.values(r.unidades).filter((u) => u > 0).length);
    expect(txt.conteudo).toMatch(/\r\n$/);
  });
});
