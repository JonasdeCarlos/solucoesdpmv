import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const tbl = (n: string) => (supabase as any).from(n);
export const rpc = (fn: string, args: Record<string, any>) => (supabase as any).rpc(fn, args);

export type Politica = {
  id: string; empresa_id: string; nome: string; valor_ponto: number; pontuacao_referencia_padrao: number;
  teto_mensal_pontos: number | null; limite_saldo_negativo: number | null; meses_max_transporte: number | null;
  codigo_rubrica_dominio: string | null; vigencia_inicio: string; vigencia_fim: string | null; ativo: boolean;
};
export type Medalha = { id: string; politica_id: string; nome: string; pontos_padrao: number; cor_hex: string; icone: string | null; ordem: number; ativo: boolean };
export type Servico = { id: string; politica_id: string; codigo: string; descricao: string; gera_pontos: boolean; medalha_id: string | null; pontos_override: number | null; limite_por_competencia: number | null; exige_comprovacao: boolean; ativo: boolean };
export type Meta = { id: string; politica_id: string; nome: string; icone: string | null; quantidade_alvo: number; unidade: string | null; periodicidade: string; pontos_trofeu: number; modo_apuracao: 'automatico' | 'manual'; ativo: boolean };
export type MetaServico = { meta_id: string; servico_id: string; peso_contagem: number };
export type Desabono = { id: string; politica_id: string; codigo: string; descricao: string; pontos: number; ativo: boolean };
export type Referencia = { id: string; politica_id: string; cargo_id: string; pontuacao_referencia: number };
export type Colaborador = { id: string; empresa_id: string; codigo: string | null; nome: string; cpf: string | null; cargo_id: string | null; funcao: string | null; ativo: boolean; data_desligamento: string | null };
export type Cargo = { id: string; nome: string; area: string | null };
export type Lancamento = {
  id: string; empresa_id: string; politica_id: string; colaborador_id: string; competencia: string; data_ocorrencia: string;
  tipo: 'servico' | 'desabono' | 'ajuste'; servico_id: string | null; desabono_id: string | null; codigo: string | null; descricao: string | null;
  quantidade: number; pontos_unitarios: number; pontos_total: number; gera_pontos: boolean; referencia_os: string | null; observacao: string | null; anexo_url: string | null; created_at: string;
};
export type Apuracao = {
  id: string; colaborador_id: string; competencia: string; saldo_inicial: number; pontos_medalhas: number; medalhas_contagem: Record<string, number>;
  pontos_trofeus: number; trofeus_conquistados: Array<{ meta_id: string; nome: string; realizado: number | null; alvo: number; unidade: string | null; atingida: boolean; pontos: number }>;
  pontos_desabonos: number; saldo_apurado: number; pontuacao_referencia: number; pontos_premiaveis: number; valor_ponto: number; valor_bonificacao: number;
  saldo_transportado: number; status: 'aberta' | 'fechada' | 'exportada';
};
export type RegVersao = { id: string; politica_id: string; versao: number; texto: string; vigencia_inicio: string; publicado_em: string | null };
export type Ciencia = { id: string; colaborador_id: string; versao_regulamento_id: string; data_ciencia: string; forma: string; anexo_url: string | null };

export function efetivoPontos(s: Servico, medalhas: Medalha[]) {
  if (!s.gera_pontos) return 0;
  if (s.pontos_override !== null && s.pontos_override !== undefined) return s.pontos_override;
  return medalhas.find(m => m.id === s.medalha_id)?.pontos_padrao ?? 0;
}

export function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function shiftComp(c: string, delta: number) {
  const [y, m] = c.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const fmtComp = (c: string) => { const [y, m] = c.split('-'); return `${m}/${y}`; };
export const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function usePoliticas(empresaId: string) {
  const [items, setItems] = useState<Politica[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await tbl('premiacao_politicas').select('*').eq('empresa_id', empresaId).order('created_at');
    setItems(data || []); setLoading(false);
  }, [empresaId]);
  useEffect(() => { load(); }, [load]);
  return { items, loading, reload: load };
}

export function usePremiacaoCatalogo(politica: Politica | null) {
  const [medalhas, setMedalhas] = useState<Medalha[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [metasServicos, setMetasServicos] = useState<MetaServico[]>([]);
  const [desabonos, setDesabonos] = useState<Desabono[]>([]);
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [versoes, setVersoes] = useState<RegVersao[]>([]);
  const [ciencias, setCiencias] = useState<Ciencia[]>([]);

  const load = useCallback(async () => {
    if (!politica) return;
    const pid = politica.id;
    const [md, sv, mt, ds, rf, cl, cg, vs] = await Promise.all([
      tbl('premiacao_medalhas').select('*').eq('politica_id', pid).order('ordem'),
      tbl('premiacao_servicos').select('*').eq('politica_id', pid).order('codigo'),
      tbl('premiacao_metas').select('*').eq('politica_id', pid).order('created_at'),
      tbl('premiacao_desabonos').select('*').eq('politica_id', pid).order('codigo'),
      tbl('premiacao_referencias').select('*').eq('politica_id', pid),
      tbl('premiacao_colaboradores').select('*').eq('empresa_id', politica.empresa_id).order('nome'),
      tbl('cargos').select('id,nome,area').eq('client_id', politica.empresa_id).order('nome'),
      tbl('premiacao_regulamento_versoes').select('*').eq('politica_id', pid).order('versao', { ascending: false }),
    ]);
    setMedalhas(md.data || []); setServicos(sv.data || []); setMetas(mt.data || []); setDesabonos(ds.data || []);
    setReferencias(rf.data || []); setColaboradores(cl.data || []); setCargos(cg.data || []); setVersoes(vs.data || []);
    const metaIds = (mt.data || []).map((m: Meta) => m.id);
    if (metaIds.length) {
      const { data } = await tbl('premiacao_metas_servicos').select('*').in('meta_id', metaIds);
      setMetasServicos(data || []);
    } else setMetasServicos([]);
    const vIds = (vs.data || []).map((v: RegVersao) => v.id);
    if (vIds.length) {
      const { data } = await tbl('premiacao_ciencias').select('*').in('versao_regulamento_id', vIds);
      setCiencias(data || []);
    } else setCiencias([]);
  }, [politica]);

  useEffect(() => { load(); }, [load]);

  const refDe = (c: Colaborador | undefined) => {
    if (!politica) return 0;
    const r = c?.cargo_id ? referencias.find(x => x.cargo_id === c.cargo_id) : undefined;
    return r?.pontuacao_referencia ?? politica.pontuacao_referencia_padrao ?? 0;
  };
  const funcaoDe = (c: Colaborador | undefined) => c ? (cargos.find(x => x.id === c.cargo_id)?.nome || c.funcao || '—') : '—';
  const versaoVigente = versoes.find(v => v.publicado_em) || null;

  return { medalhas, servicos, metas, metasServicos, desabonos, referencias, colaboradores, cargos, versoes, ciencias, versaoVigente, reload: load, refDe, funcaoDe };
}

export type Catalogo = ReturnType<typeof usePremiacaoCatalogo>;
