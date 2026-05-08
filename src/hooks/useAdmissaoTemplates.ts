import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormSchema, emptySchema } from '@/utils/admissao/formSchema';

export interface AdmissionTemplate {
  id: string;
  name: string;
  description: string;
  is_published: boolean;
  schema_json: FormSchema;
  created_at: string;
  updated_at: string;
}

function normalize(row: any): AdmissionTemplate {
  const s = row.schema_json || emptySchema();
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    is_published: !!row.is_published,
    schema_json: s.sections ? s : emptySchema(),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useAdmissaoTemplates() {
  const [templates, setTemplates] = useState<AdmissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_form_templates' as any)
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setTemplates((data as any[]).map(normalize));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async (name: string) => {
    const { data, error } = await supabase
      .from('admission_form_templates' as any)
      .insert({ name, schema_json: emptySchema() } as any)
      .select()
      .single();
    if (!error && data) await fetchAll();
    return { data: data ? normalize(data) : null, error };
  };

  const update = async (id: string, patch: Partial<AdmissionTemplate>) => {
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.is_published !== undefined) dbPatch.is_published = patch.is_published;
    if (patch.schema_json !== undefined) dbPatch.schema_json = patch.schema_json;
    const { error } = await supabase
      .from('admission_form_templates' as any)
      .update(dbPatch)
      .eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from('admission_form_templates' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  const duplicate = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return { error: new Error('not found') };
    const { error } = await supabase
      .from('admission_form_templates' as any)
      .insert({
        name: `${t.name} (cópia)`,
        description: t.description,
        schema_json: t.schema_json,
        is_published: false,
      } as any);
    if (!error) await fetchAll();
    return { error };
  };

  return { templates, loading, fetchAll, create, update, remove, duplicate };
}

export async function getTemplateById(id: string): Promise<AdmissionTemplate | null> {
  const { data, error } = await supabase
    .from('admission_form_templates' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}