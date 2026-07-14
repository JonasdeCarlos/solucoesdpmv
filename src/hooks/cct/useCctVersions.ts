import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CctVersion {
  id: string;
  cct_analysis_id: string;
  version_number: number;
  snapshot: any;
  ocr_text_snapshot: string | null;
  file_path_snapshot: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export function useCctVersions(analysisId: string | null | undefined) {
  const [items, setItems] = useState<CctVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!analysisId) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('cct_versions' as any)
      .select('*')
      .eq('cct_analysis_id', analysisId)
      .order('version_number', { ascending: false });
    setItems(((data || []) as any) as CctVersion[]);
    setLoading(false);
  }, [analysisId]);

  useEffect(() => { load(); }, [load]);

  const snapshot = async (reason: string, analysisRow: any) => {
    if (!analysisId) return { error: new Error('analysisId ausente') } as any;
    const nextVersion = (items[0]?.version_number || 0) + 1;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('cct_versions' as any).insert({
      cct_analysis_id: analysisId,
      version_number: nextVersion,
      snapshot: analysisRow || {},
      ocr_text_snapshot: analysisRow?.ocr_text ?? null,
      file_path_snapshot: analysisRow?.original_file_path ?? null,
      reason,
      created_by: u?.user?.id ?? null,
    } as any);
    if (!error) await load();
    return { error };
  };

  return { items, loading, reload: load, snapshot };
}