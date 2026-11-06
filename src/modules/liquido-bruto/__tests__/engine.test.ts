import { describe, it, expect } from 'vitest';
import { calcularBruto, calcularLiquido, parametrosVazios, ErroSimulacao, escolherVigencia, type TabelasLegais } from '../engine';

// Seed 2026 (igual ao gravado nas tabelas lb_*)
const T2026: TabelasLegais = {
  vigencia_inicio: '2026-01-01',
  inss: [
    { faixa: 1, limite_superior: 1621.0, aliquota: 0.075, parcela_deduzir: 0 },
    { faixa: 2, limite_superior: 2902.84, aliquota: 0.09, parcela_deduzir: 24.32 },
    { faixa: 3, limite_superior: 4354.27, aliquota: 0.12, parcela_deduzir: 111.4 },
    { faixa: 4, limite_superior: 8475.55, aliquota: 0.14, parcela_deduzir: 198.49 },
  ],
  irrf: [
    { faixa: 1, limite_superior: 2428.8, aliquota: 0, parcela_deduzir: 0 },
    { faixa: 2, limite_superior: 2826.65, aliquota: 0.075, parcela_deduzir: 182.16 },
    { faixa: 3, limite_superior: 3751.05, aliquota: 0.15, parcela_deduzir: 394.16 },
    { faixa: 4, limite_superior: 4664.68, aliquota: 0.225, parcela_deduzir: 675.49 },
    { faixa: 5, limite_superior: null, aliquota: 0.275, parcela_deduzir: 908.73 },
  ],
  parametros: {
    deducao_dependente: 189.59,
    desconto_simplificado: 607.2,
    redutor_limite_isencao: 5000,
    redutor_valor_max: 312.89,
    redutor_limite_final: 7350,
    redutor_constante: 978.62,
    redutor_coeficiente: 0.133145,
  },
};

describe('Líquido → Bruto — casos obrigatórios 2026', () => {
  it('A: líquido 2.000 sem descontos opcionais → bruto 2.171,08', () => {
    const r = calcularBruto(2000, parametrosVazios(), T2026);
    expect(r.bruto).toBe(2171.08);
    expect(r.inss).toBe(171.08);
    expect(r.irrf).toBe(0);
  });

  it('B: líquido 4.000 → bruto 4.420,36', () => {
    const r = calcularBruto(4000, parametrosVazios(), T2026);
    expect(r.bruto).toBe(4420.36);
    expect(r.inss).toBe(420.36);
    expect(r.irrf).toBe(0);
  });

  it('C: líquido 5.000 com 1 dependente → bruto 5.947,95 (IRRF 313,73)', () => {
    const r = calcularBruto(5000, { ...parametrosVazios(), dependentes: 1 }, T2026);
    expect(r.bruto).toBe(5947.95);
    expect(r.inss).toBe(634.22);
    expect(r.baseIrrfLegal).toBe(5124.14);
    expect(r.impostoLegal).toBe(500.41);
    expect(r.impostoSimplificado).toBe(559.98);
    expect(r.regimeIrrf).toBe('legal');
    expect(r.reducaoLei15270).toBe(186.68);
    expect(r.irrf).toBe(313.73);
  });

  it('D: líquido 3.000 com assistencial 1% e VT custo 220 → bruto 3.566,17', () => {
    const p = parametrosVazios();
    p.assistencial = { ativo: true, tipo: 'percentual', valor: 1 };
    p.vt = { ativo: true, custo: 220 };
    const r = calcularBruto(3000, p, T2026);
    expect(r.bruto).toBe(3566.17);
    expect(r.inss).toBe(316.54);
    expect(r.irrf).toBe(0);
    expect(r.assistencial).toBe(35.66);
    expect(r.vt).toBe(213.97);
  });

  it('E: líquido 6.500, 2 dep., assistencial fixa 35, outros 150 → bruto 8.811,53', () => {
    const p = parametrosVazios();
    p.dependentes = 2;
    p.assistencial = { ativo: true, tipo: 'fixo', valor: 35 };
    p.outros = { ativo: true, itens: [{ descricao: 'Plano de saúde', tipo: 'fixo', valor: 150 }] };
    const r = calcularBruto(6500, p, T2026);
    expect(r.bruto).toBe(8811.53);
    expect(r.inss).toBe(988.09);
    expect(r.irrf).toBe(1138.44);
    expect(r.assistencial).toBe(35);
  });

  it('F: líquido 12.000 → bruto 16.286,39 (INSS no teto)', () => {
    const r = calcularBruto(12000, parametrosVazios(), T2026);
    expect(r.bruto).toBe(16286.39);
    expect(r.inss).toBe(988.09);
    expect(r.irrf).toBe(3298.3);
  });
});

describe('Regras do motor', () => {
  it('cargo de confiança compõe o bruto com 40% do salário-base e tributa o total', () => {
    const p = { ...parametrosVazios(), cargoConfianca: true };
    const r = calcularBruto(4000, p, T2026);
    expect(r.salarioBase).toBe(3157.4);
    expect(r.adicionalCargoConfianca).toBe(1262.96);
    expect(r.bruto).toBe(4420.36);
    expect(r.inss).toBe(420.36);
    expect(r.liquido).toBe(4000);
  });

  it('cargo de confiança mantém a composição de 40% ao arredondar e alcança o líquido desejado', () => {
    const p = { ...parametrosVazios(), cargoConfianca: true };
    for (const alvo of [2000, 3000, 5000, 6500, 12000]) {
      const r = calcularBruto(alvo, p, T2026);
      expect(Math.round(r.adicionalCargoConfianca * 100)).toBe(Math.round(r.salarioBase * 40));
      expect(Math.round(r.bruto * 100)).toBe(Math.round(r.salarioBase * 100) + Math.round(r.adicionalCargoConfianca * 100));
      expect(r.liquido).toBeGreaterThanOrEqual(alvo);
      expect(r.diferencaArredondamento).toBeLessThanOrEqual(0.02);
    }
  });

  it('sem cargo de confiança, todo o bruto permanece salário-base', () => {
    const r = calcularBruto(4000, parametrosVazios(), T2026);
    expect(r.salarioBase).toBe(4420.36);
    expect(r.adicionalCargoConfianca).toBe(0);
  });
  it('VT desconta o menor entre 6% do salário e o custo do VT', () => {
    const p = parametrosVazios();
    p.vt = { ativo: true, custo: 100 };
    expect(calcularLiquido(3000, p, T2026).vt).toBe(100);
    p.vt = { ativo: true, custo: 500 };
    expect(calcularLiquido(3000, p, T2026).vt).toBe(180);
  });

  it('VT ligado sem custo informado desconta 6% do bruto automaticamente', () => {
    const p = parametrosVazios();
    p.vt = { ativo: true, custo: 0 };
    expect(calcularLiquido(3000, p, T2026).vt).toBe(180);
  });

  it('pensão deduz da base do IRRF só no regime de deduções legais', () => {
    const p = parametrosVazios();
    p.pensao = { ativo: true, tipo: 'fixo', valor: 1000 };
    const r = calcularLiquido(10000, p, T2026);
    expect(r.baseIrrfSimplificada).toBe(10000 - 607.2);
    expect(r.baseIrrfLegal).toBe(10000 - 988.09 - 1000);
  });

  it('bloqueia quando os percentuais somam 60% ou mais', () => {
    const p = parametrosVazios();
    p.pensao = { ativo: true, tipo: 'percentual', valor: 50 };
    p.assistencial = { ativo: true, tipo: 'percentual', valor: 10 };
    expect(() => calcularBruto(3000, p, T2026)).toThrow(ErroSimulacao);
  });

  it('usa a tabela de maior vigência até a competência', () => {
    expect(escolherVigencia(['2025-01-01', '2026-01-01'], '2026-03-01')).toBe('2026-01-01');
    expect(escolherVigencia(['2025-01-01', '2026-01-01'], '2025-12-01')).toBe('2025-01-01');
    expect(escolherVigencia(['2026-01-01'], '2025-12-01')).toBeNull();
  });
});
