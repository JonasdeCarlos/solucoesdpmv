import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RescisaoDossier } from '@/types/rescisaoDossier';

export function useRescisaoDossiers() {
  const [dossiers, setDossiers] = useState<RescisaoDossier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rescisao_dossiers' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setDossiers(data as any as RescisaoDossier[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDossiers(); }, [fetchDossiers]);

  const createDossier = async (d: Partial<RescisaoDossier>) => {
    const { data, error } = await supabase
      .from('rescisao_dossiers' as any)
      .insert(d as any)
      .select()
      .single();
    if (!error) await fetchDossiers();
    return { data: data as any as RescisaoDossier | null, error };
  };

  const updateDossier = async (id: string, updates: Partial<RescisaoDossier>) => {
    const { error } = await supabase
      .from('rescisao_dossiers' as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (!error) await fetchDossiers();
    return { error };
  };

  const deleteDossier = async (id: string) => {
    const { error } = await supabase
      .from('rescisao_dossiers' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchDossiers();
    return { error };
  };

  return { dossiers, loading, fetchDossiers, createDossier, updateDossier, deleteDossier };
}
