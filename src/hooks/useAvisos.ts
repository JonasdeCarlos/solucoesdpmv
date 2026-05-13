import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvisoRow {
  id: string;
  empresa_id: string | null;
  empresa_code: string;
  empresa_name: string;
  empresa_cnpj: string;
  employee_code: string;
  employee_name: string;
  motivo: string;
  motivo_original: string;
  due_date: string | null;
  limit_date: string | null;
  source_emission_date: string | null;
  import_id: string | null;
  status: string;
  unique_hash: string;
  aviso1_at: string | null; aviso1_by: string | null;
  aviso2_at: string | null; aviso2_by: string | null;
  aviso3_at: string | null; aviso3_by: string | null;
  no_response_at: string | null; no_response_by: string | null;
  observacoes: string;
  responsavel: string;
  created_at: string;
  updated_at: string;
}

export function useAvisos() {
  const [items, setItems] = useState<AvisoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('avisos' as any)
      .select('*')
      .order('due_date', { ascending: true })
      .limit(2000);
    if (!error && data) setItems(data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel('avisos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  const updateAviso = async (id: string, patch: Partial<AvisoRow>) => {
    const { error } = await supabase.from('avisos' as any).update(patch as any).eq('id', id);
    if (!error) await refresh();
    return { error };
  };

  const deleteAviso = async (id: string) => {
    const { error } = await supabase.from('avisos' as any).delete().eq('id', id);
    if (!error) await refresh();
    return { error };
  };

  const addAttempt = async (aviso_id: string, attempt: {
    attempt_type: string;
    marked_by: string;
    call_date?: string | null;
    call_channel?: string | null;
    notes?: string;
    metadata?: any;
  }) => {
    const { error } = await supabase.from('aviso_contact_attempts' as any).insert({
      aviso_id, ...attempt,
    } as any);
    return { error };
  };

  return { items, loading, refresh, updateAviso, deleteAviso, addAttempt };
}

export function useAviso(id: string | undefined) {
  const [aviso, setAviso] = useState<AvisoRow | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from('avisos' as any).select('*').eq('id', id).maybeSingle(),
      supabase.from('aviso_contact_attempts' as any).select('*').eq('aviso_id', id).order('marked_at', { ascending: false }),
    ]);
    if (a.data) setAviso(a.data as any);
    if (b.data) setAttempts(b.data as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { aviso, attempts, loading, refresh };
}
