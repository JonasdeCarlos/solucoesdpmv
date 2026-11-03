import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FaixaTabela, ParametrosIrrf, TabelasLegais, ParametrosSimulacao, ResultadoBruto } from './engine';
import { escolherVigencia } from './engine';

export const lbDb = supabase as any;

interface TodasTabelas {
  inss: (FaixaTabela & { vigencia_inicio: string })[];
  irrf: (FaixaTabela & { vigencia_inicio: string })[];
  parametros: (ParametrosIrrf & { vigencia_inicio: string })[];
}

const num = (v: any) => (v == null ? null : Number(v));

export function useTabelasLegais() {
  const [dados, setDados] = useState<TodasTabelas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        lbDb.from('lb_tabela_inss').select('*').order('faixa'),
        lbDb.from('lb_tabela_irrf').select('*').order('faixa'),
        lbDb.from('lb_parametros_irrf').select('*'),
      ]);
      if (a.error || b.error || c.error) return setErro('Não foi possível carregar as tabelas de INSS/IRRF.');
      const fx = (r: any) => ({ vigencia_inicio: r.vigencia_inicio, faixa: r.faixa, limite_superior: num(r.limite_superior), aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir) });
      setDados({
        inss: (a.data || []).map(fx),
        irrf: (b.data || []).map(fx),
        parametros: (c.data || []).map((r: any) => ({
          vigencia_inicio: r.vigencia_inicio,
          deducao_dependente: Number(r.deducao_dependente),
          desconto_simplificado: Number(r.desconto_simplificado),
          redutor_limite_isencao: Number(r.redutor_limite_isencao),
          redutor_valor_max: Number(r.redutor_valor_max),
          redutor_limite_final: Number(r.redutor_limite_final),
          redutor_constante: Number(r.redutor_constante),
          redutor_coeficiente: Number(r.redutor_coeficiente),
        })),
      });
    })();
  }, []);
  return { dados, erro };
}

/** competencia no formato yyyy-mm */
export function tabelasDaCompetencia(d: TodasTabelas, competencia: string): TabelasLegais | null {
  const c = `${competencia}-01`;
  const vInss = escolherVigencia([...new Set(d.inss.map((x) => x.vigencia_inicio))], c);
  const vIrrf = escolherVigencia([...new Set(d.irrf.map((x) => x.vigencia_inicio))], c);
  const vPar = escolherVigencia(d.parametros.map((x) => x.vigencia_inicio), c);
  if (!vInss || !vIrrf || !vPar) return null;
  const par = d.parametros.find((p) => p.vigencia_inicio === vPar)!;
  return {
    vigencia_inicio: [vInss, vIrrf, vPar].sort().pop()!,
    inss: d.inss.filter((x) => x.vigencia_inicio === vInss),
    irrf: d.irrf.filter((x) => x.vigencia_inicio === vIrrf),
    parametros: par,
  };
}

export interface LbSimulacao {
  id: string;
  created_at: string;
  empresa_id: string | null;
  empregado: string | null;
  cargo: string | null;
  competencia: string;
  liquido_alvo: number;
  parametros: ParametrosSimulacao;
  resultado: ResultadoBruto;
}

export async function salvarSimulacao(s: Omit<LbSimulacao, 'id' | 'created_at'>) {
  const { data: u } = await lbDb.auth.getUser();
  const { error } = await lbDb.from('lb_simulacoes').insert({ ...s, created_by: u?.user?.id ?? null });
  if (error) throw error;
}

export async function listarSimulacoes(): Promise<LbSimulacao[]> {
  const { data, error } = await lbDb.from('lb_simulacoes').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function excluirSimulacao(id: string) {
  const { error } = await lbDb.from('lb_simulacoes').delete().eq('id', id);
  if (error) throw error;
}
