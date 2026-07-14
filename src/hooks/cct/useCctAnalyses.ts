import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CctAnalysis {
  id: string;
  client_cct_id: string | null;
  title: string;
  original_file_path: string | null;
  original_file_name: string | null;
  ocr_text: string | null;
  ocr_applied: boolean;
  ai_model: string | null;
  ai_version: string | null;
  confidence_score: number | null;
  status: 'em_analise' | 'revisar' | 'aprovada' | 'arquivada' | 'substituida';
  identification: any;
  unions: any;
  territorial_base: any;
  professional_classes: any;
  economic_clauses: any;
  benefits_summary: any;
  journey_rules: any;
  overtime_rules: any;
  vacation_absence: any;
  admission_termination: any;
  union_obligations: any;
  health_safety: any;
  penalties: any;
  dp_attention_points: any[];
  ai_summary: string | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCctAnalyses() {
  const [items, setItems] = useState<CctAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cct_analyses' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (patch: Partial<CctAnalysis>) => {
    const { data, error } = await supabase.from('cct_analyses' as any).insert(patch as any).select('*').single();
    if (!error) await load();
    return { data: data as any as CctAnalysis | null, error };
  };

  const update = async (id: string, patch: Partial<CctAnalysis>) => {
    const { error } = await supabase.from('cct_analyses' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('cct_analyses' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  return { items, loading, create, update, remove, reload: load };
}

export async function fetchCctAnalysis(id: string): Promise<CctAnalysis | null> {
  const { data } = await supabase.from('cct_analyses' as any).select('*').eq('id', id).maybeSingle();
  return data as any;
}

export async function logCctAudit(cct_analysis_id: string | null, action: string, metadata: Record<string, any> = {}) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('cct_audit_log' as any).insert({
    cct_analysis_id,
    action,
    actor_id: userData?.user?.id ?? null,
    actor_email: userData?.user?.email ?? null,
    metadata,
  } as any);
}