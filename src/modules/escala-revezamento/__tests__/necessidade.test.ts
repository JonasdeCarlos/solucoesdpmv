import { describe, it, expect } from 'vitest';
import { gerarEscala, listarDias, type EscalaParams, type EscalaFuncionario } from '../../../../supabase/functions/_shared/escalaMotor';

const base: EscalaParams = {
  regime: '6x1', data_inicio: '2026-11-02', data_fim: '2026-11-29', categoria_atividade: 'COMERCIO',
  atividade_anexo_iv: 'Hotéis', fundamento_trabalho_domingo: 'Lei 10.101/2000', cct_vigente: false, cct_registro: '',
  cct_vigencia: '', regras_cct: {}, prazo_folga_compensatoria_feriado: 7, n_domingos: 3, minimo_diario: 0, feriados: [],
  setor: '', responsavel_nome: '',
};
const f = (id: string): EscalaFuncionario => ({
  id, codigo: id, nome: 'F' + id, cargo: '', sexo: 'M', art386_ativo: false, art386_justificativa_desativacao: '',
  ultima_folga_anterior: '2026-11-01', ultimo_domingo_folga_anterior: '2026-11-01', hora_entrada: '', hora_saida: '', dias: {},
});
const dias = listarDias(base.data_inicio, base.data_fim);

describe('necessidade e férias', () => {
  it('sábado de maior necessidade não recebe folga semanal', () => {
    const p = { ...base, regras_cct: { necessidade: { semana: { '6': 'alta' as const } } } };
    const g = gerarEscala(p, ['1', '2', '3', '4'].map(f));
    const sab = dias.filter((d) => new Date(d + 'T12:00').getDay() === 6);
    g.funcionarios.forEach((x) => sab.forEach((d) => expect(x.dias[d]).toBe('T')));
  });
  it('dias de férias ficam como A', () => {
    const p = { ...base, regras_cct: { ferias: [{ func_id: '1', inicio: '2026-11-10', fim: '2026-11-19' }] } };
    const g = gerarEscala(p, ['1', '2'].map(f));
    listarDias('2026-11-10', '2026-11-19').forEach((d) => expect(g.funcionarios[0].dias[d]).toBe('A'));
  });
});
