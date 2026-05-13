import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvisoEmpresa {
  id: string; code: string; name: string; cnpj: string; ativo: boolean;
  created_at: string; updated_at: string;
}

export function useAvisoEmpresas() {
  const [empresas, setEmpresas] = useState<AvisoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('aviso_empresas' as any).select('*').order('code');
    if (data) setEmpresas(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { empresas, loading, refresh };
}
