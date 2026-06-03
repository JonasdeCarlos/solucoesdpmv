import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Holiday } from '@/utils/holidays/types';
import { buildDedupeKey, dedupeHolidayList, isDuplicateHoliday } from '@/utils/holidays/dedupe';

export function useHolidaysModule() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('holidays' as any).select('*').order('data', { ascending: true });
    setHolidays(dedupeHolidayList((data || []) as any) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (h: Partial<Holiday>) => {
    const dedupe_key = buildDedupeKey({
      data: h.data!, tipo: h.tipo!, scope_type: h.scope_type!,
      uf: h.uf, municipio: h.municipio, cct_id: h.cct_id, company_id: h.company_id,
      nome: h.nome!,
    });
    const { data: sameDate } = await supabase.from('holidays' as any).select('*').eq('data', h.data!);
    if (((sameDate || []) as any[]).some((existing) => isDuplicateHoliday(h as any, existing))) {
      return { error: new Error('duplicado'), duplicated: true };
    }
    const { error } = await supabase.from('holidays' as any).insert({ ...h, dedupe_key } as any);
    if (!error) await load();
    return { error };
  };

  const update = async (id: string, patch: Partial<Holiday>) => {
    const { error } = await supabase.from('holidays' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('holidays' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  const toggleStatus = (id: string, status: 'ativo' | 'inativo') => update(id, { status } as any);

  return { holidays, loading, create, update, remove, toggleStatus, reload: load };
}