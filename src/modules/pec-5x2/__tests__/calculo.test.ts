import { describe, it, expect } from 'vitest';
import { calcular, PARAMS_PADRAO, MARCOS_PADRAO, type Setor } from '../calculo';

const semRep = { ...PARAMS_PADRAO, indices_reposicao: { ativo: false, ferias: 0, absenteismo: 0, arredondar: true } };
const m1 = MARCOS_PADRAO[1], m2 = MARCOS_PADRAO[2];

describe('necessidade de contratação', () => {
  it('modo A com compensação: 10 × 44h ÷ 40h = 11', () => {
    const s: Setor = { nome: 'Loja', funcionarios_atuais: 10, regime_compensacao: 'semanal' };
    const r = calcular(s, semRep, m2, true);
    expect(r.necessidade).toBe(11);
    expect(r.gap).toBe(1);
  });
  it('sem compensação, 42h em 5 dias gera alerta e limita a 40h', () => {
    const r = calcular({ nome: 'X', funcionarios_atuais: 10 }, semRep, m1, false);
    expect(r.jornadaEfetiva).toBe(40);
    expect(r.alertas.some((a) => a.includes('8h24'))).toBe(true);
  });
  it('reposição de férias 8,33% aumenta a necessidade', () => {
    const r = calcular({ nome: 'X', funcionarios_atuais: 10, regime_compensacao: 'semanal' }, PARAMS_PADRAO, m2, true);
    expect(r.necessidade).toBeCloseTo(11.92, 2);
    expect(r.arredondada).toBe(12);
  });
  it('modo B: cobertura de 7 dias com 3 postos em 5x2 exige 4,2', () => {
    const dia = { aberto: true, turnos: [{ ini: '08:00', fim: '12:00' }] };
    const s: Setor = { nome: 'B', funcionarios_atuais: 3, postos: [{ ini: '08:00', fim: '12:00', postos: 3 }],
      funcionamento: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, dia])) };
    const r = calcular(s, semRep, m2, false);
    expect(r.necCobertura).toBeCloseTo(4.2, 2);
    expect(r.arredondada).toBe(5);
  });
});
