import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Campo, TipoModelo } from './lib';

export type ModeloDoc = {
  id: string; empresa_id: string; escopo: string; ref_id: string; tipo: TipoModelo; nome: string; arquivo_nome: string | null;
  pdf_base64: string; campos: Campo[]; usar_personalizado: boolean; created_at: string;
};

const t = () => supabase.from('premio_modelos_documento' as any) as any;

export function useModelosDocumento(refId: string | undefined) {
  const [items, setItems] = useState<ModeloDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!refId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await t().select('*').eq('ref_id', refId).order('created_at', { ascending: false });
    setItems((data || []) as ModeloDoc[]);
    setLoading(false);
  }, [refId]);
  useEffect(() => { load(); }, [load]);

  /** Modelo personalizado ativo para o tipo (ou null = usar modelo do sistema). */
  const ativo = (tipo: TipoModelo) => items.find(m => m.tipo === tipo && m.usar_personalizado) || null;
  const doTipo = (tipo: TipoModelo) => items.find(m => m.tipo === tipo) || null;

  const salvar = async (row: Partial<ModeloDoc>) => {
    const { error } = row.id ? await t().update(row).eq('id', row.id) : await t().insert(row);
    if (!error) await load();
    return { error };
  };
  const remover = async (id: string) => { const { error } = await t().delete().eq('id', id); if (!error) await load(); return { error }; };

  return { items, loading, reload: load, ativo, doTipo, salvar, remover };
}
