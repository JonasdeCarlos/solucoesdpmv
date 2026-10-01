import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_MODELO, DEFAULT_RUBRICAS, type Criterio, type Formato, type ItemCfg, type Rubrica } from '../utils/motor';

export const fbDb = supabase as any;

export interface FbConfig {
  empresa_id: string; divisor: number; tolerancia: number; criterio_ajuste: Criterio; teto_quinquenio: number | null;
  limite_he_diario: number; formato_horas: Formato; codigo_empresa_dominio: string | null; tipo_processo: string;
}
export interface FbRubrica extends Rubrica { id?: string; empresa_id: string }
export interface FbFuncionario { id: string; empresa_id: string; codigo: string; nome: string; cpf: string | null; salario_base: number; data_admissao: string | null; ativo: boolean }
export interface FbFeriado { id: string; data: string; descricao: string; abrangencia: string }
export interface FbModelo { id: string; nome: string; padrao: boolean; itens: ItemCfg[] }
export interface FbCompetencia { id: string; empresa_id: string; competencia: string; dias_uteis: number; dias_dsr: number; status: string }

const N = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));

export function useBrutoAlvo(empresaId: string | null) {
  const [config, setConfig] = useState<FbConfig | null>(null);
  const [rubricas, setRubricas] = useState<FbRubrica[]>([]);
  const [funcionarios, setFuncionarios] = useState<FbFuncionario[]>([]);
  const [feriados, setFeriados] = useState<FbFeriado[]>([]);
  const [modelos, setModelos] = useState<FbModelo[]>([]);
  const [competencias, setCompetencias] = useState<FbCompetencia[]>([]);

  const reload = useCallback(async () => {
    if (!empresaId) return;
    let [c, r, f, h, m, k] = await Promise.all([
      fbDb.from('fb_config_empresa').select('*').eq('empresa_id', empresaId).maybeSingle(),
      fbDb.from('fb_config_rubricas').select('*').eq('empresa_id', empresaId).order('ordem'),
      fbDb.from('fb_funcionarios').select('*').eq('empresa_id', empresaId).order('nome'),
      fbDb.from('fb_feriados').select('*').eq('empresa_id', empresaId).order('data'),
      fbDb.from('fb_modelos_distribuicao').select('*').eq('empresa_id', empresaId).order('nome'),
      fbDb.from('fb_competencias').select('*').eq('empresa_id', empresaId).order('competencia', { ascending: false }),
    ]);
    if (!r.data?.length) {
      await fbDb.from('fb_config_rubricas').upsert(DEFAULT_RUBRICAS.map((x) => ({ ...x, empresa_id: empresaId })), { onConflict: 'empresa_id,verba' });
      r = await fbDb.from('fb_config_rubricas').select('*').eq('empresa_id', empresaId).order('ordem');
    }
    if (!m.data?.length) {
      await fbDb.from('fb_modelos_distribuicao').insert({ empresa_id: empresaId, nome: 'Padrão', padrao: true, itens: DEFAULT_MODELO });
      m = await fbDb.from('fb_modelos_distribuicao').select('*').eq('empresa_id', empresaId).order('nome');
    }
    const cd = c.data;
    setConfig({
      empresa_id: empresaId, divisor: Number(cd?.divisor ?? 220), tolerancia: Number(cd?.tolerancia ?? 0.05), criterio_ajuste: cd?.criterio_ajuste ?? 'mais_proximo',
      teto_quinquenio: N(cd?.teto_quinquenio), limite_he_diario: Number(cd?.limite_he_diario ?? 2), formato_horas: cd?.formato_horas ?? 'hhmm',
      codigo_empresa_dominio: cd?.codigo_empresa_dominio ?? '', tipo_processo: cd?.tipo_processo ?? '11',
    });
    setRubricas((r.data || []).map((x: any) => ({ ...x, fator: Number(x.fator), valor_fixo: N(x.valor_fixo), percentual_salario: N(x.percentual_salario) })));
    setFuncionarios((f.data || []).map((x: any) => ({ ...x, salario_base: Number(x.salario_base) })));
    setFeriados(h.data || []);
    setModelos(m.data || []);
    setCompetencias(k.data || []);
  }, [empresaId]);

  useEffect(() => { reload(); }, [reload]);

  return { config, rubricas, funcionarios, feriados, modelos, competencias, reload };
}

export async function saveConfig(c: FbConfig) {
  return (await fbDb.from('fb_config_empresa').upsert({ ...c, teto_quinquenio: c.teto_quinquenio || null }, { onConflict: 'empresa_id' })).error;
}
export async function saveRubrica(r: FbRubrica) {
  const { id, ...rest } = r as any;
  return (await fbDb.from('fb_config_rubricas').upsert(rest, { onConflict: 'empresa_id,verba' })).error;
}
