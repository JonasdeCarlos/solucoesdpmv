// Carregar/salvar escala — mesmo código no front e na edge (recebe o client do supabase-js).
import type { EscalaFuncionario, EscalaParams, TipoDia } from './escalaMotor.ts';

export const PARAM_KEYS: (keyof EscalaParams)[] = [
  'regime', 'data_inicio', 'data_fim', 'categoria_atividade', 'atividade_anexo_iv', 'fundamento_trabalho_domingo',
  'cct_vigente', 'cct_registro', 'cct_vigencia', 'regras_cct', 'prazo_folga_compensatoria_feriado', 'n_domingos',
  'minimo_diario', 'feriados', 'setor', 'responsavel_nome',
];

export async function carregarEscala(db: any, id: string) {
  const { data: esc, error } = await db.from('escalas_revezamento').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!esc) return null;
  const { data: fs } = await db.from('escala_funcionarios').select('*').eq('escala_id', id).order('ordem');
  const { data: ds } = await db.from('escala_dias').select('funcionario_id, data, tipo').eq('escala_id', id).limit(20000);
  const funcionarios: EscalaFuncionario[] = (fs || []).map((f: any) => ({
    id: f.id, codigo: f.codigo, nome: f.nome, cargo: f.cargo, sexo: f.sexo === 'F' ? 'F' : 'M',
    art386_ativo: !!f.art386_ativo, art386_justificativa_desativacao: f.art386_justificativa_desativacao || '',
    ultima_folga_anterior: f.ultima_folga_anterior, ultimo_domingo_folga_anterior: f.ultimo_domingo_folga_anterior,
    hora_entrada: f.hora_entrada || '', hora_saida: f.hora_saida || '', dias: {},
  }));
  const byId = new Map(funcionarios.map((f) => [f.id, f]));
  (ds || []).forEach((d: any) => { const f = byId.get(d.funcionario_id); if (f) f.dias[d.data] = d.tipo as TipoDia; });
  return { escala: esc, funcionarios };
}

/** Grava cabeçalho (patch), funcionários e dias. Funcionários recebem ids novos se não forem uuid. */
export async function salvarEscala(db: any, id: string, patch: Record<string, unknown>, funcionarios: EscalaFuncionario[]) {
  if (Object.keys(patch).length) {
    const { error } = await db.from('escalas_revezamento').update(patch).eq('id', id);
    if (error) throw error;
  }
  const { error: e1 } = await db.from('escala_funcionarios').delete().eq('escala_id', id);
  if (e1) throw e1;
  if (!funcionarios.length) return;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rows = funcionarios.map((f, i) => ({
    id: uuidRe.test(f.id) ? f.id : crypto.randomUUID(), escala_id: id, ordem: i, codigo: f.codigo || '', nome: f.nome || '',
    cargo: f.cargo || '', sexo: f.sexo, art386_ativo: !!f.art386_ativo, art386_justificativa_desativacao: f.art386_justificativa_desativacao || '',
    ultima_folga_anterior: f.ultima_folga_anterior || null, ultimo_domingo_folga_anterior: f.ultimo_domingo_folga_anterior || null,
    hora_entrada: f.hora_entrada || '', hora_saida: f.hora_saida || '',
  }));
  const { error: e2 } = await db.from('escala_funcionarios').insert(rows);
  if (e2) throw e2;
  const dias: any[] = [];
  funcionarios.forEach((f, i) => Object.entries(f.dias || {}).forEach(([data, tipo]) => {
    if (tipo && tipo !== 'T') dias.push({ escala_id: id, funcionario_id: rows[i].id, data, tipo });
  }));
  for (let i = 0; i < dias.length; i += 1000) {
    const { error } = await db.from('escala_dias').insert(dias.slice(i, i + 1000));
    if (error) throw error;
  }
}

export function paramsDe(esc: any): EscalaParams {
  return {
    regime: esc.regime, data_inicio: esc.data_inicio, data_fim: esc.data_fim, categoria_atividade: esc.categoria_atividade,
    atividade_anexo_iv: esc.atividade_anexo_iv, fundamento_trabalho_domingo: esc.fundamento_trabalho_domingo,
    cct_vigente: esc.cct_vigente, cct_registro: esc.cct_registro, cct_vigencia: esc.cct_vigencia, regras_cct: esc.regras_cct || {},
    prazo_folga_compensatoria_feriado: esc.prazo_folga_compensatoria_feriado, n_domingos: esc.n_domingos,
    minimo_diario: esc.minimo_diario, feriados: esc.feriados || [], setor: esc.setor, responsavel_nome: esc.responsavel_nome,
  };
}
