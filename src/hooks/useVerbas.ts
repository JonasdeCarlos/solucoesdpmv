import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type Verba, type TipoCalculo } from '@/types/verba';

export function useVerbas() {
  const [verbas, setVerbas] = useState<Verba[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVerbas = useCallback(async () => {
    const { data, error } = await supabase
      .from('verbas' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setVerbas((data as any[]).map((d) => ({
        id: d.id,
        nome: d.nome,
        tipoCalculo: d.tipo_calculo as TipoCalculo,
        referenciaPadrao: d.referencia_padrao || '',
        padraoPD: d.padrao_pd as 'P' | 'D',
        incideFGTS: d.incide_fgts,
        calculaDSR: d.calcula_dsr,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVerbas(); }, [fetchVerbas]);

  const saveVerba = async (verba: Verba) => {
    const row = {
      id: verba.id,
      nome: verba.nome,
      tipo_calculo: verba.tipoCalculo,
      referencia_padrao: verba.referenciaPadrao,
      padrao_pd: verba.padraoPD,
      incide_fgts: verba.incideFGTS,
      calcula_dsr: verba.calculaDSR,
    };
    const { error } = await supabase
      .from('verbas' as any)
      .upsert(row as any);
    if (!error) await fetchVerbas();
    return { error };
  };

  const deleteVerba = async (id: string) => {
    const { error } = await supabase
      .from('verbas' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchVerbas();
    return { error };
  };

  return { verbas, loading, saveVerba, deleteVerba };
}
