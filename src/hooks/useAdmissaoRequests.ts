import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormSchema, emptySchema } from '@/utils/admissao/formSchema';

export type AdmissionStatus =
  | 'rascunho'
  | 'enviado'
  | 'em_analise'
  | 'pendente'
  | 'aguardando_documentos'
  | 'aguardando_informacoes'
  | 'aguardando_sst'
  | 'aprovado'
  | 'concluido'
  | 'cancelado';

export const STATUS_LABELS: Record<AdmissionStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  em_analise: 'Em análise',
  pendente: 'Pendente',
  aguardando_documentos: 'Aguardando documentos',
  aguardando_informacoes: 'Aguardando informações',
  aguardando_sst: 'Aguardando SST',
  aprovado: 'Aprovado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export interface AdmissionRequest {
  id: string;
  template_id: string | null;
  template_name_snapshot: string;
  template_schema_snapshot: FormSchema;
  company_name: string;
  company_cnpj: string;
  employee_name: string;
  token: string;
  status: AdmissionStatus;
  responsible_name: string;
  draft_answers: Record<string, any>;
  answers: Record<string, any>;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalize(row: any): AdmissionRequest {
  const s = row.template_schema_snapshot || emptySchema();
  return {
    id: row.id,
    template_id: row.template_id,
    template_name_snapshot: row.template_name_snapshot || '',
    template_schema_snapshot: s.sections ? s : emptySchema(),
    company_name: row.company_name || '',
    company_cnpj: row.company_cnpj || '',
    employee_name: row.employee_name || '',
    token: row.token,
    status: (row.status || 'rascunho') as AdmissionStatus,
    responsible_name: row.responsible_name || '',
    draft_answers: row.draft_answers || {},
    answers: row.answers || {},
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function genToken(): string {
  // 24 chars URL-safe random
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function useAdmissaoRequests() {
  const [requests, setRequests] = useState<AdmissionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_requests' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setRequests((data as any[]).map(normalize));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async (input: {
    template_id: string;
    template_name_snapshot: string;
    template_schema_snapshot: FormSchema;
    company_name: string;
    company_cnpj: string;
    employee_name: string;
  }) => {
    const { data, error } = await supabase
      .from('admission_requests' as any)
      .insert({
        template_id: input.template_id,
        template_name_snapshot: input.template_name_snapshot,
        template_schema_snapshot: input.template_schema_snapshot,
        company_name: input.company_name,
        company_cnpj: input.company_cnpj,
        employee_name: input.employee_name,
        token: genToken(),
        status: 'rascunho',
      } as any)
      .select()
      .single();
    if (!error && data) await fetchAll();
    return { data: data ? normalize(data) : null, error };
  };

  const updateStatus = async (id: string, status: AdmissionStatus) => {
    const { error } = await supabase
      .from('admission_requests' as any)
      .update({ status } as any)
      .eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  const updateResponsible = async (id: string, responsible_name: string) => {
    const { error } = await supabase
      .from('admission_requests' as any)
      .update({ responsible_name } as any)
      .eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from('admission_requests' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  return { requests, loading, fetchAll, create, updateStatus, updateResponsible, remove };
}

export async function getRequestByToken(token: string): Promise<AdmissionRequest | null> {
  const { data, error } = await supabase
    .from('admission_requests' as any)
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}

export async function getRequestById(id: string): Promise<AdmissionRequest | null> {
  const { data, error } = await supabase
    .from('admission_requests' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}

export async function saveDraftAnswers(id: string, draft: Record<string, any>) {
  return supabase
    .from('admission_requests' as any)
    .update({ draft_answers: draft } as any)
    .eq('id', id);
}

export async function submitAnswers(id: string, answers: Record<string, any>) {
  return supabase
    .from('admission_requests' as any)
    .update({
      answers,
      draft_answers: answers,
      status: 'enviado',
      submitted_at: new Date().toISOString(),
    } as any)
    .eq('id', id);
}