import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAuditorias(client_id?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!client_id) return;
    setLoading(true);
    const { data } = await supabase.from('auditorias' as any).select('*').eq('client_id', client_id).order('created_at', { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, [client_id]);
  useEffect(() => { load(); }, [load]);
  const create = async (payload: any) => {
    const { data, error } = await supabase.from('auditorias' as any).insert({ client_id, ...payload } as any).select().single();
    if (!error) await load();
    return { data, error };
  };
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from('auditorias' as any).update(patch).eq('id', id);
    if (!error) await load();
    return { error };
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('auditorias' as any).delete().eq('id', id);
    if (!error) await load();
    return { error };
  };
  return { items, loading, reload: load, create, update, remove };
}

export function useAuditoriaDetail(auditoria_id?: string) {
  const [auditoria, setAuditoria] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auditoria_id) return;
    setLoading(true);
    const [a, i, ac] = await Promise.all([
      supabase.from('auditorias' as any).select('*').eq('id', auditoria_id).maybeSingle(),
      supabase.from('auditoria_itens' as any).select('*').eq('auditoria_id', auditoria_id).order('area_ordem').order('item_ordem'),
      supabase.from('auditoria_acoes' as any).select('*').eq('auditoria_id', auditoria_id).order('created_at'),
    ]);
    setAuditoria(a.data as any);
    setItens((i.data as any) || []);
    setAcoes((ac.data as any) || []);
    setLoading(false);
  }, [auditoria_id]);
  useEffect(() => { load(); }, [load]);

  const insertItens = async (rows: any[]) => {
    if (!rows.length) return;
    await supabase.from('auditoria_itens' as any).insert(rows.map(r => ({ ...r, auditoria_id })) as any);
    await load();
  };
  const updateItem = async (id: string, patch: any) => {
    await supabase.from('auditoria_itens' as any).update(patch).eq('id', id);
    await load();
  };
  const updateAuditoria = async (patch: any) => {
    if (!auditoria_id) return;
    await supabase.from('auditorias' as any).update(patch).eq('id', auditoria_id);
    await load();
  };
  const upsertAcao = async (row: any) => {
    if (row.id) {
      await supabase.from('auditoria_acoes' as any).update(row).eq('id', row.id);
    } else {
      await supabase.from('auditoria_acoes' as any).insert({ ...row, auditoria_id } as any);
    }
    await load();
  };
  const deleteAcao = async (id: string) => {
    await supabase.from('auditoria_acoes' as any).delete().eq('id', id);
    await load();
  };
  const deleteItem = async (id: string) => {
    await supabase.from('auditoria_acoes' as any).delete().eq('item_id', id);
    await supabase.from('auditoria_itens' as any).delete().eq('id', id);
    await load();
  };
  return { auditoria, itens, acoes, loading, reload: load, insertItens, updateItem, deleteItem, updateAuditoria, upsertAcao, deleteAcao };
}