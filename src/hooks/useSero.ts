import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSeroVauVal(uf?: string, tipoObra?: string) {
  return useQuery({
    queryKey: ['sero_vau_val', uf, tipoObra],
    queryFn: async () => {
      let q = supabase.from('sero_vau_val').select('*');
      if (uf) q = q.eq('uf', uf);
      if (tipoObra) q = q.eq('tipo_obra', tipoObra);
      const { data, error } = await q.order('competencia_inicio', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSeroParametros() {
  return useQuery({
    queryKey: ['sero_parametros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sero_parametros').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSeroObras() {
  return useQuery({
    queryKey: ['sero_obras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sero_obras').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
