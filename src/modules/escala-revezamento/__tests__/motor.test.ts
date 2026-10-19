import { describe, it, expect } from 'vitest';
import { validarEscala, gerarEscala, listarDias, type EscalaParams, type EscalaFuncionario } from '../../../../supabase/functions/_shared/escalaMotor';

const base: EscalaParams = {
  regime: '6x1', data_inicio: '2026-11-02', data_fim: '2026-11-29', categoria_atividade: 'COMERCIO',
  atividade_anexo_iv: 'Hotéis', fundamento_trabalho_domingo: 'Lei 10.101/2000', cct_vigente: false, cct_registro: '',
  cct_vigencia: '', regras_cct: {}, prazo_folga_compensatoria_feriado: 7, n_domingos: 3, minimo_diario: 0, feriados: [],
  setor: 'Recepção', responsavel_nome: 'Fulano',
};
const f = (id: string, sexo: 'M' | 'F' = 'M', dias: Record<string, any> = {}): EscalaFuncionario => ({
  id, codigo: id, nome: 'Func ' + id, cargo: '', sexo, art386_ativo: sexo === 'F', art386_justificativa_desativacao: '',
  ultima_folga_anterior: '2026-11-01', ultimo_domingo_folga_anterior: '2026-11-01', hora_entrada: '', hora_saida: '', dias,
});
const ids = (r: ReturnType<typeof validarEscala>) => r.bloqueios.map((b) => b.id);

describe('motor escala', () => {
  it('R03: N acima de 3 no comércio bloqueia', () => {
    expect(ids(validarEscala({ ...base, n_domingos: 4 }, [f('1')]))).toContain('R03');
  });
  it('R02: 7 dias seguidos bloqueia', () => {
    const dias: any = {}; listarDias(base.data_inicio, base.data_fim).forEach((d, i) => { if (i >= 7 && i % 7 === 6) dias[d] = 'F'; });
    expect(ids(validarEscala(base, [f('1', 'M', dias)]))).toContain('R02');
  });
  it('R05: domingo trabalhado sem fundamento bloqueia', () => {
    expect(ids(validarEscala({ ...base, fundamento_trabalho_domingo: '', atividade_anexo_iv: 'nenhuma' }, [f('1')]))).toContain('R05');
  });
  it('R04: mulher não pode trabalhar 2 domingos seguidos', () => {
    const g = gerarEscala(base, [f('1', 'F')]);
    expect(ids(validarEscala(base, g.funcionarios))).not.toContain('R04');
  });
  it('gerador cumpre R01, R02 e R03 para 5 funcionários', () => {
    const g = gerarEscala(base, ['1', '2', '3', '4', '5'].map((i) => f(i, i === '5' ? 'F' : 'M')));
    const r = validarEscala(base, g.funcionarios);
    expect(r.bloqueios).toEqual([]);
  });
  it('12x36 fica fora do motor', () => {
    expect(ids(validarEscala({ ...base, regime: '12x36' }, [f('1')]))).toContain('R00');
  });
  it('R06: comércio sem Anexo IV e sem CCT não pode trabalhar no feriado', () => {
    const p = { ...base, atividade_anexo_iv: 'nenhuma', feriados: [{ data: '2026-11-20', nome: 'Consciência Negra' }] };
    expect(ids(validarEscala(p, [f('1')]))).toContain('R06');
  });
});

import { gerarEscala as gerarSpread, novoFuncionario as novoSpread } from '../motor';
import { it as itSpread, expect as expectSpread } from 'vitest';
itSpread('folgas de domingo são distribuídas em turmas, não todos no mesmo dia', () => {
  const p: any = { regime: '6x1', data_inicio: '2026-11-02', data_fim: '2026-11-29', categoria_atividade: 'COMERCIO', atividade_anexo_iv: 'Hotéis', fundamento_trabalho_domingo: 'Anexo IV', cct_vigente: false, cct_registro: '', cct_vigencia: '', regras_cct: {}, prazo_folga_compensatoria_feriado: 7, n_domingos: 3, minimo_diario: 0, feriados: [], setor: '', responsavel_nome: '' };
  const fs = [0, 1, 2, 3, 4, 5].map((i) => ({ ...novoSpread(), nome: 'F' + i }));
  const g = gerarSpread(p, fs);
  const primeiroDomingo = '2026-11-08';
  const folgas = g.funcionarios.filter((f) => f.dias[primeiroDomingo] === 'F').length;
  expectSpread(folgas).toBeLessThan(6);
  expectSpread(folgas).toBeGreaterThan(0);
});

itSpread('regime 5x2 gera 2 folgas por semana completa', () => {
  const p: any = { regime: '5x2', data_inicio: '2026-11-02', data_fim: '2026-11-29', categoria_atividade: 'COMERCIO', atividade_anexo_iv: 'nenhuma', fundamento_trabalho_domingo: 'Lei 10.101/2000', cct_vigente: false, cct_registro: '', cct_vigencia: '', regras_cct: {}, prazo_folga_compensatoria_feriado: 7, n_domingos: 3, minimo_diario: 0, feriados: [], setor: '', responsavel_nome: '' };
  const g = gerarSpread(p, [0, 1, 2, 3].map((i) => ({ ...novoSpread(), nome: 'F' + i })));
  const semana = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  g.funcionarios.forEach((f) => expectSpread(semana.filter((d) => f.dias[d] === 'F').length).toBe(2));
});
