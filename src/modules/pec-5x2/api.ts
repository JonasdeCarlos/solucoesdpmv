import { supabase } from '@/integrations/supabase/client';

/** Acesso a dados da Necessidade de Contratação: interno (sessão) ou via link público (token). */
export interface PecApi {
  publico: boolean;
  load(): Promise<{ parametros: any; setores: any[]; datas: any[]; cenarios: any[] }>;
  salvarParams(dados: any): Promise<string | null>;
  atualizarSetor(id: string, dados: any): Promise<string | null>;
  salvarDatas(id: string, datas: any[]): Promise<void>;
  novoSetor(dados: any): Promise<{ setor?: any; error?: string }>;
  excluirSetor(id: string): Promise<void>;
  novoCenario(nome: string, snapshot: any): Promise<string | null>;
  excluirCenario(id: string): Promise<void>;
}

const t = (x: string) => x as any;

export function apiInterna(empresaId: string): PecApi {
  return {
    publico: false,
    async load() {
      const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
        supabase.from(t('transicao_parametros')).select('*').eq('empresa_id', empresaId).maybeSingle(),
        supabase.from(t('transicao_setores')).select('*').eq('empresa_id', empresaId).order('ordem'),
        supabase.from(t('transicao_cenarios')).select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      ]);
      const ids = ((s as any[]) || []).map((x) => x.id);
      const { data: ds } = ids.length ? await supabase.from(t('transicao_datas_especiais')).select('*').in('setor_id', ids) : { data: [] as any[] };
      return { parametros: p, setores: (s as any[]) || [], datas: (ds as any[]) || [], cenarios: (c as any[]) || [] };
    },
    async salvarParams(dados) {
      const { error } = await supabase.from(t('transicao_parametros')).upsert({ empresa_id: empresaId, ...dados }, { onConflict: 'empresa_id' });
      return error?.message || null;
    },
    async atualizarSetor(id, dados) {
      const { error } = await supabase.from(t('transicao_setores')).update(dados).eq('id', id);
      return error?.message || null;
    },
    async salvarDatas(id, datas) {
      await supabase.from(t('transicao_datas_especiais')).delete().eq('setor_id', id);
      const rows = datas.filter((d) => d.data).map((d) => ({ setor_id: id, data: d.data, nivel: d.nivel, observacao: d.observacao || null }));
      if (rows.length) await supabase.from(t('transicao_datas_especiais')).insert(rows);
    },
    async novoSetor(dados) {
      const { data, error } = await supabase.from(t('transicao_setores')).insert({ empresa_id: empresaId, ...dados }).select('*').single();
      return error ? { error: error.message } : { setor: data };
    },
    async excluirSetor(id) { await supabase.from(t('transicao_setores')).delete().eq('id', id); },
    async novoCenario(nome, snapshot) {
      const { error } = await supabase.from(t('transicao_cenarios')).insert({ empresa_id: empresaId, nome, snapshot });
      return error?.message || null;
    },
    async excluirCenario(id) { await supabase.from(t('transicao_cenarios')).delete().eq('id', id); },
  };
}

export async function chamarPublica(token: string, action: string, extra: any = {}) {
  const { data, error } = await supabase.functions.invoke('pec-publica', { body: { token, action, ...extra } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export function apiPublica(token: string): PecApi {
  const call = (action: string, extra?: any) => chamarPublica(token, action, extra);
  const err = async (p: Promise<any>) => { try { await p; return null; } catch (e: any) { return e.message as string; } };
  return {
    publico: true,
    load: () => call('load'),
    salvarParams: (dados) => err(call('params', { dados })),
    atualizarSetor: (id, dados) => err(call('setor_update', { id, dados })),
    salvarDatas: async (id, datas) => { await call('datas', { id, dados: datas }); },
    novoSetor: async (dados) => { try { return await call('setor_add', { dados }); } catch (e: any) { return { error: e.message }; } },
    excluirSetor: async (id) => { await call('setor_del', { id }); },
    novoCenario: (nome, snapshot) => err(call('cenario_add', { dados: { nome, snapshot } })),
    excluirCenario: async (id) => { await call('cenario_del', { id }); },
  };
}
