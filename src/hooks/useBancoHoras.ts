import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BancoHorasEntry {
  id: string;
  empregadoNome: string;
  empresaNome: string;
  mesAno: string;
  saldoFinal: number;
  addedAt: string;
}

export function useBancoHoras() {
  const [entries, setEntries] = useState<BancoHorasEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('banco_horas' as any)
      .select('*')
      .order('mes_ano', { ascending: true });
    if (!error && data) {
      setEntries((data as any[]).map(d => ({
        id: d.id,
        empregadoNome: d.empregado_nome,
        empresaNome: d.empresa_nome || '',
        mesAno: d.mes_ano,
        saldoFinal: d.saldo_final,
        addedAt: d.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const upsertEntry = useCallback(async (entry: Omit<BancoHorasEntry, 'id' | 'addedAt'>) => {
    // Check if exists
    const { data: existing } = await supabase
      .from('banco_horas' as any)
      .select('id')
      .eq('empregado_nome', entry.empregadoNome)
      .eq('empresa_nome', entry.empresaNome)
      .eq('mes_ano', entry.mesAno)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('banco_horas' as any)
        .update({ saldo_final: entry.saldoFinal, updated_at: new Date().toISOString() } as any)
        .eq('id', (existing as any).id);
    } else {
      await supabase
        .from('banco_horas' as any)
        .insert({
          empregado_nome: entry.empregadoNome,
          empresa_nome: entry.empresaNome,
          mes_ano: entry.mesAno,
          saldo_final: entry.saldoFinal,
        } as any);
    }
    await fetchEntries();
  }, [fetchEntries]);

  const removeEntry = useCallback(async (id: string) => {
    await supabase.from('banco_horas' as any).delete().eq('id', id);
    await fetchEntries();
  }, [fetchEntries]);

  const clearByEmpresa = useCallback(async (empresa?: string) => {
    if (empresa) {
      await supabase.from('banco_horas' as any).delete().eq('empresa_nome', empresa);
    } else {
      // Delete all - fetch all ids and delete
      const { data } = await supabase.from('banco_horas' as any).select('id');
      if (data && (data as any[]).length > 0) {
        for (const row of data as any[]) {
          await supabase.from('banco_horas' as any).delete().eq('id', row.id);
        }
      }
    }
    await fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, upsertEntry, removeEntry, clearByEmpresa };
}
