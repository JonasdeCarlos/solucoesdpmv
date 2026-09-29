import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface TsConfig { id?: string; empresa_id: string; regime_tributario: 'simples' | 'demais'; codigo_empresa_dominio: string | null; codigo_verba_padrao: string | null; teto_retencao_cct?: number | null }
export interface TsFuncionario { id: string; empresa_id: string; codigo: string; nome: string; ativo: boolean; gera_lancamento?: boolean }
export interface TsCompetencia {
  id: string; empresa_id: string; competencia: string; valor_arrecadado: number; percentual_retencao: number; valor_retido: number;
  saldo_utilizado: number; valor_liquido: number; codigo_verba: string | null; tipo_processo: string; saldo_nao_distribuido: number;
  status: 'rascunho' | 'calculado' | 'exportado' | 'ajustado'; created_at: string;
}
export interface TsDistribuicao {
  id?: string; competencia_id: string; funcionario_id: string; pontos: number; valor_comissao: number;
  rendimento_bruto_extrato: number | null; valor_bruto_alvo: number | null; diferenca: number | null; valor_ajustado: number | null; alerta: string | null;
}
export interface TsSaldo { saldo_gerado: number; saldo_consumido: number; saldo_acumulado: number }

const num = (o: any) => {
  const r: any = { ...o };
  for (const k of Object.keys(r)) if (typeof r[k] === 'string' && /^(valor|saldo|percentual|pontos|rendimento|diferenca)/.test(k)) r[k] = Number(r[k]);
  return r;
};

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  useEffect(() => {
    db.from('clientes').select('id,nome,cnpj').order('nome').then(({ data }: any) => setEmpresas(data || []));
  }, []);
  return empresas;
}

export function useTaxaServicoEmpresa(empresaId: string | null) {
  const [config, setConfig] = useState<TsConfig | null>(null);
  const [funcionarios, setFuncionarios] = useState<TsFuncionario[]>([]);
  const [competencias, setCompetencias] = useState<TsCompetencia[]>([]);
  const [saldo, setSaldo] = useState<TsSaldo>({ saldo_gerado: 0, saldo_consumido: 0, saldo_acumulado: 0 });

  const reload = useCallback(async () => {
    if (!empresaId) return;
    const [c, f, k, s] = await Promise.all([
      db.from('ts_empresa_config').select('*').eq('empresa_id', empresaId).maybeSingle(),
      db.from('ts_funcionarios').select('*').eq('empresa_id', empresaId).order('nome'),
      db.from('ts_competencias').select('*').eq('empresa_id', empresaId).order('competencia', { ascending: false }),
      db.from('ts_saldo_empresa').select('*').eq('empresa_id', empresaId).maybeSingle(),
    ]);
    setConfig(c.data || { empresa_id: empresaId, regime_tributario: 'simples', codigo_empresa_dominio: '', codigo_verba_padrao: '' });
    setFuncionarios(f.data || []);
    setCompetencias((k.data || []).map(num));
    setSaldo(s.data ? num(s.data) : { saldo_gerado: 0, saldo_consumido: 0, saldo_acumulado: 0 });
  }, [empresaId]);

  useEffect(() => { reload(); }, [reload]);

  const saveConfig = async (c: TsConfig) => {
    const { error } = await db.from('ts_empresa_config').upsert(
      { empresa_id: c.empresa_id, regime_tributario: c.regime_tributario, codigo_empresa_dominio: c.codigo_empresa_dominio || null, codigo_verba_padrao: c.codigo_verba_padrao || null, teto_retencao_cct: c.teto_retencao_cct ? Number(c.teto_retencao_cct) : null },
      { onConflict: 'empresa_id' },
    );
    if (!error) await reload();
    return error;
  };

  return { config, funcionarios, competencias, saldo, reload, saveConfig };
}

export async function saldoDisponivel(empresaId: string, competenciaId: string | null): Promise<number> {
  const { data } = await db.rpc('ts_saldo_disponivel', { p_empresa_id: empresaId, p_competencia_id: competenciaId });
  return Number(data || 0);
}

export async function upsertFuncionarios(empresaId: string, rows: { codigo: string; nome: string }[]) {
  return db.from('ts_funcionarios').upsert(rows.map((r) => ({ empresa_id: empresaId, codigo: r.codigo, nome: r.nome })), { onConflict: 'empresa_id,codigo' });
}

export async function loadDistribuicao(competenciaId: string): Promise<TsDistribuicao[]> {
  const { data } = await db.from('ts_distribuicao').select('*').eq('competencia_id', competenciaId);
  return (data || []).map(num);
}

export async function saveDistribuicao(rows: TsDistribuicao[]) {
  if (!rows.length) return null;
  const { error } = await db.from('ts_distribuicao').upsert(rows.map(({ id, ...r }) => r), { onConflict: 'competencia_id,funcionario_id' });
  return error;
}

export async function saveCompetencia(row: Partial<TsCompetencia> & { empresa_id: string }) {
  const { data, error } = await db.from('ts_competencias').upsert(row, { onConflict: 'empresa_id,competencia' }).select().single();
  return { data: data ? (num(data) as TsCompetencia) : null, error };
}

export async function updateCompetencia(id: string, patch: Partial<TsCompetencia>) {
  return db.from('ts_competencias').update(patch).eq('id', id);
}

export async function saveExportacao(competenciaId: string, tipo: 'original' | 'ajustado', nome: string, conteudo: string) {
  return db.from('ts_exportacoes').insert({ competencia_id: competenciaId, tipo, nome_arquivo: nome, conteudo });
}

export { db as tsDb };

/** Fechamento explícito (passo 6). Sem registro: competências já exportadas contam como fechadas. */
const fechKey = (id: string) => `ts-fechada-${id}`;
export function isFechada(c: TsCompetencia) {
  const v = localStorage.getItem(fechKey(c.id));
  if (v === null) return c.status === 'exportado' || c.status === 'ajustado';
  return v === '1';
}
export function setFechada(id: string, fechada: boolean) { localStorage.setItem(fechKey(id), fechada ? '1' : '0'); }
export function marcarAbertaSeNova(id: string) { if (localStorage.getItem(fechKey(id)) === null) setFechada(id, false); }
