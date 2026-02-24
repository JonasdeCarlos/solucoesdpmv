import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCprbSimulations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cprb_simulations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cprb_simulations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (sim: Record<string, any>) => {
      if (sim.id) {
        const { error } = await supabase
          .from('cprb_simulations')
          .update({ ...sim, updated_at: new Date().toISOString() })
          .eq('id', sim.id);
        if (error) throw error;
        return sim.id;
      } else {
        const { data, error } = await supabase
          .from('cprb_simulations')
          .insert(sim as any)
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cprb_simulations'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cprb_simulations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cprb_simulations'] }),
  });

  return { ...query, save, remove };
}
