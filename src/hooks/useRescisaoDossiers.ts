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
      .order('created_at', { ascending: false })
      .limit(10);
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
    if (!error) {
      // Mantém apenas as 10 montagens mais recentes
      const { data: all } = await supabase
        .from('rescisao_dossiers' as any)
        .select('id, final_pdf_url, created_at')
        .order('created_at', { ascending: false });
      if (all && all.length > 10) {
        const excess = (all as any[]).slice(10);
        const ids = excess.map((r: any) => r.id);
        const paths = excess.map((r: any) => r.final_pdf_url).filter(Boolean);
        if (paths.length) {
          await supabase.storage.from('rescisao-docs').remove(paths);
        }
        await supabase.from('rescisao_dossiers' as any).delete().in('id', ids);
      }
      await fetchDossiers();
    }
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
