import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type FeriadoMunicipal } from '@/utils/feriados';

export function useFeriadosMunicipais() {
  const [feriados, setFeriados] = useState<FeriadoMunicipal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeriados = useCallback(async () => {
    const { data, error } = await supabase
      .from('feriados_municipais' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setFeriados((data as any[]).map((d) => ({
        id: d.id,
        nome: d.descricao,
        dia: new Date(d.data).getUTCDate(),
        mes: new Date(d.data).getUTCMonth() + 1,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeriados(); }, [fetchFeriados]);

  const addFeriado = async (f: Omit<FeriadoMunicipal, 'id'>) => {
    const dateStr = `2000-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
    const { error } = await supabase
      .from('feriados_municipais' as any)
      .insert({ data: dateStr, descricao: f.nome } as any);
    if (!error) await fetchFeriados();
    return { error };
  };

  const deleteFeriado = async (id: string) => {
    const { error } = await supabase
      .from('feriados_municipais' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchFeriados();
    return { error };
  };

  return { feriados, loading, addFeriado, deleteFeriado };
}
