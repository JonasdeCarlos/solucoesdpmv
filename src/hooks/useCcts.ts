import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CCT { id: string; name: string; sindicato: string; uf: string; vigencia_inicio: string | null; vigencia_fim: string | null; observacoes: string; }

export function useCcts() {
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('ccts' as any).select('*').order('name');
    setCcts((data || []) as any);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (c: Partial<CCT>) => {
    const { error } = await supabase.from('ccts' as any).insert(c as any);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('ccts' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { ccts, loading, create, remove, reload: load };
}