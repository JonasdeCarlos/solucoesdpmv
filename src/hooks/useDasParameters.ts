import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DasAnexoFaixa {
  id: string;
  anexo: string;
  faixa: number;
  rbt12_min: number;
  rbt12_max: number;
  aliquota_nominal: number;
  parcela_deduzir: number;
  competencia_inicio: string;
  competencia_fim: string;
  ativo: boolean;
  fonte_legal: string | null;
  observacoes: string | null;
}

export interface DasCnaeAnexo {
  id: string;
  cnae: string;
  descricao: string | null;
  anexo_sugerido: string;
  exige_fator_r: boolean;
  fator_r_limite: number | null;
  observacoes: string | null;
  ativo: boolean;
}

export function useDasAnexosFaixas() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['das_anexos_faixas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('das_anexos_faixas')
        .select('*')
        .eq('ativo', true)
        .order('anexo')
        .order('faixa');
      if (error) throw error;
      return data as DasAnexoFaixa[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (param: Partial<DasAnexoFaixa> & { id?: string }) => {
      if (param.id) {
        const { error } = await supabase
          .from('das_anexos_faixas')
          .update({ ...param, updated_at: new Date().toISOString() })
          .eq('id', param.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('das_anexos_faixas')
          .insert(param as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['das_anexos_faixas'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('das_anexos_faixas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['das_anexos_faixas'] }),
  });

  return { ...query, upsert, remove };
}

export function useDasCnaeAnexo() {
  const query = useQuery({
    queryKey: ['das_cnae_anexo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('das_cnae_anexo')
        .select('*')
        .eq('ativo', true)
        .order('cnae');
      if (error) throw error;
      return data as DasCnaeAnexo[];
    },
  });

  return query;
}
