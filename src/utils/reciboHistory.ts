import type { ReciboData } from '@/types/recibo';
import { calcularTotaisRecibo } from '@/types/recibo';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export const RECIBO_HISTORY_KEY = 'recibo_avulso_history_v1';

export interface SavedRecibo {
  id: string;
  label: string;
  total: number;
  createdAt: number;
  updatedAt: number;
  data: ReciboData;
  synced?: boolean;
}

export function loadReciboHistory(): SavedRecibo[] {
  try {
    const raw = localStorage.getItem(RECIBO_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as SavedRecibo[] : [];
  } catch {
    return [];
  }
}

function saveAll(items: SavedRecibo[]) {
  localStorage.setItem(RECIBO_HISTORY_KEY, JSON.stringify(items));
}

function cacheRecibo(item: SavedRecibo) {
  const items = loadReciboHistory();
  saveAll([...items.filter((r) => r.id !== item.id), item]);
}

async function persistRecibo(item: SavedRecibo) {
  const { error } = await supabase.from('recibo_avulso_history').upsert({
    id: item.id,
    label: item.label,
    total: item.total,
    data: item.data as unknown as Json,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
  });
  if (error) throw error;
  const synced = { ...item, synced: true };
  cacheRecibo(synced);
  return synced;
}

export async function syncReciboHistory(): Promise<SavedRecibo[]> {
  // Import legacy local receipts only once; never replace newer server copies.
  const remote: SavedRecibo[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('recibo_avulso_history')
      .select('*').order('id').range(offset, offset + 999);
    if (error) throw error;
    remote.push(...(data ?? []).map((row) => ({
      id: row.id, label: row.label, total: Number(row.total),
      data: row.data as unknown as ReciboData,
      createdAt: Date.parse(row.created_at), updatedAt: Date.parse(row.updated_at), synced: true,
    })));
    if ((data?.length ?? 0) < 1000) break;
  }
  for (const local of loadReciboHistory().filter((r) => !r.synced)) {
    const existing = remote.find((r) => r.id === local.id);
    if (existing && existing.updatedAt >= local.updatedAt) continue;
    let item = local;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
      item = { ...local, id: crypto.randomUUID() };
      saveAll(loadReciboHistory().map((r) => r.id === local.id ? item : r));
    }
    const synced = await persistRecibo(item);
    const index = remote.findIndex((r) => r.id === synced.id);
    if (index >= 0) remote[index] = synced;
    else remote.push(synced);
  }
  saveAll(remote);
  return remote;
}

function buildLabel(r: ReciboData): string {
  const partes: string[] = [];
  if (r.recebedorNome?.trim()) partes.push(r.recebedorNome.trim());
  if (r.clienteNome?.trim()) partes.push(r.clienteNome.trim());
  if (r.competencia?.trim()) partes.push(r.competencia.trim());
  return partes.length ? partes.join(' • ') : 'Recibo sem identificação';
}

export async function upsertRecibo(id: string | null, data: ReciboData): Promise<SavedRecibo> {
  const items = loadReciboHistory();
  const now = Date.now();
  const { totalLiquido } = calcularTotaisRecibo(data.linhas, data.calcularFGTS, data.aliquotaFGTS);
  const label = buildLabel(data);

  if (id) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      const updated: SavedRecibo = {
        ...items[idx],
        label,
        total: totalLiquido,
        updatedAt: now,
        data,
        synced: false,
      };
      items[idx] = updated;
      saveAll(items);
      return persistRecibo(updated);
    }
  }

  const created: SavedRecibo = {
    id: id ?? crypto.randomUUID(),
    label,
    total: totalLiquido,
    createdAt: now,
    updatedAt: now,
    data,
    synced: false,
  };
  items.push(created);
  saveAll(items);
  return persistRecibo(created);
}

export async function deleteRecibo(id: string) {
  const { error } = await supabase.from('recibo_avulso_history').delete().eq('id', id);
  if (error) throw error;
  saveAll(loadReciboHistory().filter((i) => i.id !== id));
}