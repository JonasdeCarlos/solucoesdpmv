import { supabase } from '@/integrations/supabase/client';
import type { PecApi } from './api';

export async function commercialCall(action: string, token = '', extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('pec-comercial', { body: { action, token, ...extra } });
  if (error) {
    let message = 'Não foi possível concluir. Tente novamente.';
    try { const body = await error.context?.json(); message = body?.error || message; } catch { /* network */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function commercialApi(token: string): PecApi {
  // Serialize changes so independent autosaves cannot overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const call = (action: string, extra: Record<string, unknown> = {}) => {
    const result = queue.catch(() => undefined).then(() => commercialCall(action, token, extra));
    queue = result; return result;
  };
  const err = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e instanceof Error ? e.message : 'Erro ao salvar.'; } };
  return {
    publico: true, load: () => call('load'),
    salvarParams: dados => err(call('params', { dados })),
    atualizarSetor: (id, dados) => err(call('setor_update', { id, dados })),
    salvarDatas: async (id, dados) => { await call('datas', { id, dados }); },
    novoSetor: async dados => { try { return await call('setor_add', { dados }); } catch (e) { return { error: e instanceof Error ? e.message : 'Erro ao salvar.' }; } },
    excluirSetor: async id => { await call('setor_del', { id }); },
    novoCenario: (nome, snapshot) => err(call('cenario_add', { dados: { nome, snapshot } })),
    excluirCenario: async id => { await call('cenario_del', { id }); },
  };
}