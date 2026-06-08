import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvisoEmpresa {
  id: string; code: string; name: string; cnpj: string; ativo: boolean;
  responsavel: string;
  whatsapp: string;
  whatsapp_numeros: string[];
  digisac_contact_id?: string | null;
  created_at: string; updated_at: string;
}

export function useAvisoEmpresas() {
  const [empresas, setEmpresas] = useState<AvisoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('aviso_empresas' as any).select('*');
    if (data) {
      const sorted = [...(data as any[])].sort((a, b) => {
        const na = parseInt(String(a.code).replace(/\D/g, ''), 10);
        const nb = parseInt(String(b.code).replace(/\D/g, ''), 10);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true });
      });
      setEmpresas(sorted as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Atualização em tempo real quando novas empresas são cadastradas
  useEffect(() => {
    const channel = supabase
      .channel('aviso-empresas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aviso_empresas' },
        () => { refresh(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const updateEmpresa = async (id: string, patch: Partial<AvisoEmpresa>) => {
    const { error } = await supabase.from('aviso_empresas' as any).update(patch as any).eq('id', id);
    if (!error) await refresh();
    return { error };
  };

  const setResponsavelAndPropagate = async (empresa: AvisoEmpresa, responsavel: string) => {
    const { error } = await supabase.from('aviso_empresas' as any)
      .update({ responsavel } as any).eq('id', empresa.id);
    if (error) return { error };
    // Propaga para avisos abertos/em_tratamento/sem_retorno (não concluídos) da empresa
    await supabase.from('avisos' as any)
      .update({ responsavel } as any)
      .eq('empresa_id', empresa.id)
      .neq('status', 'concluido');
    return { error: null };
  };

  // Atualiza somente a empresa (default p/ próximas importações), sem mexer em avisos existentes
  const setEmpresaDefaultResponsavel = async (empresaCode: string, responsavel: string) => {
    const emp = empresas.find((e) => e.code === empresaCode);
    if (!emp) return { error: new Error('empresa não encontrada') };
    if ((emp.responsavel || '') === responsavel) return { error: null };
    const { error } = await supabase.from('aviso_empresas' as any)
      .update({ responsavel } as any).eq('id', emp.id);
    if (!error) await refresh();
    return { error };
  };

  return { empresas, loading, refresh, updateEmpresa, setResponsavelAndPropagate, setEmpresaDefaultResponsavel };
}
