import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PrizePolicy = {
  id: string;
  client_id: string;
  verba_label: string;
  verba_label_plural: string | null;
  nome: string;
  objetivo: string | null;
  periodo_tipo: string;
  escopo: string;
  tipo_calculo: string;
  valor_base: number;
  valor_minimo: number | null;
  arredondamento: string;
  rubrica_codigo: string | null;
  rubrica_descricao: string | null;
  status: string;
  aviso_legal: string | null;
  created_at: string;
  remuneracao_variavel?: boolean;
  rv_base?: string;
  rv_base_label?: string | null;
  rv_tiers?: Array<{ ate: number | null; percentual: number }>;
  rv_pct_individual?: number;
  rv_pct_igualitario?: number;
  rv_observacoes?: string | null;
  modelo_template?: string | null;
  hotelaria_config?: any;
  hotelaria_pontos?: Record<string, number>;
  hotelaria_apuracao?: any;
  hotelaria_apuracoes?: Record<string, any>;
};

export type PrizeCriterion = {
  id: string;
  policy_id: string;
  nome: string;
  descricao: string | null;
  peso: number;
  essencial: boolean;
  ordem: number;
  origem: 'manual' | 'ia';
};

export type PrizeEmployee = {
  id: string;
  policy_id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  setor: string | null;
  ativo: boolean;
  codigo_folha?: string | null;
  data_admissao?: string | null;
  pontos?: number;
};

export function usePrizePolicies(client_id: string | undefined) {
  const [items, setItems] = useState<PrizePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('prize_policies' as any)
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload: Partial<PrizePolicy>) => {
    if (!client_id) return { error: new Error('no client') };
    const { data, error } = await supabase
      .from('prize_policies' as any)
      .insert({ ...payload, client_id } as any)
      .select('*')
      .single();
    if (!error) await load();
    return { data: data as any, error };
  };

  const update = async (id: string, patch: Partial<PrizePolicy>) => {
    const { error } = await supabase.from('prize_policies' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('prize_policies' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  return { items, loading, reload: load, create, update, remove };
}

export function usePrizeCriteria(policy_id: string | undefined) {
  const [items, setItems] = useState<PrizeCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!policy_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('prize_criteria' as any)
      .select('*')
      .eq('policy_id', policy_id)
      .order('ordem', { ascending: true });
    setItems((data || []) as any);
    setLoading(false);
  }, [policy_id]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload: Partial<PrizeCriterion>) => {
    if (!policy_id) return { error: new Error('no policy') };
    const ordem = (items[items.length - 1]?.ordem ?? -1) + 1;
    const { error } = await supabase
      .from('prize_criteria' as any)
      .insert({ ordem, peso: 1, essencial: false, origem: 'manual', ...payload, policy_id } as any);
    if (!error) await load();
    return { error };
  };

  const createMany = async (rows: Partial<PrizeCriterion>[]) => {
    if (!policy_id || rows.length === 0) return { error: null };
    const baseOrdem = (items[items.length - 1]?.ordem ?? -1) + 1;
    const payload = rows.map((r, i) => ({
      peso: 1, essencial: false, origem: 'ia', ordem: baseOrdem + i, ...r, policy_id,
    }));
    const { error } = await supabase.from('prize_criteria' as any).insert(payload as any);
    if (!error) await load();
    return { error };
  };

  const update = async (id: string, patch: Partial<PrizeCriterion>) => {
    const { error } = await supabase.from('prize_criteria' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('prize_criteria' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  const suggest = async (input: { setor?: string; cargo?: string; objetivo?: string; verba_label?: string; quantidade?: number; }) => {
    const { data, error } = await supabase.functions.invoke('premio-criterios-sugerir', { body: input });
    if (error) return { error };
    return { criterios: (data as any)?.criterios as Array<{ nome: string; descricao: string; peso?: number; essencial?: boolean }> };
  };

  const explainCriterion = async (input: { criterio_nome: string; setor?: string; cargo?: string; objetivo?: string; verba_label?: string; }) => {
    const { data, error } = await supabase.functions.invoke('premio-criterio-explicar', { body: input });
    if (error) return { error };
    return { explicacao: (data as any)?.explicacao as string };
  };

  return { items, loading, reload: load, create, createMany, update, remove, suggest, explainCriterion };
}

export function usePrizeEmployees(policy_id: string | undefined) {
  const [items, setItems] = useState<PrizeEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!policy_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('prize_employees' as any)
      .select('*')
      .eq('policy_id', policy_id)
      .order('nome', { ascending: true });
    setItems((data || []) as any);
    setLoading(false);
  }, [policy_id]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload: Partial<PrizeEmployee>) => {
    if (!policy_id) return { error: new Error('no policy') };
    const { error } = await supabase
      .from('prize_employees' as any)
      .insert({ ativo: true, ...payload, policy_id } as any);
    if (!error) await load();
    return { error };
  };

  const createMany = async (rows: Partial<PrizeEmployee>[]) => {
    if (!policy_id || rows.length === 0) return { error: null };
    const payload = rows.map(r => ({ ativo: true, ...r, policy_id }));
    const { error } = await supabase.from('prize_employees' as any).insert(payload as any);
    if (!error) await load();
    return { error };
  };

  const update = async (id: string, patch: Partial<PrizeEmployee>) => {
    const { error } = await supabase.from('prize_employees' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('prize_employees' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  return { items, loading, reload: load, create, createMany, update, remove };
}