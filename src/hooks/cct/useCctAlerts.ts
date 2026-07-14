import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CctAlert {
  id: string;
  cct_analysis_id: string | null;
  client_cct_id: string | null;
  client_id: string | null;
  alert_type: string;
  severity: 'alta' | 'media' | 'baixa' | string;
  due_date: string | null;
  message: string | null;
  status: 'aberto' | 'resolvido' | 'substituido' | string;
  created_at: string;
}

export function useCctAlerts() {
  const [items, setItems] = useState<CctAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cct_alerts' as any)
      .select('*')
      .eq('status', 'aberto')
      .order('due_date', { ascending: true, nullsFirst: false });
    setItems(((data || []) as any) as CctAlert[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    const { data, error } = await supabase.functions.invoke('cct-alerts-refresh', { body: {} });
    if (!error) await load();
    return { data, error };
  };

  const resolve = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('cct_alerts' as any).update({ status: 'resolvido', resolved_at: new Date().toISOString(), resolved_by: u?.user?.id ?? null } as any).eq('id', id);
    await load();
  };

  return { items, loading, reload: load, refresh, resolve };
}