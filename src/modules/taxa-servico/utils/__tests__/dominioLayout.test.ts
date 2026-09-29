import { describe, it, expect } from 'vitest';
import { gerarLinha, gerarArquivo, nomeArquivo } from '../dominioLayout';

describe('dominioLayout', () => {
  it('gera a linha de referência', () => {
    expect(gerarLinha({ codigoEmpregado: '95', competencia: '202608', rubrica: '25', tipoProcesso: '11', valor: 216.52, codigoEmpresa: '' }))
      .toBe('1000000000952026080025110000216520000000000');
  });
  it('CRLF entre linhas, sem quebra final, ignora zero', () => {
    const { conteudo, erros } = gerarArquivo([
      { codigoEmpregado: '1', competencia: '202608', rubrica: '25', tipoProcesso: '11', valor: 10 },
      { codigoEmpregado: '2', competencia: '202608', rubrica: '25', tipoProcesso: '11', valor: 0 },
      { codigoEmpregado: '3', competencia: '202608', rubrica: '25', tipoProcesso: '11', valor: 2500 },
    ]);
    expect(erros).toEqual([]);
    const linhas = conteudo.split('\r\n');
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.length === 43)).toBe(true);
    expect(conteudo.endsWith('\r\n')).toBe(false);
  });
  it('bloqueia código inválido', () => {
    expect(gerarArquivo([{ codigoEmpregado: 'A1', competencia: '202608', rubrica: '25', tipoProcesso: '11', valor: 1 }]).erros.length).toBeGreaterThan(0);
  });
  it('nome do arquivo', () => {
    expect(nomeArquivo('202608', '226', 'original')).toBe('FOLHA082026-226-TS-ORIGINAL.txt');
  });
});
