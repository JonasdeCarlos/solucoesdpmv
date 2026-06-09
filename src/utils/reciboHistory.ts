import type { ReciboData } from '@/types/recibo';
import { calcularTotaisRecibo } from '@/types/recibo';

export const RECIBO_HISTORY_KEY = 'recibo_avulso_history_v1';

export interface SavedRecibo {
  id: string;
  label: string;
  total: number;
  createdAt: number;
  updatedAt: number;
  data: ReciboData;
}

export function loadReciboHistory(): SavedRecibo[] {
  try {
    const raw = localStorage.getItem(RECIBO_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRecibo[];
  } catch {
    return [];
  }
}

function saveAll(items: SavedRecibo[]) {
  localStorage.setItem(RECIBO_HISTORY_KEY, JSON.stringify(items));
}

function buildLabel(r: ReciboData): string {
  const partes: string[] = [];
  if (r.recebedorNome?.trim()) partes.push(r.recebedorNome.trim());
  if (r.clienteNome?.trim()) partes.push(r.clienteNome.trim());
  if (r.competencia?.trim()) partes.push(r.competencia.trim());
  return partes.length ? partes.join(' • ') : 'Recibo sem identificação';
}

export function upsertRecibo(id: string | null, data: ReciboData): SavedRecibo {
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
      };
      items[idx] = updated;
      saveAll(items);
      return updated;
    }
  }

  const created: SavedRecibo = {
    id: (crypto as any)?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    total: totalLiquido,
    createdAt: now,
    updatedAt: now,
    data,
  };
  items.push(created);
  saveAll(items);
  return created;
}

export function deleteRecibo(id: string) {
  saveAll(loadReciboHistory().filter((i) => i.id !== id));
}