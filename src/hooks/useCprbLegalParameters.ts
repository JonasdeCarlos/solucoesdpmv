import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CprbLegalParameter {
  id: string;
  ano: number;
  competencia_inicio: string;
  competencia_fim: string;
  setor: string;
  cnae: string | null;
  aliquota_cprb: number;
  percentual_cprb_transicao: number;
  percentual_folha_transicao: number;
  aliquota_patronal_folha: number;
  regra_decimo_terceiro: string | null;
  observacoes_legais: string | null;
  fonte_legal: string | null;
  created_at: string;
  updated_at: string;
}

export function useCprbLegalParameters() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cprb_legal_parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cprb_legal_parameters')
        .select('*')
        .order('ano', { ascending: true });
      if (error) throw error;
      return data as CprbLegalParameter[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (param: Partial<CprbLegalParameter> & { id?: string }) => {
      if (param.id) {
        const { error } = await supabase
          .from('cprb_legal_parameters')
          .update({ ...param, updated_at: new Date().toISOString() })
          .eq('id', param.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cprb_legal_parameters')
          .insert(param as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cprb_legal_parameters'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cprb_legal_parameters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cprb_legal_parameters'] }),
  });

  return { ...query, upsert, remove };
}
