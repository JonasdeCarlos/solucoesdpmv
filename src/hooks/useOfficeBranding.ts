import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OfficeBranding } from '@/utils/holidays/types';

export function useOfficeBranding() {
  const [branding, setBranding] = useState<OfficeBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('office_branding' as any).select('*').limit(1).maybeSingle();
    setBranding(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<OfficeBranding>) => {
    if (!branding) return { error: new Error('no branding row') };
    const { error } = await supabase.from('office_branding' as any).update(patch as any).eq('id', branding.id);
    if (!error) await load();
    return { error };
  };

  return { branding, loading, save, reload: load };
}