import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HolidaySourceDoc {
  id: string; doc_type: string; uf: string | null; municipio: string | null;
  cct_id: string | null; ano: number | null; file_path: string | null; file_name: string;
  status: string; imported_by: string; imported_at: string;
  total_extracted: number; total_confirmed: number; total_ignored: number; total_duplicated: number;
}
export interface HolidayExtractionItem {
  id: string; source_doc_id: string; data: string | null; nome: string; tipo: string;
  is_holiday: boolean; is_optional: boolean; scope_type: string; uf: string | null;
  municipio: string | null; cct_id: string | null; confidence: number; evidence_text: string;
  status: 'pendente' | 'confirmado' | 'ignorado' | 'duplicado'; holiday_id: string | null;
}

export function useHolidaySources() {
  const [docs, setDocs] = useState<HolidaySourceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('holiday_source_documents' as any).select('*').order('imported_at', { ascending: false });
    setDocs((data || []) as any);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fetchItems = async (sourceDocId: string): Promise<HolidayExtractionItem[]> => {
    const { data } = await supabase.from('holiday_extraction_items' as any)
      .select('*').eq('source_doc_id', sourceDocId).order('data', { ascending: true });
    return (data || []) as any;
  };

  return { docs, loading, reload: load, fetchItems };
}