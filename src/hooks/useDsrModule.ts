import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  type VerbaDsr,
  type FeriadoExtendido,
  type FeriadoNacionalOverride,
  type ProvisionEntry,
  type DsrMonthlyResult,
} from '@/types/dsr';

// ──────────── Verbas DSR (estende a tabela `verbas`) ────────────
export function useVerbasDsr() {
  const [verbas, setVerbas] = useState<VerbaDsr[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVerbas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('verbas' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      setVerbas(
        (data as any[]).map((d) => ({
          id: d.id,
          codigo: d.codigo || '',
          nome: d.nome,
          tipoLancamento: (d.tipo_lancamento as any) || 'valor_fixo',
          incideDsr: !!d.incide_dsr,
          regraDsr: (d.regra_dsr as any) || 'padrao',
          regraDsrCustom: d.regra_dsr_custom,
          consideraDomingoDsr: d.considera_domingo_dsr ?? true,
          consideraFeriadoDsr: d.considera_feriado_dsr ?? true,
          observacoes: d.observacoes || '',
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVerbas();
  }, [fetchVerbas]);

  const saveVerba = async (v: VerbaDsr) => {
    const row: any = {
      id: v.id,
      codigo: v.codigo,
      nome: v.nome,
      tipo_lancamento: v.tipoLancamento,
      incide_dsr: v.incideDsr,
      regra_dsr: v.regraDsr,
      regra_dsr_custom: v.regraDsrCustom || null,
      considera_domingo_dsr: v.consideraDomingoDsr,
      considera_feriado_dsr: v.consideraFeriadoDsr,
      observacoes: v.observacoes,
      // campos legados obrigatórios
      tipo_calculo: 'manual',
      padrao_pd: 'P',
      incide_fgts: false,
      calcula_dsr: v.incideDsr,
      referencia_padrao: '',
    };
    const { error } = await supabase.from('verbas' as any).upsert(row);
    if (!error) await fetchVerbas();
    return { error };
  };

  const deleteVerba = async (id: string) => {
    const { error } = await supabase.from('verbas' as any).delete().eq('id', id);
    if (!error) await fetchVerbas();
    return { error };
  };

  return { verbas, loading, saveVerba, deleteVerba, refresh: fetchVerbas };
}

// ──────────── Feriados estendidos (municipais/estaduais/internos) ────────────
export function useFeriadosExtendidos() {
  const [feriados, setFeriados] = useState<FeriadoExtendido[]>([]);
  const [overrides, setOverrides] = useState<FeriadoNacionalOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: fer }, { data: ov }] = await Promise.all([
      supabase.from('feriados_municipais' as any).select('*').order('data', { ascending: true }),
      supabase.from('feriados_nacionais_overrides' as any).select('*'),
    ]);
    if (fer) {
      setFeriados(
        (fer as any[]).map((d) => ({
          id: d.id,
          data: d.data,
          nome: d.descricao,
          municipio: d.municipio || '',
          uf: d.uf || '',
          escopo: (d.escopo as any) || 'municipal',
          contaDiaNaoUtil: d.conta_dia_nao_util ?? true,
          contaDsr: d.conta_dsr ?? true,
        })),
      );
    }
    if (ov) {
      setOverrides(
        (ov as any[]).map((d) => ({
          id: d.id,
          ano: d.ano,
          chave: d.chave,
          pontoFacultativo: d.ponto_facultativo,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addFeriado = async (f: Omit<FeriadoExtendido, 'id'>) => {
    const { error } = await supabase.from('feriados_municipais' as any).insert({
      data: f.data,
      descricao: f.nome,
      municipio: f.municipio,
      uf: f.uf,
      escopo: f.escopo,
      conta_dia_nao_util: f.contaDiaNaoUtil,
      conta_dsr: f.contaDsr,
    });
    if (!error) await fetchAll();
    return { error };
  };

  const deleteFeriado = async (id: string) => {
    const { error } = await supabase.from('feriados_municipais' as any).delete().eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  const updateFeriado = async (f: FeriadoExtendido) => {
    const { error } = await supabase
      .from('feriados_municipais' as any)
      .update({
        data: f.data,
        descricao: f.nome,
        municipio: f.municipio,
        uf: f.uf,
        escopo: f.escopo,
        conta_dia_nao_util: f.contaDiaNaoUtil,
        conta_dsr: f.contaDsr,
      })
      .eq('id', f.id);
    if (!error) await fetchAll();
    return { error };
  };

  const setOverrideNacional = async (ano: number, chave: string, pontoFacultativo: boolean) => {
    const { error } = await supabase
      .from('feriados_nacionais_overrides' as any)
      .upsert({ ano, chave, ponto_facultativo: pontoFacultativo }, { onConflict: 'ano,chave' });
    if (!error) await fetchAll();
    return { error };
  };

  return { feriados, overrides, loading, addFeriado, updateFeriado, deleteFeriado, setOverrideNacional, refresh: fetchAll };
}

// ──────────── Lançamentos de provisões ────────────
export function useProvisionEntries(empresaNome?: string, competencia?: string) {
  const [entries, setEntries] = useState<ProvisionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('provision_entries' as any).select('*').order('created_at', { ascending: true });
    if (empresaNome) q = q.eq('empresa_nome', empresaNome);
    if (competencia) q = q.eq('competencia', competencia);
    const { data, error } = await q;
    if (!error && data) {
      setEntries(
        (data as any[]).map((d) => ({
          id: d.id,
          empresaNome: d.empresa_nome,
          competencia: d.competencia,
          centroCusto: d.centro_custo || '',
          colaborador: d.colaborador || '',
          verbaId: d.verba_id,
          tipoLancamento: d.tipo_lancamento,
          valor: Number(d.valor) || 0,
          quantidade: Number(d.quantidade) || 0,
          valorUnitario: Number(d.valor_unitario) || 0,
          observacao: d.observacao || '',
        })),
      );
    }
    setLoading(false);
  }, [empresaNome, competencia]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntry = async (e: ProvisionEntry) => {
    const row: any = {
      id: e.id,
      empresa_nome: e.empresaNome,
      competencia: e.competencia,
      centro_custo: e.centroCusto,
      colaborador: e.colaborador,
      verba_id: e.verbaId,
      tipo_lancamento: e.tipoLancamento,
      valor: e.valor,
      quantidade: e.quantidade,
      valor_unitario: e.valorUnitario,
      observacao: e.observacao,
    };
    const { error } = await supabase.from('provision_entries' as any).upsert(row);
    if (!error) await fetchEntries();
    return { error };
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('provision_entries' as any).delete().eq('id', id);
    if (!error) await fetchEntries();
    return { error };
  };

  return { entries, loading, saveEntry, deleteEntry, refresh: fetchEntries };
}

// ──────────── Resultados mensais (persistir apuração) ────────────
export function useDsrResults() {
  const saveResult = async (r: DsrMonthlyResult) => {
    const row: any = {
      empresa_nome: r.empresaNome,
      competencia: r.competencia,
      dias_uteis: r.diasUteis,
      dias_dsr: r.diasDsr,
      domingos: r.domingos,
      feriados_nao_uteis: r.feriadosNaoUteis,
      detalhe_verbas: r.detalheVerbas,
      total_base: r.totalBase,
      total_dsr: r.totalDsr,
    };
    const { error } = await supabase
      .from('dsr_monthly_results' as any)
      .upsert(row, { onConflict: 'empresa_nome,competencia' });
    return { error };
  };

  const fetchPeriodo = async (empresaNome: string, compIni: string, compFim: string) => {
    let q = supabase
      .from('dsr_monthly_results' as any)
      .select('*')
      .gte('competencia', compIni)
      .lte('competencia', compFim)
      .order('competencia', { ascending: true });
    if (empresaNome) q = q.eq('empresa_nome', empresaNome);
    const { data, error } = await q;
    return { data: (data as any[]) || [], error };
  };

  const deleteResult = async (empresaNome: string, competencia: string) => {
    let q = supabase.from('dsr_monthly_results' as any).delete().eq('competencia', competencia);
    q = q.eq('empresa_nome', empresaNome || '');
    const { error } = await q;
    return { error };
  };

  const deletePeriodo = async (empresaNome: string, compIni: string, compFim: string) => {
    let q = supabase
      .from('dsr_monthly_results' as any)
      .delete()
      .gte('competencia', compIni)
      .lte('competencia', compFim);
    q = q.eq('empresa_nome', empresaNome || '');
    const { error } = await q;
    return { error };
  };

  return { saveResult, fetchPeriodo, deleteResult, deletePeriodo };
}