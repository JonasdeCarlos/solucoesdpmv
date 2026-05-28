import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HolidayNotice } from '@/utils/holidays/types';

export function useHolidayNotices() {
  const [notices, setNotices] = useState<HolidayNotice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('holiday_notices' as any).select('*').order('created_at', { ascending: false });
    setNotices((data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (n: Partial<HolidayNotice>) => {
    const { error, data } = await supabase.from('holiday_notices' as any).insert(n as any).select('*').single();
    if (!error) await load();
    return { error, data };
  };
  const update = async (id: string, patch: Partial<HolidayNotice>) => {
    const { error } = await supabase.from('holiday_notices' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('holiday_notices' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  return { notices, loading, create, update, remove, reload: load };
}