import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePrizePublicApi } from '@/hooks/prizePublicContext';

export type PrizeAssessment = {
  id: string;
  policy_id: string;
  competencia: string;
  status: string;
  observacao: string | null;
  created_at: string;
};

export type AssessmentEmployee = {
  id: string;
  assessment_id: string;
  employee_id: string;
  percentual_final: number | null;
  valor_final: number | null;
  parecer_geral: string | null;
  status: string;
  elegibilidade: string;
};

export type CriterionResult = {
  id: string;
  assessment_employee_id: string;
  criterion_id: string;
  percentual: number;
  observacao: string | null;
  evidencia_url: string | null;
  feedback_ia: string | null;
  status: string;
};

export function usePrizeAssessments(policy_id: string | undefined) {
  const [items, setItems] = useState<PrizeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const pub = usePrizePublicApi();

  const load = useCallback(async () => {
    if (!policy_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    if (pub) {
      setItems(await pub.listAssessments());
    } else {
      const { data } = await supabase
        .from('prize_assessments' as any)
        .select('*')
        .eq('policy_id', policy_id)
        .order('competencia', { ascending: false });
      setItems((data || []) as any);
    }
    setLoading(false);
  }, [policy_id, pub]);

  useEffect(() => { load(); }, [load]);

  const create = async (competencia: string, observacao?: string) => {
    if (!policy_id) return { error: new Error('no policy') };
    if (pub) {
      try { const item = await pub.createAssessment(competencia, observacao); await load(); return { data: item as any, error: null as any }; }
      catch (error) { return { data: null as any, error }; }
    }
    const { data, error } = await supabase
      .from('prize_assessments' as any)
      .insert({ policy_id, competencia, observacao: observacao || null } as any)
      .select('*').single();
    if (!error) await load();
    return { data: data as any, error };
  };

  const update = async (id: string, patch: Partial<PrizeAssessment>) => {
    if (pub) {
      try { await pub.updateAssessment(id, patch); await load(); return { error: null as any }; }
      catch (error) { return { error }; }
    }
    const { error } = await supabase.from('prize_assessments' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    if (pub) {
      try { await pub.deleteAssessment(id); await load(); return { error: null as any }; }
      catch (error) { return { error }; }
    }
    const { error } = await supabase.from('prize_assessments' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  // Garante AssessmentEmployee para TODOS os colaboradores ativos da política
  const enroll = async (assessment_id: string) => {
    if (!policy_id) return { error: new Error('no policy') };
    if (pub) {
      try { const count = await pub.enrollAssessment(assessment_id); return { error: null as any, count }; }
      catch (error) { return { error, count: 0 }; }
    }
    const { data: emps } = await supabase
      .from('prize_employees' as any).select('id').eq('policy_id', policy_id).eq('ativo', true);
    if (!emps?.length) return { error: null, count: 0 };
    const rows = emps.map((e: any) => ({ assessment_id, employee_id: e.id }));
    const { error } = await supabase
      .from('prize_assessment_employees' as any)
      .upsert(rows as any, { onConflict: 'assessment_id,employee_id', ignoreDuplicates: true } as any);
    return { error, count: rows.length };
  };

  return { items, loading, reload: load, create, update, remove, enroll };
}

export function useAssessmentEmployees(assessment_id: string | undefined) {
  const [items, setItems] = useState<(AssessmentEmployee & { employee: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const pub = usePrizePublicApi();

  const load = useCallback(async () => {
    if (!assessment_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    let data: any[] = [];
    if (pub) {
      data = await pub.listAssessmentEmployees(assessment_id);
    } else {
      const res = await supabase
        .from('prize_assessment_employees' as any)
        .select('*, employee:prize_employees(*)')
        .eq('assessment_id', assessment_id);
      data = res.data || [];
    }
    const sorted = data.sort((a: any, b: any) => (a.employee?.nome || '').localeCompare(b.employee?.nome || ''));
    setItems(sorted as any);
    setLoading(false);
  }, [assessment_id, pub]);

  useEffect(() => { load(); }, [load]);

  const updateOne = async (id: string, patch: Partial<AssessmentEmployee>) => {
    if (pub) {
      try { await pub.updateAssessmentEmployee(id, patch); await load(); return { error: null as any }; }
      catch (error) { return { error }; }
    }
    const { error } = await supabase.from('prize_assessment_employees' as any).update(patch as any).eq('id', id);
    if (!error) await load();
    return { error };
  };

  const removeOne = async (id: string) => {
    if (pub) {
      try { await pub.deleteAssessmentEmployee(id); await load(); return { error: null as any }; }
      catch (error) { return { error }; }
    }
    // remove resultados de critérios antes (evita órfãos)
    await supabase.from('prize_assessment_criterion_results' as any).delete().eq('assessment_employee_id', id);
    const { error } = await supabase.from('prize_assessment_employees' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  return { items, loading, reload: load, updateOne, removeOne };
}

export function useCriterionResults(assessment_employee_id: string | undefined) {
  const [items, setItems] = useState<CriterionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const pub = usePrizePublicApi();

  const load = useCallback(async () => {
    if (!assessment_employee_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    if (pub) {
      setItems(await pub.listCriterionResults(assessment_employee_id));
    } else {
      const { data } = await supabase
        .from('prize_assessment_criterion_results' as any)
        .select('*')
        .eq('assessment_employee_id', assessment_employee_id);
      setItems((data || []) as any);
    }
    setLoading(false);
  }, [assessment_employee_id, pub]);

  useEffect(() => { load(); }, [load]);

  const upsert = async (criterion_id: string, patch: Partial<CriterionResult>) => {
    if (!assessment_employee_id) return { error: new Error('no ae') };
    if (pub) {
      try { await pub.upsertCriterionResult(assessment_employee_id, criterion_id, patch); await load(); return { error: null as any }; }
      catch (error) { return { error }; }
    }
    const { error } = await supabase
      .from('prize_assessment_criterion_results' as any)
      .upsert({ assessment_employee_id, criterion_id, ...patch } as any,
        { onConflict: 'assessment_employee_id,criterion_id' } as any);
    if (!error) await load();
    return { error };
  };

  return { items, loading, reload: load, upsert };
}

// Histórico do colaborador (todas as competências, todas as políticas)
export async function fetchEmployeeHistory(employee_id: string) {
  const { data } = await supabase
    .from('prize_assessment_employees' as any)
    .select('*, assessment:prize_assessments(*, policy:prize_policies(nome, verba_label, valor_base))')
    .eq('employee_id', employee_id);
  return (data || []) as any[];
}

export async function uploadEvidencia(file: File, ae_id: string, criterion_id: string) {
  const path = `${ae_id}/${criterion_id}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('premio-docs').upload(path, file, { upsert: true });
  if (error) return { error, path: null };
  return { error: null, path };
}

export async function signedEvidenciaUrl(path: string) {
  const { data } = await supabase.storage.from('premio-docs').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

export async function generateFeedback(payload: any) {
  const { data, error } = await supabase.functions.invoke('premio-feedback', { body: payload });
  if (error) return { texto: null, error };
  return { texto: (data as any)?.texto || null, error: (data as any)?.error || null };
}