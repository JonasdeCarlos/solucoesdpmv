import { describe, it, expect } from 'vitest';
import { calcular, necessidadePorDia, timelineDia, PARAMS_PADRAO, MARCOS_PADRAO, type Setor } from '../calculo';

const semRep = { ...PARAMS_PADRAO, indices_reposicao: { ativo: false, ferias: 0, absenteismo: 0, arredondar: true } };
const m1 = MARCOS_PADRAO[1], m2 = MARCOS_PADRAO[2];

describe('necessidade de contratação', () => {
  it('barras representam o quadro diário de cada marco, não a demanda de 30 pessoas no pico', () => {
    const s: Setor = { nome: 'Camararia', funcionarios_atuais: 23,
      funcionamento: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map(d => [d, { aberto: true, turnos: [{ ini: '08:00', fim: '18:00' }] }])),
      intensidade_dias: { '1': 'pico' } };
    const atual = necessidadePorDia(s, semRep, MARCOS_PADRAO[0]).find(l => l.dia === '1');
    const futuro = necessidadePorDia(s, semRep, m2).find(l => l.dia === '1');
    expect(atual?.pessoas).toBe(30);
    expect(futuro?.pessoas).toBe(30);
    expect(atual?.escalados).toBe(19);
    expect(futuro?.escalados).toBe(18);
    if (!atual || !futuro) throw new Error('Dia aberto ausente');
    expect(timelineDia(s, atual).barras).toHaveLength(19);
    expect(timelineDia(s, futuro).barras).toHaveLength(18);
    expect(futuro.deficit).toBe(12);
    expect(timelineDia(s, futuro).barras.every(b => b.ini >= 480 && b.fim <= 1080)).toBe(true);
  });
  it.each([false, true])('disponibilidade diária não excede o quadro do marco (com postos: %s)', postos => {
    const s: Setor = { nome: 'Loja', funcionarios_atuais: 2,
      funcionamento: { '1': { aberto: true, turnos: [{ ini: '08:00', fim: '12:00' }] } },
      postos: postos ? [{ ini: '08:00', fim: '12:00', postos: 2 }] : [] };
    const r = calcular(s, semRep, m2, true);
    const [dia] = necessidadePorDia(s, semRep, m2);
    expect(dia.escalados).toBe(r.arredondada);
    expect(timelineDia(s, dia).barras).toHaveLength(r.arredondada);
  });
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
