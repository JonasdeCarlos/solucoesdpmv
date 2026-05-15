import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BhImport {
  id: string;
  empresa_nome: string;
  empresa_cnpj: string;
  competencia: string | null;
  file_path: string | null;
  file_name: string;
  file_hash: string | null;
  imported_by: string;
  total_paginas: number;
  total_ok: number;
  total_pendentes: number;
  errors_json: any;
  imported_at: string;
}

export interface BhEmployee {
  id: string;
  empresa_cnpj: string;
  empresa_nome: string;
  codigo: string;
  nome: string;
  daily_minutes_override: number | null;
}

export interface BhBalance {
  id: string;
  import_id: string | null;
  employee_id: string;
  empresa_cnpj: string;
  competencia: string;
  balance_minutes: number;
  balance_hhmm: string;
  status: string;
  version: number;
  is_current: boolean;
  created_at: string;
}

export interface BhSettings {
  id: string;
  scope: string;
  empresa_cnpj: string | null;
  employee_id: string | null;
  daily_minutes: number;
  trend_threshold_minutes: number;
}

export function useBhAll() {
  const [imports, setImports] = useState<BhImport[]>([]);
  const [employees, setEmployees] = useState<BhEmployee[]>([]);
  const [balances, setBalances] = useState<BhBalance[]>([]);
  const [settings, setSettings] = useState<BhSettings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [i, e, b, s] = await Promise.all([
      supabase.from('bh_imports' as any).select('*').order('imported_at', { ascending: false }),
      supabase.from('bh_employees' as any).select('*').order('nome'),
      supabase.from('bh_balances' as any).select('*').eq('is_current', true).order('competencia'),
      supabase.from('bh_settings' as any).select('*'),
    ]);
    setImports((i.data as any) || []);
    setEmployees((e.data as any) || []);
    setBalances((b.data as any) || []);
    setSettings((s.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { imports, employees, balances, settings, loading, refetch: fetchAll };
}

export function getDailyMinutes(
  settings: BhSettings[],
  empresaCnpj: string,
  employeeId: string,
  employeeOverride: number | null = null,
): number {
  if (employeeOverride && employeeOverride > 0) return employeeOverride;
  const perEmp = settings.find((s) => s.scope === 'colaborador' && s.employee_id === employeeId);
  if (perEmp) return perEmp.daily_minutes;
  const perCnpj = settings.find((s) => s.scope === 'empresa' && s.empresa_cnpj === empresaCnpj);
  if (perCnpj) return perCnpj.daily_minutes;
  const global = settings.find((s) => s.scope === 'global');
  return global?.daily_minutes || 480;
}

export function getTrendThreshold(settings: BhSettings[]): number {
  const global = settings.find((s) => s.scope === 'global');
  return global?.trend_threshold_minutes || 60;
}
