import { describe, expect, it } from 'vitest';
import { calcularTotal, recalcDependents, type Step1Data, type Step2Data, type VerbaRescisoria } from './calculations';

const step1: Step1Data = {
  dataAdmissao: null, dataDesligamento: null, salarioMensal: 3000, motivo: 'pedido_demissao', motivoOutroTexto: '',
  descontaAvisoPrevio: false, diasAvisoDesconto: 30, temFeriasVencidas: false, periodosVencidos: 0,
  calculaFGTS: true, fgtsApenasMesRescisao: true, calculaMultaFGTS: true, percentualMultaFGTS: 40,
  calculaAvisoPrevioIndenizado: false, diasAvisoPrevioIndenizado: 30, calcula13AnosAnteriores: false, anos13Selecionados: [],
};
const step2: Step2Data = {
  diasTrabalhadosMes: 30, meses13Proporcional: 0, mesesFeriasProporcional: 0, consideraTercoFerias: true,
  outrosDescontos: [], outrosCreditos: [{ descricao: 'Comissão', valor: 100, incideFGTS: true }],
  incluir13AnosAnteriores: false, fgtsManual: null,
};
const row = (id: string, valor: number, tipo: 'credito' | 'debito' = 'credito'): VerbaRescisoria => ({ id, verba: id, referencia: '', valor, tipo });

describe('Exclusão de linhas do demonstrativo', () => {
  it('remove um provento do líquido imediatamente', () => {
    const verbas = [row('salario', 1000), row('comissao', 200), row('desconto', 50, 'debito')];
    expect(calcularTotal(verbas.filter(v => v.id !== 'comissao'))).toBe(950);
  });
  it('remove um desconto do líquido imediatamente', () => {
    const verbas = [row('salario', 1000), row('desconto', 50, 'debito')];
    expect(calcularTotal(verbas.filter(v => v.id !== 'desconto'))).toBe(1000);
  });
  it('atualiza o terço e não recria as férias excluídas', () => {
    const verbas = [row('ferias_proporcionais', 900), row('ferias_vencidas', 3000), row('terco_ferias', 1300)];
    const atual = recalcDependents(verbas.filter(v => v.id !== 'ferias_proporcionais'), step1, step2);
    expect(atual.find(v => v.id === 'ferias_proporcionais')).toBeUndefined();
    expect(atual.find(v => v.id === 'terco_ferias')?.valor).toBe(1000);
  });
  it('retira o crédito excluído da base de FGTS e da multa', () => {
    const verbas = [row('outros_creditos_0', 100), row('fgts_outros_creditos', 8), row('multa_fgts', 3.2)];
    const atual = recalcDependents(verbas.filter(v => v.id !== 'outros_creditos_0'), step1, step2);
    expect(atual.find(v => v.id === 'fgts_outros_creditos')?.valor).toBe(0);
    expect(atual.find(v => v.id === 'multa_fgts')?.valor).toBe(0);
    expect(calcularTotal(atual)).toBe(0);
  });
});