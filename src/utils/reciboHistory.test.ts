import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyReciboData, createEmptyLinha } from '@/types/recibo';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), fetch: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({
    upsert: mocks.upsert,
    select: () => ({ order: () => ({ range: mocks.fetch }) }),
    delete: () => ({ eq: mocks.remove }),
  }) },
}));
import { RECIBO_HISTORY_KEY, loadReciboHistory, syncReciboHistory, upsertRecibo, deleteRecibo } from './reciboHistory';

describe('receipt persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.fetch.mockResolvedValue({ data: [], error: null });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it('saves the complete receipt remotely and updates the same ID', async () => {
    const data = { ...createEmptyReciboData(), recebedorNome: 'Teste', calcularFGTS: false,
      linhas: [{ ...createEmptyLinha(), valor: 250 }] };
    const saved = await upsertRecibo(null, data);
    const updated = await upsertRecibo(saved.id, { ...data, competencia: '10/2026' });
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ id: saved.id, total: 250,
      data: expect.objectContaining({ competencia: '10/2026' }) }));
    expect(updated.id).toBe(saved.id);
    expect(loadReciboHistory()).toHaveLength(1);
  });

  it('reports remote failure but retains an unsynced recovery copy', async () => {
    mocks.upsert.mockResolvedValue({ error: new Error('offline') });
    await expect(upsertRecibo(null, createEmptyReciboData())).rejects.toThrow('offline');
    expect(loadReciboHistory()).toHaveLength(1);
    expect(loadReciboHistory()[0].synced).toBe(false);
  });

  it('imports a legacy local receipt once and reads it on a fresh browser', async () => {
    const saved = { id: crypto.randomUUID(), label: 'Antigo', total: 250,
      createdAt: 1000, updatedAt: 2000, data: createEmptyReciboData() };
    localStorage.setItem(RECIBO_HISTORY_KEY, JSON.stringify([saved]));
    expect(await syncReciboHistory()).toHaveLength(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    localStorage.clear();
    mocks.fetch.mockResolvedValue({ data: [{ id: saved.id, label: saved.label, total: 250, data: saved.data,
      created_at: new Date(1000).toISOString(), updated_at: new Date(3000).toISOString() }], error: null });
    expect((await syncReciboHistory())[0].id).toBe(saved.id);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite newer remote receipts with legacy cache', async () => {
    const id = crypto.randomUUID();
    localStorage.setItem(RECIBO_HISTORY_KEY, JSON.stringify([{ id, updatedAt: 1000, data: createEmptyReciboData() }]));
    mocks.fetch.mockResolvedValue({ data: [{ id, label: 'Atual', total: 250, data: createEmptyReciboData(),
      created_at: new Date(1000).toISOString(), updated_at: new Date(2000).toISOString() }], error: null });
    expect((await syncReciboHistory())[0].label).toBe('Atual');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('keeps cached receipts if remote deletion fails', async () => {
    const saved = await upsertRecibo(null, createEmptyReciboData());
    mocks.remove.mockResolvedValue({ error: new Error('offline') });
    await expect(deleteRecibo(saved.id)).rejects.toThrow('offline');
    expect(loadReciboHistory()).toHaveLength(1);
  });
});