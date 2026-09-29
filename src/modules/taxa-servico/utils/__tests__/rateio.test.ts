import { describe, it, expect } from 'vitest';
import { ratear, calcularAjuste } from '../rateio';
import { calcularValores } from '../validacoes';

describe('rateio', () => {
  it('soma exata ao centavo', () => {
    const r = ratear(1000, [{ funcionario_id: 'a', pontos: 1 }, { funcionario_id: 'b', pontos: 1 }, { funcionario_id: 'c', pontos: 1 }]);
    expect(r.soma).toBe(1000);
    expect(r.diferenca).toBe(0);
  });
  it('ajuste 3000/6500/6000 = 2500', () => {
    expect(calcularAjuste({ valor_comissao: 3000, rendimento_bruto_extrato: 6500, valor_bruto_alvo: 6000 }).valor_ajustado).toBe(2500);
  });
  it('trava em zero', () => {
    const a = calcularAjuste({ valor_comissao: 100, rendimento_bruto_extrato: 6500, valor_bruto_alvo: 6000 });
    expect(a.valor_ajustado).toBe(0);
    expect(a.alerta).toMatch(/excede/);
  });
  it('retenção não incide sobre saldo', () => {
    expect(calcularValores(10000, 20, 500)).toEqual({ retido: 2000, liquido: 8500 });
  });
});
