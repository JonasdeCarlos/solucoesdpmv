import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAvisoImports() {
  const [imports, setImports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('aviso_imports' as any).select('*').order('imported_at', { ascending: false }).limit(50);
    if (data) setImports(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { imports, loading, refresh };
}
