import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useCargos(client_id?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) return;
    setLoading(true);
    const { data } = await supabase.from('cargos' as any).select('*').eq('client_id', client_id).order('nome');
    setItems((data as any) || []);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (row: any) => {
    if (row.id) {
      await supabase.from('cargos' as any).update(row).eq('id', row.id);
    } else {
      await supabase.from('cargos' as any).insert({ ...row, client_id } as any);
    }
    await load();
  };
  const remove = async (id: string) => {
    await supabase.from('cargos' as any).delete().eq('id', id);
    await load();
  };
  const duplicate = async (row: any) => {
    const { id, created_at, updated_at, ...rest } = row;
    await supabase.from('cargos' as any).insert({ ...rest, nome: `${rest.nome} (cópia)` } as any);
    await load();
  };
  return { items, loading, reload: load, save, remove, duplicate };
}

export function useEstruturaSalarial(client_id?: string) {
  const [estrutura, setEstrutura] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) return;
    setLoading(true);
    const { data } = await supabase.from('estruturas_salariais' as any).select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setEstrutura(data as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (payload: { faixas: any[]; escala_evolucao: any[] }) => {
    if (estrutura?.id) {
      await supabase.from('estruturas_salariais' as any).update(payload).eq('id', estrutura.id);
    } else {
      await supabase.from('estruturas_salariais' as any).insert({ ...payload, client_id } as any);
    }
    await load();
  };
  return { estrutura, loading, reload: load, save };
}