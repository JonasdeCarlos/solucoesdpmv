import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BhEmpresaConfig {
  empresa_cnpj: string;
  empresa_nome?: string | null;
  logo_data_url?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
}

const lsKey = (cnpj: string) => `bh:config:${cnpj}`;

function readCache(cnpj: string): BhEmpresaConfig | null {
  try {
    const raw = localStorage.getItem(lsKey(cnpj));
    if (raw) return JSON.parse(raw) as BhEmpresaConfig;
    // migração dos formatos antigos
    const logo = localStorage.getItem(`bh:logo:${cnpj}`);
    const ini = localStorage.getItem(`bh:periodo-ini:${cnpj}`);
    const fim = localStorage.getItem(`bh:periodo-fim:${cnpj}`);
    if (logo || ini || fim) {
      return { empresa_cnpj: cnpj, logo_data_url: logo, periodo_inicio: ini, periodo_fim: fim };
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(cfg: BhEmpresaConfig) {
  try { localStorage.setItem(lsKey(cfg.empresa_cnpj), JSON.stringify(cfg)); } catch { /* ignore */ }
}

/**
 * Configuração fixa por empresa (logo + período do banco de horas).
 * Persistida no Supabase para não se perder ao trocar de navegador/limpar cache,
 * com cache local para carregamento imediato.
 */
export function useBhEmpresaConfig(empresaCnpj: string, empresaNome?: string) {
  const valid = !!empresaCnpj && empresaCnpj !== 'all';
  const [config, setConfig] = useState<BhEmpresaConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!valid) { setConfig(null); return; }
    const cached = readCache(empresaCnpj);
    if (cached) setConfig(cached);
    setLoading(true);
    const { data, error } = await supabase
      .from('bh_empresa_config' as any)
      .select('*')
      .eq('empresa_cnpj', empresaCnpj)
      .maybeSingle();
    if (!error && data) {
      const cfg = data as any as BhEmpresaConfig;
      setConfig(cfg);
      writeCache(cfg);
    } else if (!error && !data && cached) {
      // ainda não migrado para o banco: sobe o que estava local
      await supabase.from('bh_empresa_config' as any).upsert({
        empresa_cnpj: empresaCnpj,
        empresa_nome: empresaNome || null,
        logo_data_url: cached.logo_data_url || null,
        periodo_inicio: cached.periodo_inicio || null,
        periodo_fim: cached.periodo_fim || null,
      } as any, { onConflict: 'empresa_cnpj' } as any);
    }
    setLoading(false);
  }, [empresaCnpj, empresaNome, valid]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<Omit<BhEmpresaConfig, 'empresa_cnpj'>>) => {
    if (!valid) return;
    const next: BhEmpresaConfig = {
      empresa_cnpj: empresaCnpj,
      empresa_nome: empresaNome || config?.empresa_nome || null,
      logo_data_url: config?.logo_data_url ?? null,
      periodo_inicio: config?.periodo_inicio ?? null,
      periodo_fim: config?.periodo_fim ?? null,
      ...patch,
    };
    setConfig(next);
    writeCache(next);
    await supabase.from('bh_empresa_config' as any).upsert(next as any, { onConflict: 'empresa_cnpj' } as any);
  }, [empresaCnpj, empresaNome, config, valid]);

  return {
    logo: config?.logo_data_url || '',
    periodoInicio: config?.periodo_inicio || '',
    periodoFim: config?.periodo_fim || '',
    loading,
    save,
    reload: load,
  };
}

/** Busca a logo salva de uma empresa (usado em exportações). */
export async function fetchBhEmpresaLogo(empresaCnpj: string): Promise<string> {
  if (!empresaCnpj || empresaCnpj === 'all') return '';
  const cached = readCache(empresaCnpj);
  const { data } = await supabase
    .from('bh_empresa_config' as any)
    .select('logo_data_url')
    .eq('empresa_cnpj', empresaCnpj)
    .maybeSingle();
  return ((data as any)?.logo_data_url as string) || cached?.logo_data_url || '';
}
