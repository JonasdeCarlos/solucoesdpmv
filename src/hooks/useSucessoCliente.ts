import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  ClienteDP, DPProfile, DiaryEntry, ClientUpload, ClientCCT, ClientRubric,
  ChecklistTemplate, ChecklistRun, MessageTemplate, CalendarEvent, RiskFlag
} from '@/types/sucessoCliente';

export function useClientesDP() {
  const [list, setList] = useState<ClienteDP[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clientes' as any).select('*').order('nome');
    setList((data || []) as any);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { list, loading, reload: load };
}

export function useCliente(id: string | undefined) {
  const [cliente, setCliente] = useState<ClienteDP | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('clientes' as any).select('*').eq('id', id).maybeSingle();
    setCliente(data as any);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  return { cliente, loading, reload: load };
}

export function useDPProfile(client_id: string | undefined) {
  const [profile, setProfile] = useState<DPProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    const { data } = await supabase.from('client_dp_profile' as any).select('*').eq('client_id', client_id).maybeSingle();
    setProfile(data as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const upsert = async (patch: Partial<DPProfile>) => {
    if (!client_id) return { error: new Error('no client') };
    const payload = { client_id, ...(profile || {}), ...patch };
    delete (payload as any).id;
    const { error } = await supabase.from('client_dp_profile' as any)
      .upsert(payload as any, { onConflict: 'client_id' });
    if (!error) await load();
    return { error };
  };
  return { profile, loading, upsert, reload: load };
}

export function useDiary(client_id: string | undefined) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    const { data } = await supabase.from('client_diary_entries' as any)
      .select('*').eq('client_id', client_id).order('occurred_at', { ascending: false });
    setEntries((data || []) as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const add = async (e: Partial<DiaryEntry>) => {
    const u = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('client_diary_entries' as any).insert({
      client_id, occurred_at: new Date().toISOString(),
      author_id: u?.id, author_name: u?.email || '', tags: e.tags || [],
      text: e.text || '', attachment_path: e.attachment_path || '',
    } as any);
    if (!error) await load();
    return { error };
  };
  const archive = async (id: string, reason: string) => {
    const u = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('client_diary_entries' as any)
      .update({ archived: true, archived_reason: reason, archived_at: new Date().toISOString(), archived_by: u?.id } as any)
      .eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { entries, loading, add, archive, reload: load };
}

export function useUploads(client_id: string | undefined) {
  const [items, setItems] = useState<ClientUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    const { data } = await supabase.from('client_uploads' as any)
      .select('*').eq('client_id', client_id).order('uploaded_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const upload = async (file: File, upload_type: string, notes = '') => {
    if (!client_id) return { error: new Error('no client') };
    const u = (await supabase.auth.getUser()).data.user;
    const ext = file.name.split('.').pop();
    const path = `${client_id}/${upload_type}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('cliente-dp-uploads').upload(path, file);
    if (upErr) return { error: upErr };
    const version = items.filter(i => i.upload_type === upload_type).length + 1;
    const { error } = await supabase.from('client_uploads' as any).insert({
      client_id, upload_type, file_path: path, file_name: file.name,
      mime_type: file.type, version, uploaded_by: u?.id, notes,
    } as any);
    if (!error) await load();
    return { error };
  };
  const getUrl = async (path: string) => {
    const { data } = await supabase.storage.from('cliente-dp-uploads').createSignedUrl(path, 3600);
    return data?.signedUrl;
  };
  return { items, loading, upload, getUrl, reload: load };
}

export function useCCTs(client_id: string | undefined) {
  const [items, setItems] = useState<ClientCCT[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    const { data } = await supabase.from('client_ccts' as any)
      .select('*').eq('client_id', client_id).order('created_at', { ascending: false });
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  return { items, loading, reload: load };
}

export function useRubrics(client_id: string | undefined) {
  const [items, setItems] = useState<ClientRubric[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) { setLoading(false); return; }
    const { data } = await supabase.from('client_rubrics' as any)
      .select('*').eq('client_id', client_id).order('code');
    setItems((data || []) as any);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (r: Partial<ClientRubric>) => {
    const { error } = await supabase.from('client_rubrics' as any).upsert({ client_id, ...r } as any);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('client_rubrics' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { items, loading, save, remove, reload: load };
}

export function useChecklistTemplates() {
  const [items, setItems] = useState<ChecklistTemplate[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('closing_checklist_templates' as any).select('*').order('name');
    setItems((data || []) as any);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { items, reload: load };
}

export function useChecklistRun(client_id: string | undefined, competence: string) {
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id || !competence) { setLoading(false); return; }
    const { data } = await supabase.from('closing_checklist_runs' as any)
      .select('*').eq('client_id', client_id).eq('competence', competence).maybeSingle();
    setRun(data as any);
    setLoading(false);
  }, [client_id, competence]);
  useEffect(() => { load(); }, [load]);
  const upsert = async (steps: any[], template_id: string | null) => {
    const { error } = await supabase.from('closing_checklist_runs' as any).upsert({
      client_id, competence, template_id, steps_status: steps,
    } as any, { onConflict: 'client_id,competence' });
    if (!error) await load();
    return { error };
  };
  return { run, loading, upsert, reload: load };
}

export function useMessageTemplates(client_id: string | undefined) {
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const load = useCallback(async () => {
    let q = supabase.from('client_message_templates' as any).select('*').order('category');
    if (client_id) q = q.or(`is_global.eq.true,client_id.eq.${client_id}`);
    else q = q.eq('is_global', true);
    const { data } = await q;
    setItems((data || []) as any);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (m: Partial<MessageTemplate>) => {
    const { error } = await supabase.from('client_message_templates' as any).upsert({ client_id, is_global: false, ...m } as any);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('client_message_templates' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { items, save, remove, reload: load };
}

export function useCalendar(client_id: string | undefined) {
  const [items, setItems] = useState<CalendarEvent[]>([]);
  const load = useCallback(async () => {
    if (!client_id) return;
    const { data } = await supabase.from('client_calendar_events' as any)
      .select('*').eq('client_id', client_id).order('event_date');
    setItems((data || []) as any);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: Partial<CalendarEvent>) => {
    const { error } = await supabase.from('client_calendar_events' as any).upsert({ client_id, ...e } as any);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('client_calendar_events' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { items, save, remove, reload: load };
}

export function useRiskFlags(client_id: string | undefined) {
  const [items, setItems] = useState<RiskFlag[]>([]);
  const load = useCallback(async () => {
    if (!client_id) return;
    const { data } = await supabase.from('client_risk_flags' as any)
      .select('*').eq('client_id', client_id).order('created_at', { ascending: false });
    setItems((data || []) as any);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const save = async (f: Partial<RiskFlag>) => {
    const { error } = await supabase.from('client_risk_flags' as any).upsert({ client_id, ...f } as any);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('client_risk_flags' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { items, save, remove, reload: load };
}

export function useAuditLog(client_id?: string) {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    let q = supabase.from('client_audit_log' as any).select('*').order('created_at', { ascending: false }).limit(200);
    if (client_id) q = q.eq('client_id', client_id);
    const { data } = await q;
    setItems((data || []) as any);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  return { items, reload: load };
}

export async function logAudit(client_id: string | null, table_name: string, record_id: string | null, action: string, changes: any) {
  const u = (await supabase.auth.getUser()).data.user;
  await supabase.from('client_audit_log' as any).insert({
    client_id, table_name, record_id, action, changes, user_id: u?.id, user_email: u?.email || ''
  } as any);
}