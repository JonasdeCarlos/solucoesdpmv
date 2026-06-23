import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FeedbackRecord = {
  id: string;
  client_id: string;
  tipo: 'feedback' | 'cobranca' | 'alinhamento';
  employee_name: string;
  employee_role: string | null;
  manager_name: string | null;
  pontos_fortes: string | null;
  pontos_melhorar: string | null;
  fato_ocorrido: string | null;
  tom: 'leve' | 'medio' | 'cobranca' | null;
  generated_text: string | null;
  public_token: string;
  view_log: any[];
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
};

export function useFeedback(client_id: string | undefined) {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('feedback_records' as any)
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload: Partial<FeedbackRecord>) => {
    if (!client_id) return { error: new Error('no client') };
    const { data, error } = await supabase
      .from('feedback_records' as any)
      .insert({ ...payload, client_id } as any)
      .select('*')
      .single();
    if (!error) await load();
    return { data: data as any, error };
  };

  const update = async (id: string, patch: Partial<FeedbackRecord>) => {
    const { error } = await supabase.from('feedback_records' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('feedback_records' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  const generate = async (input: {
    tipo: 'feedback' | 'cobranca' | 'alinhamento';
    employee_name: string;
    employee_role?: string;
    manager_name?: string;
    pontos_fortes?: string;
    pontos_melhorar?: string;
    fato_ocorrido?: string;
    tom?: 'leve' | 'medio' | 'cobranca';
  }) => {
    const { data, error } = await supabase.functions.invoke('feedback-generate', { body: { ...input, client_id } });
    if (error) return { error };
    return { texto: (data as any)?.texto as string, usage: (data as any)?.usage };
  };

  return { items, loading, reload: load, create, update, remove, generate };
}