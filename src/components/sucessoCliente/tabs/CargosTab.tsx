import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, Plus, Trash2, Copy, Pencil, FileDown, Loader2, Network, X, Pencil as PencilIcon, Upload, AlertTriangle, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCargos, useEstruturaSalarial } from '@/hooks/useCargos';
import { useCCTs } from '@/hooks/useSucessoCliente';
import { generateCargosPdf } from '@/utils/sucessoCliente/cargosPdf';
import { generateCargoDetalhePdf } from '@/utils/sucessoCliente/cargoDetalhePdf';
import { DebouncedInput } from '@/components/sucessoCliente/DebouncedField';
import { extractPisosCCT } from '@/utils/sucessoCliente/pisosCCT';
import CargosChat from '@/components/sucessoCliente/tabs/CargosChat';

const NIVEIS = [
  { v:'operacional', l:'Operacional' },
  { v:'tecnico', l:'Técnico' },
  { v:'analista', l:'Analista' },
  { v:'especialista', l:'Especialista' },
  { v:'gestao', l:'Gestão' },
  { v:'diretoria', l:'Diretoria' },
];

const emptyDraft = () => ({
  nome: '', cbo: '', area: '', nivel: 'analista', entrevista: '',
  contexto_ia: '',
  descricao_sumaria: '', atividades: [] as string[],
  requisitos: { escolaridade: '', experiencia: '', competencias: [] as string[] },
  salario_atual: '' as any,
  piso_salarial: '' as any,
  piso_referencia: '',
  adequacao: null as null | {
    profissao_regulamentada: boolean;
    base_legal: string;
    conselho_registro: { obrigatorio: boolean; sigla: string; descricao: string };
    observacoes_regulamentacao: string;
    titulo_cbo?: string;
  },
});

const sanitizeCargoDraft = (cargo: any = {}) => ({
  ...emptyDraft(),
  ...cargo,
  nome: cargo?.nome || '',
  cbo: cargo?.cbo || '',
  area: cargo?.area || '',
  nivel: cargo?.nivel || '',
  entrevista: cargo?.entrevista || '',
  contexto_ia: cargo?.contexto_ia || '',
  descricao_sumaria: cargo?.descricao_sumaria || '',
  atividades: Array.isArray(cargo?.atividades) ? cargo.atividades.map((s: any) => String(s || '').trim()).filter(Boolean) : [],
  requisitos: {
    escolaridade: cargo?.requisitos?.escolaridade || '',
    experiencia: cargo?.requisitos?.experiencia || '',
    competencias: Array.isArray(cargo?.requisitos?.competencias) ? cargo.requisitos.competencias.map((s: any) => String(s || '').trim()).filter(Boolean) : [],
  },
  salario_atual: cargo?.salario_atual ?? '',
  piso_salarial: cargo?.piso_salarial ?? '',
  piso_referencia: cargo?.piso_referencia || '',
});

const getCamposVaziosCargo = (cargo: any) => {
  const req = cargo?.requisitos || {};
  const isEmptyStr = (v: any) => v === null || v === undefined || (typeof v === 'string' && ['', 'null', 'undefined', '—', '-'].includes(v.trim().toLowerCase()));
  const isEmptyArr = (v: any) => !Array.isArray(v) || v.map((x) => String(x || '').trim()).filter(Boolean).length === 0;
  const fields: string[] = [];
  if (isEmptyStr(cargo?.cbo)) fields.push('cbo');
  if (isEmptyStr(cargo?.area)) fields.push('area');
  if (isEmptyStr(cargo?.nivel)) fields.push('nivel');
  if (isEmptyStr(cargo?.descricao_sumaria)) fields.push('descricao_sumaria');
  if (isEmptyArr(cargo?.atividades)) fields.push('atividades');
  if (isEmptyStr(req.escolaridade)) fields.push('requisitos.escolaridade');
  if (isEmptyStr(req.experiencia)) fields.push('requisitos.experiencia');
  if (isEmptyArr(req.competencias)) fields.push('requisitos.competencias');
  return fields;
};

export default function CargosTab({ client_id, cliente }: { client_id: string; cliente: any }) {
  const { items, save, remove, duplicate, reload } = useCargos(client_id);
  const { estrutura, save: saveEstrutura } = useEstruturaSalarial(client_id);
  const { items: ccts } = useCCTs(client_id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [filterArea, setFilterArea] = useState('all');
  const [filterNivel, setFilterNivel] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const pisosCCT = useMemo(() => extractPisosCCT(ccts as any[]), [ccts]);

  const areas = useMemo(() => Array.from(new Set(items.map(i => i.area).filter(Boolean))), [items]);
  const filtered = items.filter(i =>
    (filterArea === 'all' || i.area === filterArea) &&
    (filterNivel === 'all' || i.nivel === filterNivel)
  );

  const openNew = () => { setDraft(emptyDraft()); setOpen(true); };
  const openEdit = (c: any) => { setDraft(sanitizeCargoDraft(c)); setOpen(true); };

  const formalizar = async () => {
    if (!draft.entrevista?.trim()) return toast.error('Informe o texto da entrevista.');
    setBusy('formalizar');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-formalizar', {
        body: { nome: draft.nome, cbo: draft.cbo, entrevista: draft.entrevista },
      });
      if (error) throw error;
      setDraft((d:any) => ({ ...d, descricao_sumaria: data?.descricao_sumaria || d.descricao_sumaria, atividades: data?.atividades || d.atividades, requisitos: data?.requisitos || d.requisitos }));
      toast.success('Cargo formalizado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const buscarMTE = async () => {
    if (!draft.cbo?.trim()) return toast.error('Informe o código CBO.');
    setBusy('mte');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-cbo-mte', {
        body: { cbo: draft.cbo, nome: draft.nome },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const areas: Array<{ ordem?: string; titulo?: string; atividades?: string[] }> =
        Array.isArray(data?.areas_de_atividade) ? data.areas_de_atividade : [];
      // Fallback: API antiga só retornou "atividades" plano
      const planas: string[] = Array.isArray(data?.atividades) ? data.atividades : [];
      if (areas.length === 0 && planas.length === 0) {
        toast.info(data?.observacao || 'Nenhuma atividade encontrada para esse CBO.');
        return;
      }
      const linhas: string[] = areas.length
        ? areas.flatMap((g) => {
            const cab = `${(g.ordem || '').toString().toUpperCase()} — ${(g.titulo || '').toString().toUpperCase()}`.replace(/^ — /, '').trim();
            const atv = (g.atividades || []).map(s => s.trim()).filter(Boolean).join(', ');
            return cab ? [cab, atv].filter(Boolean) : [atv].filter(Boolean);
          })
        : planas;
      setDraft((d: any) => {
        const atuais: string[] = Array.isArray(d.atividades) ? d.atividades : [];
        const merged = Array.from(new Set([...atuais, ...linhas].map(s => s.trim()).filter(Boolean)));
        return {
          ...d,
          descricao_sumaria: d.descricao_sumaria || data?.descricao_sumaria || '',
          atividades: merged,
        };
      });
      const total = areas.reduce((s, g) => s + (g.atividades?.length || 0), 0) || planas.length;
      toast.success(`${total} atividades em ${areas.length || 1} tópico(s) trazidas do CBO ${data?.cbo || draft.cbo}${data?.titulo_oficial ? ' — ' + data.titulo_oficial : ''}.`);
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally { setBusy(null); }
  };

  const completarComIA = async () => {
    void 0;
    return _completarComIA();
  };

  const sugerirCbo = async (silent = false) => {
    if (!draft.nome?.trim()) { if (!silent) toast.error('Informe o nome do cargo.'); return; }
    setBusy('sugcbo');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-adequar', {
        body: {
          nome: draft.nome,
          empresa: cliente?.nome,
          setor: cliente?.segmento || cliente?.cnae || '',
          descricao_sumaria: draft.descricao_sumaria || '',
          atividades: draft.atividades || [],
          contexto: draft.contexto_ia || '',
        },
      });
      const msgErro = (data as any)?.error || (error as any)?.message;
      if (msgErro) { toast.error('CBO não sugerido: ' + msgErro); return; }
      const cboSug = String(data?.cbo || '').replace(/\D/g, '');
      if (!cboSug) { toast.info('A IA não encontrou um CBO para este cargo.'); return; }
      setDraft((d: any) => ({
        ...d,
        cbo: d.cbo?.trim() ? d.cbo : cboSug,
        adequacao: {
          ...(d.adequacao || {}),
          titulo_cbo: data.titulo_cbo || d.adequacao?.titulo_cbo || '',
          cbo_familia: data.cbo_familia || d.adequacao?.cbo_familia || '',
          cbo_justificativa: data.cbo_justificativa || d.adequacao?.cbo_justificativa || '',
          cbo_alternativas: data.cbo_alternativas || d.adequacao?.cbo_alternativas || [],
        },
      }));
      toast.success(`CBO sugerido: ${cboSug}${data.titulo_cbo ? ' — ' + data.titulo_cbo : ''}`);
    } catch (e: any) { toast.error('CBO não sugerido: ' + (e?.message || 'falha na IA')); }
    finally { setBusy(null); }
  };

  const adequarCargo = async () => {
    if (!draft.nome?.trim()) return toast.error('Informe o nome do cargo.');
    setBusy('adequar');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-adequar', {
        body: { nome: draft.nome, empresa: cliente?.nome, setor: cliente?.segmento || cliente?.cnae || '' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft((d: any) => ({
        ...d,
        cbo: d.cbo || data.cbo || '',
        area: d.area || data.area || '',
        nivel: d.nivel || data.nivel || d.nivel,
        descricao_sumaria: d.descricao_sumaria || data.descricao_sumaria || '',
        atividades: (Array.isArray(d.atividades) && d.atividades.length) ? d.atividades : (data.atividades || []),
        requisitos: {
          escolaridade: d.requisitos?.escolaridade || data.requisitos?.escolaridade || '',
          experiencia: d.requisitos?.experiencia || data.requisitos?.experiencia || '',
          competencias: (d.requisitos?.competencias?.length ? d.requisitos.competencias : (data.requisitos?.competencias || [])),
        },
        adequacao: {
          ...(d.adequacao || {}),
          profissao_regulamentada: !!data.profissao_regulamentada,
          base_legal: data.base_legal || '',
          conselho_registro: data.conselho_registro || { obrigatorio: false, sigla: '', descricao: '' },
          observacoes_regulamentacao: data.observacoes_regulamentacao || '',
          titulo_cbo: data.titulo_cbo || '',
          cbo_familia: data.cbo_familia || '',
          cbo_justificativa: data.cbo_justificativa || '',
          cbo_alternativas: data.cbo_alternativas || [],
        },
      }));
      toast.success(data.profissao_regulamentada
        ? `Cargo adequado. Atenção: profissão regulamentada${data.conselho_registro?.sigla ? ` (${data.conselho_registro.sigla})` : ''}.`
        : 'Cargo adequado pela IA.');
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally { setBusy(null); }
  };

  const verificarConselho = async () => {
    return _analisar({});
  };

  const usarAlternativaCbo = async (a: any) => {
    const cbo = String(a?.cbo || '').replace(/\D/g, '');
    setDraft((d: any) => ({
      ...d,
      cbo: cbo || d.cbo,
      adequacao: {
        ...(d.adequacao || {}),
        titulo_cbo: a?.titulo || d.adequacao?.titulo_cbo,
        cbo_alternativas: [],
      },
    }));
    await _analisar({ cbo: cbo || draft.cbo, titulo_cbo: a?.titulo || '', cbo_confirmado: true });
  };

  const limparPreenchimento = () => {
    setDraft((d: any) => ({ ...emptyDraft(), id: d.id, nome: d.nome }));
    toast.info('Preenchimento limpo. Nome do cargo mantido.');
  };

  const usarEsteCbo = async () => {
    const code = String(draft.cbo || '').replace(/\D/g, '');
    if (code.length < 4) return toast.error('Informe um código CBO válido (4 ou 6 dígitos).');
    setBusy('usarcbo');
    try {
      let tituloOficial = '';
      try {
        const mte = await supabase.functions.invoke('cargo-cbo-mte', { body: { cbo: code, nome: draft.nome } });
        tituloOficial = String((mte.data as any)?.titulo_oficial || '');
      } catch { /* MTE é best-effort */ }

      const { data, error } = await supabase.functions.invoke('cargo-adequar', {
        body: {
          nome: draft.nome || tituloOficial,
          empresa: cliente?.nome,
          setor: cliente?.segmento || cliente?.cnae || '',
          cbo: code,
          titulo_cbo: tituloOficial,
          cbo_confirmado: true,
          descricao_sumaria: draft.descricao_sumaria || '',
          atividades: draft.atividades || [],
          contexto: draft.contexto_ia || '',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d0: any = data;
      setDraft((d: any) => ({
        ...d,
        nome: d.nome || d0.titulo_cbo || tituloOficial || '',
        cbo: code,
        area: d0.area || d.area || '',
        nivel: d0.nivel || d.nivel,
        descricao_sumaria: d0.descricao_sumaria || d.descricao_sumaria || '',
        atividades: (d0.atividades?.length ? d0.atividades : (d.atividades || [])),
        requisitos: {
          escolaridade: d0.requisitos?.escolaridade || d.requisitos?.escolaridade || '',
          experiencia: d0.requisitos?.experiencia || d.requisitos?.experiencia || '',
          competencias: (d0.requisitos?.competencias?.length ? d0.requisitos.competencias : (d.requisitos?.competencias || [])),
        },
        adequacao: {
          ...(d.adequacao || {}),
          profissao_regulamentada: !!d0.profissao_regulamentada,
          base_legal: d0.base_legal || '',
          conselho_registro: d0.conselho_registro || { obrigatorio: false, sigla: '', descricao: '' },
          observacoes_regulamentacao: d0.observacoes_regulamentacao || '',
          titulo_cbo: tituloOficial || d0.titulo_cbo || '',
          cbo_familia: d0.cbo_familia || '',
          cbo_justificativa: d0.cbo_justificativa || '',
          cbo_alternativas: [],
          conselho_mensagem: d0.conselho_mensagem || '',
        },
      }));
      toast.success(`Cargo preenchido com base no CBO ${code}${tituloOficial ? ' — ' + tituloOficial : ''}.`);
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally { setBusy(null); }
  };

  const _analisar = async (opts: { cbo?: string; titulo_cbo?: string; cbo_confirmado?: boolean }) => {
    if (!draft.nome?.trim()) return toast.error('Informe o nome do cargo.');
    setBusy('conselho');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-adequar', {
        body: {
          nome: draft.nome,
          empresa: cliente?.nome,
          setor: cliente?.segmento || cliente?.cnae || '',
          cbo: opts.cbo ?? (draft.cbo || ''),
          titulo_cbo: opts.titulo_cbo || '',
          cbo_confirmado: !!opts.cbo_confirmado,
          descricao_sumaria: draft.descricao_sumaria || '',
          atividades: draft.atividades || [],
          contexto: draft.contexto_ia || '',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft((d: any) => ({
        ...d,
        cbo: opts.cbo_confirmado ? (opts.cbo || d.cbo) : d.cbo,
        adequacao: {
          ...(d.adequacao || {}),
          profissao_regulamentada: !!data.profissao_regulamentada,
          base_legal: data.base_legal || d.adequacao?.base_legal || '',
          conselho_registro: data.conselho_registro || { obrigatorio: false, sigla: '', descricao: '' },
          observacoes_regulamentacao: data.observacoes_regulamentacao || d.adequacao?.observacoes_regulamentacao || '',
          titulo_cbo: data.titulo_cbo || d.adequacao?.titulo_cbo || '',
          cbo_familia: data.cbo_familia || d.adequacao?.cbo_familia || '',
          cbo_justificativa: data.cbo_justificativa || d.adequacao?.cbo_justificativa || '',
          cbo_alternativas: opts.cbo_confirmado ? [] : (data.cbo_alternativas?.length ? data.cbo_alternativas : (d.adequacao?.cbo_alternativas || [])),
          conselho_mensagem: data.conselho_mensagem || '',
        },
      }));
      const msg = data.conselho_mensagem || (data.conselho_registro?.obrigatorio
        ? `Exige inscrição em ${data.conselho_registro?.sigla || 'conselho'}.`
        : 'Não exige inscrição em conselho de classe.');
      if (data.conselho_registro?.obrigatorio) toast.success(msg);
      else toast.info(msg);
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally { setBusy(null); }
  };

  const _completarComIA = async () => {
    if (!draft.nome?.trim()) return toast.error('Informe ao menos o nome do cargo.');
    const camposVazios = getCamposVaziosCargo(draft);
    if (!camposVazios.length) return toast.info('Todos os campos já estavam preenchidos.');
    setBusy('completar');
    try {
      const { data, error } = await supabase.functions.invoke('cargo-completar', {
        body: { cargo: draft, empresa: cliente?.nome, campos_vazios: camposVazios },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const isEmptyStr = (v: any) => v === null || v === undefined || (typeof v === 'string' && ['', 'null', 'undefined', '—', '-'].includes(v.trim().toLowerCase()));
      const isEmptyArr = (v: any) => !Array.isArray(v) || v.map((x) => String(x || '').trim()).filter(Boolean).length === 0;
      setDraft((d: any) => {
        const reqAtual = d.requisitos || {};
        const reqIA = data?.requisitos || {};
        let preenchidos = 0;
        const next: any = { ...d };
        const tryFillStr = (k: string, val: any) => {
          if (isEmptyStr(d[k]) && !isEmptyStr(val)) { next[k] = val; preenchidos++; }
        };
        const tryFillArr = (k: string, val: any) => {
          const clean = Array.isArray(val) ? val.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
          if (isEmptyArr(d[k]) && clean.length) { next[k] = clean; preenchidos++; }
        };
        tryFillStr('cbo', data?.cbo);
        tryFillStr('area', data?.area);
        tryFillStr('nivel', data?.nivel);
        tryFillStr('descricao_sumaria', data?.descricao_sumaria);
        tryFillArr('atividades', data?.atividades);
        const novoReq = { ...reqAtual };
        if (isEmptyStr(reqAtual.escolaridade) && !isEmptyStr(reqIA.escolaridade)) { novoReq.escolaridade = reqIA.escolaridade; preenchidos++; }
        if (isEmptyStr(reqAtual.experiencia) && !isEmptyStr(reqIA.experiencia)) { novoReq.experiencia = reqIA.experiencia; preenchidos++; }
        const competenciasIA = Array.isArray(reqIA.competencias) ? reqIA.competencias.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
        if (isEmptyArr(reqAtual.competencias) && competenciasIA.length) { novoReq.competencias = competenciasIA; preenchidos++; }
        next.requisitos = novoReq;
        setTimeout(() => {
          if (preenchidos === 0) toast.error('A IA não retornou conteúdo para os campos vazios. Tente novamente em instantes.');
          else toast.success(`${preenchidos} campo(s) preenchido(s) pela IA.`);
        }, 0);
        return next;
      });
    } catch (e: any) { toast.error('Falha: ' + e.message); }
    finally { setBusy(null); }
  };

  const salvar = async () => {
    if (!draft.nome) return toast.error('Informe o nome do cargo.');
    const allowed = ['id','nome','cbo','area','nivel','entrevista','descricao_sumaria','atividades','requisitos','salario_atual','piso_salarial','piso_referencia','adequacao'];
    const payload: any = {};
    for (const k of allowed) if (k in draft) payload[k] = (draft as any)[k];
    payload.salario_atual = draft.salario_atual === '' || draft.salario_atual == null ? null : Number(draft.salario_atual);
    payload.piso_salarial = draft.piso_salarial === '' || draft.piso_salarial == null ? null : Number(draft.piso_salarial);
    try {
      await save(payload);
      setOpen(false);
      toast.success('Cargo salvo.');
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || e));
    }
  };

  const sugerirEstrutura = async () => {
    if (items.length < 2) return toast.info('Cadastre ao menos 2 cargos.');
    setBusy('estrutura');
    try {
      const { data, error } = await supabase.functions.invoke('estrutura-salarial-sugerir', {
        body: {
          empresa: cliente?.nome,
          setor: cliente?.segmento || cliente?.cnae || '',
          cargos: items.map(i => ({
            nome: i.nome, cbo: i.cbo, area: i.area, nivel: i.nivel,
            salario_atual: i.salario_atual, piso_salarial: i.piso_salarial,
            piso_referencia: i.piso_referencia,
          })),
          pisos: pisosCCT.map(p => ({ funcao: p.funcao || p.label, grupo: p.grupo, valor: p.valor, ref: p.ref })),
        },
      });
      if (error) throw error;
      // Filtra organograma para conter APENAS cargos cadastrados (preview e PDF ficam idênticos)
      const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
      const cadastrados = new Set(items.map(i => norm(i.nome)));
      const orgRaw: any[] = data?.organograma || [];
      const orgFiltrado = orgRaw.filter(n => cadastrados.has(norm(n.nome)));
      const allowedIds = new Set(orgFiltrado.map(n => n.id));
      for (const n of orgFiltrado) {
        if (n.parent_id && !allowedIds.has(n.parent_id)) n.parent_id = null;
      }
      await saveEstrutura({
        faixas: data?.faixas || [],
        escala_evolucao: data?.escala_evolucao || [],
        cargos_sugeridos: data?.cargos_sugeridos || [],
        organograma: orgFiltrado,
      });
      toast.success('Estrutura salarial sugerida.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const exportarPdf = async () => {
    const temOrg = (estrutura?.organograma || []).length > 0;
    let incluirOrganograma = false;
    if (temOrg) {
      incluirOrganograma = window.confirm('Deseja incluir o organograma no relatório final?');
    }
    setBusy('pdf');
    try {
      let introducao = ''; let consideracoes = '';
      try {
        const { data } = await supabase.functions.invoke('cargos-relatorio-textos', { body: { empresa: cliente?.nome, totalCargos: items.length } });
        introducao = data?.introducao_metodologia || '';
        consideracoes = data?.consideracoes_finais || '';
      } catch {}
      await generateCargosPdf({ empresa: cliente?.nome || '—', cargos: items, estrutura, introducao, consideracoes, incluirOrganograma, criteriosManuais: (estrutura?.criterios_manuais || []) as any[] });
      toast.success('PDF gerado.');
    } catch (e:any) { toast.error('Falha: '+e.message); }
    finally { setBusy(null); }
  };

  const updateFaixa = (idx: number, patch: any) => {
    const faixas = (estrutura?.faixas || []).map((f:any,i:number)=> i===idx ? { ...f, ...patch } : f);
    saveEstrutura({
      faixas,
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
  };

  const updateNivel = (faixaIdx: number, nivelIdx: number, valor: number) => {
    const faixas = (estrutura?.faixas || []).map((f: any, i: number) => {
      if (i !== faixaIdx) return f;
      const original = (f.niveis || []) as any[];
      // O nível editado passa a ser "fixo" (travado): nunca é recalculado pela cascata.
      let niveis = original.map((n: any, j: number) => j === nivelIdx ? { ...n, valor, fixo: true } : n);
      const isFixo = (j: number) => j === nivelIdx || niveis[j]?.fixo === true;
      // Cascata: ao alterar QUALQUER nível manualmente, toda a faixa é recalculada
      // (níveis anteriores e posteriores), exceto os níveis travados manualmente.
      const total = niveis.length;
      if (total > 1 && valor > 0) {
        const oldValor = Number(original[nivelIdx]?.valor) || 0;
        const escala = (estrutura?.escala_evolucao || []) as any[];
        const pctAtual = Number(escala[nivelIdx]?.percentual_base) || 0;
        const escalaCompleta =
          pctAtual > 0 && niveis.every((_: any, j: number) => Number(escala[j]?.percentual_base) > 0);
        const outrosPositivos = original.every((n: any, j: number) => j === nivelIdx || Number(n?.valor) > 0);

        if (escalaCompleta) {
          const ref = valor * (100 / pctAtual);
          niveis = niveis.map((n: any, j: number) =>
            isFixo(j) ? n : { ...n, valor: Math.round(ref * Number(escala[j].percentual_base)) / 100 }
          );
        } else if (oldValor > 0 && outrosPositivos) {
          // Preserva a curva atual aplicando a mesma razão aos demais níveis
          const ratio = valor / oldValor;
          niveis = niveis.map((n: any, j: number) =>
            isFixo(j) ? n : { ...n, valor: Math.round(Number(n.valor) * ratio * 100) / 100 }
          );
        } else {
          // Curva padrão: Inicial 75% -> Referência 100% (progressão linear entre os níveis)
          const pctOf = (j: number) => 0.75 + (0.25 * j) / (total - 1);
          const ref = valor / pctOf(nivelIdx);
          niveis = niveis.map((n: any, j: number) =>
            isFixo(j) ? n : { ...n, valor: Math.round(ref * pctOf(j) * 100) / 100 }
          );
        }
      }
      // Garantia final: o valor digitado nunca é sobrescrito pela cascata.
      niveis = niveis.map((n: any, j: number) => (j === nivelIdx ? { ...n, valor, fixo: true } : n));
      return { ...f, niveis };
    });
    saveEstrutura({
      faixas,
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
  };

  const removeFaixa = (idx: number) => {
    const faixas = (estrutura?.faixas || []).filter((_:any,i:number)=> i!==idx);
    saveEstrutura({
      faixas,
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
  };

  const recalcularFaixas = () => {
    const escala = (estrutura?.escala_evolucao || []) as any[];
    if (!escala.length) return toast.error('Sem escala de evolução para recalcular.');
    const faixas = (estrutura?.faixas || []).map((f: any) => {
      const niveis = (f.niveis || []) as any[];
      if (niveis.length < 2) return f;
      const inicial = Number(niveis[0]?.valor) || 0;
      const pctInicial = Number(escala[0]?.percentual_base) || 0;
      if (!inicial || !pctInicial) return f;
      const ref = inicial * (100 / pctInicial);
      const novos = niveis.map((n: any, j: number) => {
        if (j === 0) return { ...n, fixo: false };
        const pct = Number(escala[j]?.percentual_base);
        if (!pct) return { ...n, fixo: false };
        return { ...n, valor: Math.round(ref * pct) / 100, fixo: false };
      });
      return { ...f, niveis: novos };
    });
    saveEstrutura({
      faixas,
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
    toast.success('Faixas recalculadas pela escala de evolução (travas manuais liberadas).');
  };

  const removeSugestao = (idx: number) => {
    const cargos_sugeridos = (estrutura?.cargos_sugeridos || []).filter((_:any,i:number)=> i!==idx);
    saveEstrutura({
      faixas: estrutura?.faixas || [],
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos,
      organograma: estrutura?.organograma || [],
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
  };

  const addCriterio = (texto: string, cargo: string, nivelAlvo: string) => {
    const t = (texto || '').trim();
    if (!t) return;
    const c = (cargo || '').trim() || 'Geral (todos os cargos)';
    const nv = (nivelAlvo || '').trim() || 'Qualquer nível';
    const criterios_manuais = [ ...(estrutura?.criterios_manuais || []), { cargo: c, nivel_alvo: nv, texto: t, created_at: new Date().toISOString() } ];
    saveEstrutura({
      faixas: estrutura?.faixas || [],
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais,
    });
  };
  const removeCriterio = (idx: number) => {
    const criterios_manuais = (estrutura?.criterios_manuais || []).filter((_:any,i:number)=> i!==idx);
    saveEstrutura({
      faixas: estrutura?.faixas || [],
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma: estrutura?.organograma || [],
      criterios_manuais,
    });
  };

  const adotarSugestao = async (s: any) => {
    await save({
      nome: s.nome, area: s.area || '', nivel: s.nivel || 'analista', cbo: '',
      descricao_sumaria: s.justificativa || '', atividades: [],
      requisitos: { escolaridade: '', experiencia: '', competencias: [] },
      salario_atual: null,
      piso_salarial: s.salario_min || null,
      piso_referencia: 'Sugestão IA',
    });
    toast.success('Cargo adicionado ao cadastro.');
  };

  const [orgOpen, setOrgOpen] = useState(false);
  const [orgEditOpen, setOrgEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportExtrato = async (file: File) => {
    if (!file) return;
    setBusy('import');
    setImportResult(null);
    setImportOpen(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke('cargos-importar-extrato', {
        body: { pdf_base64: b64, mime: file.type || 'application/pdf', setor: cliente?.segmento || cliente?.cnae || '' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImportResult(data);
      toast.success(`${data?.linhas?.length || 0} empregados extraídos.`);
    } catch (e: any) {
      toast.error('Falha ao importar: ' + e.message);
      setImportOpen(false);
    } finally { setBusy(null); }
  };

  const normNome = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  const limparCargos = async () => {
    if (busy === 'limpar') return;
    if (!confirm(`Excluir TODOS os ${items.length} cargo(s) cadastrados deste cliente? Esta ação não pode ser desfeita.`)) return;
    setBusy('limpar');
    try {
      const { error } = await supabase.from('cargos' as any).delete().eq('client_id', client_id);
      if (error) throw error;
      await reload();
      toast.success('Cargos removidos.');
    } catch (e: any) {
      toast.error('Falha ao limpar cargos: ' + e.message);
    } finally { setBusy(null); }
  };

  const fetchExistentes = async () => {
    const { data } = await supabase.from('cargos' as any).select('nome').eq('client_id', client_id).limit(2000);
    return new Set(((data as any[]) || []).map(r => normNome(r.nome)));
  };

  const importarCargosExtrato = async () => {
    if (!importResult?.cargos?.length || busy === 'importar-cargos') return;
    setBusy('importar-cargos');
    try {
      const existentes = await fetchExistentes();
      const payloads: any[] = [];
      for (const g of importResult.cargos) {
        const k = normNome(g.cargo);
        if (!k || existentes.has(k)) continue;
        existentes.add(k);
        payloads.push({
          client_id,
          nome: g.cargo, cbo: g.cbo || '', area: '', nivel: 'operacional',
          descricao_sumaria: '', atividades: [],
          requisitos: { escolaridade: '', experiencia: '', competencias: [] },
          salario_atual: g.salario_max || g.salario_medio || null,
          piso_salarial: g.salario_min || null,
          piso_referencia: 'Importado do extrato',
        });
      }
      if (payloads.length) {
        const { error } = await supabase.from('cargos' as any).insert(payloads as any);
        if (error) throw error;
      }
      await reload();
      toast.success(`${payloads.length} cargo(s) importado(s).`);
      setImportOpen(false);
    } catch (e: any) {
      toast.error('Falha ao importar cargos: ' + e.message);
    } finally { setBusy(null); }
  };

  const adotarPcsSugerido = async () => {
    const pcs = importResult?.pcs || [];
    if (!pcs.length || busy === 'importar-pcs') return;
    setBusy('importar-pcs');
    try {
      const existentes = await fetchExistentes();
      const payloads: any[] = [];
      for (const p of pcs) {
        const k = normNome(p.nome);
        if (!k || existentes.has(k)) continue;
        existentes.add(k);
        payloads.push({
          client_id,
          nome: p.nome, cbo: p.cbo || '', area: p.area || '', nivel: p.nivel || 'analista',
          descricao_sumaria: p.justificativa || '', atividades: [],
          requisitos: { escolaridade: '', experiencia: '', competencias: [] },
          salario_atual: p.salario_referencia || null,
          piso_salarial: p.salario_inicial || null,
          piso_referencia: 'PCS sugerido pela IA',
        });
      }
      if (payloads.length) {
        const { error } = await supabase.from('cargos' as any).insert(payloads as any);
        if (error) throw error;
      }
      await reload();
      toast.success(`${payloads.length} cargo(s) adicionado(s) do PCS sugerido.`);
      setImportOpen(false);
    } catch (e: any) {
      toast.error('Falha ao adotar PCS: ' + e.message);
    } finally { setBusy(null); }
  };

  const gerarOrganograma = async () => {
    if (!(estrutura?.organograma || []).length) {
      // se ainda não tem, dispara sugestão completa
      await sugerirEstrutura();
    }
    setOrgOpen(true);
  };

  const saveOrganograma = (organograma: any[]) => {
    saveEstrutura({
      faixas: estrutura?.faixas || [],
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: estrutura?.cargos_sugeridos || [],
      organograma,
      criterios_manuais: estrutura?.criterios_manuais || [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[160px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas áreas</SelectItem>{areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterNivel} onValueChange={setFilterNivel}>
            <SelectTrigger className="w-[160px]"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos níveis</SelectItem>{NIVEIS.map(n=><SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1"/>Novo cargo</Button>
          <label>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportExtrato(f); e.currentTarget.value = ''; }} />
            <Button asChild variant="outline" disabled={busy==='import'}>
              <span className="cursor-pointer">{busy==='import' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Upload className="w-4 h-4 mr-2"/>}Importar Extrato (PDF)</span>
            </Button>
          </label>
          <Button variant="outline" onClick={sugerirEstrutura} disabled={busy==='estrutura'}>{busy==='estrutura' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}Sugerir Estrutura Salarial</Button>
          <Button variant={chatOpen ? 'default' : 'outline'} onClick={()=>setChatOpen(v=>!v)}><MessagesSquare className="w-4 h-4 mr-2"/>Consultor IA</Button>
          <Button variant="outline" onClick={gerarOrganograma} disabled={busy==='estrutura'}><Network className="w-4 h-4 mr-2"/>Gerar Organograma</Button>
          <Button variant="outline" onClick={()=>setOrgEditOpen(true)}><PencilIcon className="w-4 h-4 mr-2"/>Editar Organograma</Button>
          <Button variant="outline" onClick={exportarPdf} disabled={busy==='pdf'}>{busy==='pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileDown className="w-4 h-4 mr-2"/>}Gerar Relatório Final</Button>
          <Button variant="outline" onClick={limparCargos} disabled={busy==='limpar' || items.length===0} className="text-destructive hover:text-destructive">
            {busy==='limpar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Trash2 className="w-4 h-4 mr-2"/>}Limpar cargos
          </Button>
        </div>
      </div>

      {chatOpen && (
        <CargosChat
          empresa={cliente?.nome}
          setor={cliente?.segmento || cliente?.cnae || ''}
          cargos={items}
          estrutura={estrutura}
          pisos={pisosCCT}
          onAplicar={aplicarPropostaIA}
        />
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">Nenhum cargo cadastrado.</p> :
          filtered.map(c => (
            <Card key={c.id}><CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{c.nome} {c.cbo && <span className="text-xs text-muted-foreground">(CBO {c.cbo})</span>}</div>
                <div className="text-xs text-muted-foreground">
                  {c.area || '—'} • <Badge variant="outline">{NIVEIS.find(n=>n.v===c.nivel)?.l || c.nivel}</Badge>
                  {c.salario_atual ? ' • Salário R$ '+Number(c.salario_atual).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}
                  {c.piso_salarial ? ' • Piso R$ '+Number(c.piso_salarial).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}
                  {c.piso_referencia ? ` (${c.piso_referencia})` : ''}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={()=>openEdit(c)}><Pencil className="w-4 h-4"/></Button>
                <Button size="icon" variant="ghost" onClick={()=>duplicate(c)}><Copy className="w-4 h-4"/></Button>
                <Button size="icon" variant="ghost" title="Gerar PDF do cargo" onClick={async()=>{ try { await generateCargoDetalhePdf({ cargo: c, empresa: cliente?.nome }); toast.success('PDF do cargo gerado.'); } catch(e:any){ toast.error('Falha: '+e.message); } }}><FileDown className="w-4 h-4"/></Button>
                <Button size="icon" variant="ghost" onClick={()=>{if(confirm('Excluir cargo?')) remove(c.id);}}><Trash2 className="w-4 h-4 text-destructive"/></Button>
              </div>
            </CardContent></Card>
          ))
        }
      </div>

      {estrutura && (estrutura.faixas?.length || estrutura.escala_evolucao?.length) ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Estrutura Salarial</CardTitle>
            <Button size="sm" variant="outline" onClick={recalcularFaixas}>
              <Sparkles className="w-4 h-4 mr-1"/>Recalcular faixas
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const faixas = estrutura.faixas || [];
              // Detecta colunas de níveis (união entre cargos, mantendo ordem do primeiro)
              const nivelNomes: string[] = [];
              for (const f of faixas) {
                for (const n of (f.niveis || [])) {
                  if (!nivelNomes.includes(n.nome)) nivelNomes.push(n.nome);
                }
              }
              // Formato legado (min/mid/max) — converte para visualização
              const isLegacy = nivelNomes.length === 0 && faixas.some((f: any) => f.min != null || f.max != null);
              const cols = isLegacy ? ['Mínimo', 'Médio', 'Máximo'] : nivelNomes;
              return (
                <div className="overflow-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-muted"><tr>
                      <th className="p-2 text-left">Cargo</th>
                      <th className="p-2 text-left">Área</th>
                      <th className="p-2 text-right">Piso CCT</th>
                      {cols.map(c => <th key={c} className="p-2 text-right">{c}</th>)}
                      <th className="p-2 w-10"></th>
                    </tr></thead>
                    <tbody>
                    {faixas.map((f: any, idx: number) => {
                      const niveis = f.niveis || (isLegacy ? [
                        { nome: 'Mínimo', valor: f.min || 0 },
                        { nome: 'Médio', valor: f.mid || 0 },
                        { nome: 'Máximo', valor: f.max || 0 },
                      ] : []);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-1">
                            <DebouncedInput value={f.cargo || f.nome || ''} onCommit={(v)=>updateFaixa(idx, f.cargo != null ? { cargo: v } : { nome: v })}/>
                          </td>
                          <td className="p-1 text-xs">{f.area || (f.cargos || []).join(', ') || '—'}</td>
                          <td className="p-1 text-right text-xs text-muted-foreground">
                            {f.piso_cct ? 'R$ '+Number(f.piso_cct).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—'}
                          </td>
                          {cols.map((cn, ni) => {
                            const n = niveis.find((x: any) => x.nome === cn);
                            return (
                              <td key={cn} className="p-1">
                                <DebouncedInput type="number" value={n?.valor || 0} onCommit={(v)=> {
                                  if (f.niveis) {
                                    const realIdx = (f.niveis || []).findIndex((x:any)=>x.nome===cn);
                                    if (realIdx >= 0) updateNivel(idx, realIdx, Number(v));
                                    else updateFaixa(idx, { niveis: [...(f.niveis||[]), { nome: cn, valor: Number(v) }] });
                                  } else {
                                    // legacy
                                    const key = cn === 'Mínimo' ? 'min' : cn === 'Médio' ? 'mid' : 'max';
                                    updateFaixa(idx, { [key]: Number(v) });
                                  }
                                }}/>
                              </td>
                            );
                          })}
                          <td className="p-1 text-center">
                            <Button size="icon" variant="ghost" onClick={()=>{ if(confirm('Remover linha?')) removeFaixa(idx); }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-muted-foreground mt-1">Cada cargo ocupa uma linha. O nível "Referência" corresponde ao salário atualmente praticado; o nível "Inicial" respeita o piso da CCT quando informado.</p>
                </div>
              );
            })()}
            {(estrutura.cargos_sugeridos || []).length ? (
              <div>
                <div className="text-sm font-semibold mb-1">Cargos sugeridos pela IA (não cadastrados)</div>
                <div className="space-y-1">
                  {(estrutura.cargos_sugeridos || []).map((s:any, i:number) => (
                    <Card key={i}><CardContent className="p-2 flex items-center justify-between gap-2">
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{s.nome} <span className="text-xs text-muted-foreground">• {s.area || '—'} • {s.nivel || '—'}</span></div>
                        <div className="text-xs text-muted-foreground">{s.justificativa}</div>
                        <div className="text-xs">Faixa sugerida: R$ {Number(s.salario_min||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} — R$ {Number(s.salario_max||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={()=>adotarSugestao(s)}>Adotar</Button>
                        <Button size="icon" variant="ghost" onClick={()=>removeSugestao(i)}><X className="w-4 h-4 text-destructive"/></Button>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ) : null}
            {estrutura.escala_evolucao?.length ? (
              <div>
                <div className="text-sm font-semibold mb-1">Escala de evolução</div>
                <p className="text-[11px] text-muted-foreground mb-2">O percentual indica quanto cada etapa representa do <strong>salário de Referência</strong> (teto, equivalente ao salário atualmente praticado). Ex.: 75% = salário inicial é 75% do teto do cargo.</p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {estrutura.escala_evolucao.map((e:any,i:number) => (
                    <Card key={i}><CardContent className="p-2 text-center">
                      <div className="text-xs text-muted-foreground">{e.etapa}</div>
                      <div className="text-xl font-bold">{e.percentual_base}%</div>
                      <div className="text-xs">{e.descricao}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ) : null}
            <CriteriosManuaisBlock
              criterios={(estrutura?.criterios_manuais || []) as any[]}
              cargos={items}
              etapas={(estrutura?.escala_evolucao || []).map((e: any) => e.etapa).filter(Boolean)}
              onAdd={addCriterio}
              onRemove={removeCriterio}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{draft.id ? 'Editar cargo' : 'Novo cargo'}</DialogTitle></DialogHeader>
          <div className="flex justify-end gap-2 mb-1 flex-wrap">
            <Button type="button" size="sm" variant="default" onClick={adequarCargo} disabled={busy==='adequar' || !draft.nome?.trim()} title="Sugere CBO, descrição, atividades, regulamentação e conselho a partir do nome do cargo.">
              {busy==='adequar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
              Adequar cargo (IA)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={verificarConselho} disabled={busy==='conselho' || !draft.nome?.trim()} title="Verifica se o cargo exige inscrição em conselho de classe (CRC, OAB, CAU, CREA, COREN, CRM etc.).">
              {busy==='conselho' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <AlertTriangle className="w-4 h-4 mr-2"/>}
              Exige conselho? (CRC/OAB/CAU…)
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={completarComIA} disabled={busy==='completar'}>
              {busy==='completar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
              Preencher campos vazios com IA
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={limparPreenchimento} disabled={!!busy} title="Limpa todos os campos preenchidos, mantendo apenas o nome do cargo.">
              <Trash2 className="w-4 h-4 mr-2"/>Limpar preenchimento
            </Button>
          </div>
          {draft.adequacao && (
            <div className={`border rounded-md p-3 mb-2 text-sm ${draft.adequacao.profissao_regulamentada ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/40'}`}>
              <div className="flex items-center gap-2 mb-1">
                {draft.adequacao.profissao_regulamentada
                  ? <AlertTriangle className="w-4 h-4 text-amber-600"/>
                  : <Sparkles className="w-4 h-4 text-primary"/>}
                <strong>
                  {draft.adequacao.profissao_regulamentada ? 'Profissão regulamentada' : 'Profissão não regulamentada'}
                </strong>
                {draft.adequacao.titulo_cbo && (
                  <Badge variant="outline" className="ml-auto">CBO: {draft.adequacao.titulo_cbo}</Badge>
                )}
              </div>
              {draft.adequacao.base_legal && (
                <div className="text-xs"><strong>Base legal:</strong> {draft.adequacao.base_legal}</div>
              )}
              {draft.adequacao.conselho_registro?.obrigatorio && (
                <div className="text-xs mt-1">
                  <strong>Registro em conselho obrigatório:</strong> {draft.adequacao.conselho_registro.sigla}
                  {draft.adequacao.conselho_registro.descricao ? ` — ${draft.adequacao.conselho_registro.descricao}` : ''}
                </div>
              )}
              {!draft.adequacao.conselho_registro?.obrigatorio && draft.adequacao.conselho_registro?.descricao && (
                <div className="text-xs mt-1"><strong>Conselho:</strong> {draft.adequacao.conselho_registro.descricao}</div>
              )}
              {draft.adequacao.observacoes_regulamentacao && (
                <div className="text-xs mt-1"><strong>Observações:</strong> {draft.adequacao.observacoes_regulamentacao}</div>
              )}
              {draft.adequacao.cbo_familia && (
                <div className="text-xs mt-1"><strong>Família ocupacional:</strong> {draft.adequacao.cbo_familia}</div>
              )}
              {draft.adequacao.cbo_justificativa && (
                <div className="text-xs mt-1"><strong>Por que este CBO:</strong> {draft.adequacao.cbo_justificativa}</div>
              )}
              {Array.isArray(draft.adequacao.cbo_alternativas) && draft.adequacao.cbo_alternativas.length > 0 && (
                <div className="text-xs mt-1">
                  <strong>Alternativas de CBO:</strong>
                  <ul className="list-disc ml-4">
                    {draft.adequacao.cbo_alternativas.map((a: any, i: number) => (
                      <li key={i}>
                        {a.cbo} — {a.titulo}{a.quando_usar ? ` (${a.quando_usar})` : ''}
                        <button
                          type="button"
                          disabled={busy === 'conselho'}
                          className="ml-2 underline text-primary"
                          onClick={() => usarAlternativaCbo(a)}
                        >{busy === 'conselho' ? 'analisando…' : 'usar'}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {draft.adequacao.conselho_mensagem && (
                <div className="text-xs mt-1 p-2 rounded bg-background/60 border">
                  <strong>Inscrição em conselho de classe:</strong> {draft.adequacao.conselho_mensagem}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-2">Sugestão gerada por IA — confirme com a legislação vigente e a CCT aplicável.</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome do cargo</Label>
              <Input
                value={draft.nome}
                onChange={e=>setDraft({...draft,nome:e.target.value})}
                onBlur={()=>{ if (draft.nome?.trim() && !draft.cbo?.trim() && !busy) sugerirCbo(true); }}
              />
              <div className="text-[10px] text-muted-foreground mt-1">Ao sair deste campo, o CBO é sugerido automaticamente pela IA.</div>
            </div>
            <div className="md:col-span-2 order-none">
              <Label className="text-xs">O que este cargo executa? (contexto para a IA)</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: cuida de admissões, folha de pagamento, eSocial, férias, rescisões e obrigações trabalhistas dos clientes do escritório."
                value={draft.contexto_ia}
                onChange={e=>setDraft({...draft, contexto_ia: e.target.value})}
              />
              <div className="text-[10px] text-muted-foreground mt-1">Descreva as principais rotinas do cargo — quanto mais claro, mais assertivo será o CBO sugerido.</div>
            </div>
            <div>
              <Label className="text-xs">CBO</Label>
              <Input value={draft.cbo} onChange={e=>setDraft({...draft,cbo:e.target.value})}/>
              <Button
                type="button" size="sm" variant="secondary" className="mt-2 w-full"
                onClick={()=>sugerirCbo(false)}
                disabled={busy==='sugcbo' || !draft.nome?.trim()}
                title="Sugere o código CBO e o título oficial a partir do nome do cargo."
              >
                {busy==='sugcbo' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                Sugerir CBO pelo nome
              </Button>
              <Button
                type="button" size="sm" variant="outline" className="mt-2 w-full"
                onClick={usarEsteCbo}
                disabled={busy==='usarcbo' || !draft.cbo?.trim()}
                title="Preenche o cargo com base no CBO informado, traz o título oficial do MTE e verifica regulamentação/conselho de classe."
              >
                {busy==='usarcbo' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                Usar este CBO
              </Button>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Título oficial do CBO</Label>
              <Input
                value={draft.adequacao?.titulo_cbo || ''}
                placeholder="Ex.: Produtor de audiovisual"
                onChange={e=>setDraft({...draft, adequacao: { ...(draft.adequacao || {}), titulo_cbo: e.target.value }})}
              />
            </div>
            <div><Label className="text-xs">Área / Departamento</Label><Input value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}/></div>
            <div><Label className="text-xs">Nível</Label>
              <Select value={draft.nivel} onValueChange={v=>setDraft({...draft,nivel:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{NIVEIS.map(n=><SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Salário atual (opcional)</Label><Input type="number" value={draft.salario_atual} onChange={e=>setDraft({...draft,salario_atual:e.target.value})}/></div>
            <div>
              <Label className="text-xs">Piso da categoria (CCT)</Label>
              <Select
                value={draft.piso_referencia ? `ref:${draft.piso_referencia}` : 'manual'}
                onValueChange={(v) => {
                  if (v === 'manual') { setDraft({ ...draft, piso_referencia: '' }); return; }
                  const idx = Number(v.replace('idx:', ''));
                  const p = pisosCCT[idx];
                  if (!p) return;
                  setDraft({ ...draft, piso_salarial: p.valor || draft.piso_salarial, piso_referencia: p.ref });
                }}
              >
                <SelectTrigger><SelectValue placeholder={pisosCCT.length ? 'Selecionar piso evidenciado…' : 'Nenhum piso na CCT — informar manual'}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Informar manualmente</SelectItem>
                  {pisosCCT.map((p, i) => (
                    <SelectItem key={i} value={`idx:${i}`}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pisosCCT.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full"
                  onClick={() => {
                    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const n = norm(draft.nome);
                    if (!n) return toast.error('Informe o nome do cargo antes.');
                    const match = pisosCCT.find(p => p.funcao && norm(p.funcao).includes(n))
                      || pisosCCT.find(p => p.funcao && n.includes(norm(p.funcao)));
                    if (!match) return toast.info('Nenhum piso da CCT correspondente ao nome do cargo. Selecione manualmente.');
                    setDraft({ ...draft, piso_salarial: match.valor, piso_referencia: match.ref });
                    toast.success(`Piso trazido da CCT: R$ ${Number(match.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
                  }}
                ><Sparkles className="w-3 h-3 mr-1"/>Sugerir piso pela CCT</Button>
              )}
            </div>
            <div>
              <Label className="text-xs">Valor do piso (R$)</Label>
              <Input type="number" step="0.01" value={draft.piso_salarial} onChange={e=>setDraft({...draft,piso_salarial:e.target.value})}/>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Referência do piso (CCT / cláusula)</Label>
              <Input value={draft.piso_referencia || ''} onChange={e=>setDraft({...draft,piso_referencia:e.target.value})} placeholder="Ex.: SINDICATO XYZ — cláusula 5ª, data-base 2025"/>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Entrevista com ocupante/gestor</Label><Textarea rows={5} value={draft.entrevista} onChange={e=>setDraft({...draft,entrevista:e.target.value})}/></div>
            <div className="md:col-span-2 flex justify-end">
              <Button variant="outline" onClick={formalizar} disabled={busy==='formalizar'}>{busy==='formalizar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}Formalizar com IA</Button>
            </div>
            <div className="md:col-span-2"><Label className="text-xs">Descrição sumária</Label><Textarea rows={4} value={draft.descricao_sumaria} onChange={e=>setDraft({...draft,descricao_sumaria:e.target.value})}/></div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Atividades (uma por linha)</Label>
                <Button type="button" size="sm" variant="outline" onClick={buscarMTE} disabled={busy==='mte' || !draft.cbo}>
                  {busy==='mte' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                  Trazer atividades do CBO/MTE
                </Button>
              </div>
              <Textarea rows={6} value={(draft.atividades||[]).join('\n')} onChange={e=>setDraft({...draft,atividades:e.target.value.split('\n').filter(Boolean)})}/>
            </div>
            <div><Label className="text-xs">Escolaridade</Label><Input value={draft.requisitos?.escolaridade||''} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,escolaridade:e.target.value}})}/></div>
            <div><Label className="text-xs">Experiência</Label><Input value={draft.requisitos?.experiencia||''} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,experiencia:e.target.value}})}/></div>
            <div className="md:col-span-2"><Label className="text-xs">Competências (vírgula)</Label>
              <Input value={(draft.requisitos?.competencias||[]).join(', ')} onChange={e=>setDraft({...draft,requisitos:{...draft.requisitos,competencias:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}})}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
            {draft.id && (
              <Button variant="outline" onClick={async()=>{ try { await generateCargoDetalhePdf({ cargo: draft, empresa: cliente?.nome }); toast.success('PDF do cargo gerado.'); } catch(e:any){ toast.error('Falha: '+e.message); } }}>
                <FileDown className="w-4 h-4 mr-1"/>PDF do cargo
              </Button>
            )}
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orgOpen} onOpenChange={setOrgOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Organograma sugerido</DialogTitle></DialogHeader>
          {(estrutura?.organograma || []).length ? (
            <OrgChart nodes={estrutura.organograma} cadastrados={items.map((i:any)=>i.nome)} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum organograma disponível. Clique em "Sugerir Estrutura Salarial" para gerar.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={orgEditOpen} onOpenChange={setOrgEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Editar Organograma</DialogTitle></DialogHeader>
          <OrgEditor
            nodes={estrutura?.organograma || []}
            cargos={items}
            onChange={saveOrganograma}
          />
          <DialogFooter>
            <Button onClick={()=>setOrgEditOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importação do Extrato — análise por IA</DialogTitle></DialogHeader>
          {busy === 'import' && !importResult && (
            <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              Lendo extrato e identificando cargos, CBO e salários…
            </div>
          )}
          {importResult && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-semibold mb-1">Cargos identificados ({importResult.cargos?.length || 0})</div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr>
                      <th className="text-left p-2">Cargo</th><th className="text-left p-2">CBO</th>
                      <th className="text-right p-2">Qtd</th><th className="text-right p-2">Sal. mín</th>
                      <th className="text-right p-2">Sal. máx</th><th className="text-left p-2">Funcionários</th>
                    </tr></thead>
                    <tbody>
                      {(importResult.cargos || []).map((g: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{g.cargo}</td>
                          <td className="p-2">{g.cbo || '—'}</td>
                          <td className="p-2 text-right">{g.qtd}</td>
                          <td className="p-2 text-right">R$ {Number(g.salario_min).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                          <td className="p-2 text-right">R$ {Number(g.salario_max).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                          <td className="p-2 text-muted-foreground">{(g.funcionarios || []).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(importResult.inconsistencias || []).length > 0 && (
                <div>
                  <div className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600"/>Inconsistências detectadas</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importResult.inconsistencias.map((it: any, i: number) => (
                      <li key={i}><Badge variant="outline" className="mr-2">{it.tipo}</Badge>{it.descricao}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(importResult.pcs || []).length > 0 && (
                <div>
                  <div className="font-semibold mb-1">PCS sugerido pela IA</div>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted"><tr>
                        <th className="text-left p-2">Cargo</th><th className="text-left p-2">Área</th>
                        <th className="text-left p-2">Nível</th><th className="text-right p-2">Inicial</th>
                        <th className="text-right p-2">Referência</th><th className="text-left p-2">Justificativa</th>
                      </tr></thead>
                      <tbody>
                        {importResult.pcs.map((p: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-medium">{p.nome}</td>
                            <td className="p-2">{p.area}</td>
                            <td className="p-2">{p.nivel}</td>
                            <td className="p-2 text-right">R$ {Number(p.salario_inicial||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                            <td className="p-2 text-right">R$ {Number(p.salario_referencia||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                            <td className="p-2 text-muted-foreground">{p.justificativa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(importResult.recomendacoes || []).length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Recomendações</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importResult.recomendacoes.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Fechar</Button>
            {importResult?.cargos?.length ? (
              <Button variant="outline" onClick={importarCargosExtrato} disabled={busy === 'importar-cargos'}>
                {busy === 'importar-cargos' && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}Importar cargos do extrato
              </Button>
            ) : null}
            {importResult?.pcs?.length ? (
              <Button onClick={adotarPcsSugerido} disabled={busy === 'importar-pcs'}>
                {busy === 'importar-pcs' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}Adotar PCS sugerido
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgEditor({ nodes, cargos, onChange }: { nodes: any[]; cargos: any[]; onChange: (n: any[]) => void }) {
  const [novoNome, setNovoNome] = useState('');
  const [novoNivel, setNovoNivel] = useState('analista');
  const [novoParent, setNovoParent] = useState<string>('none');

  const genId = () => 'org_' + Math.random().toString(36).slice(2, 10);

  const add = () => {
    if (!novoNome.trim()) return toast.error('Informe o nome do cargo.');
    const next = [...nodes, { id: genId(), nome: novoNome.trim(), nivel: novoNivel, parent_id: novoParent === 'none' ? null : novoParent }];
    onChange(next);
    setNovoNome(''); setNovoParent('none');
  };

  const update = (id: string, patch: any) => {
    const next = nodes.map(n => n.id === id ? { ...n, ...patch } : n);
    onChange(next);
  };

  const remove = (id: string) => {
    if (!confirm('Remover este cargo do organograma?')) return;
    // remove e re-aponta filhos para null
    const next = nodes.filter(n => n.id !== id).map(n => n.parent_id === id ? { ...n, parent_id: null } : n);
    onChange(next);
  };

  const addCargoCadastrado = (nome: string) => {
    if (nodes.some(n => (n.nome || '').toLowerCase() === nome.toLowerCase())) return;
    const cargo = cargos.find(c => c.nome === nome);
    onChange([...nodes, { id: genId(), nome, nivel: cargo?.nivel || 'analista', parent_id: null }]);
  };

  const naoAdicionados = cargos.filter(c => !nodes.some(n => (n.nome || '').toLowerCase() === (c.nome || '').toLowerCase()));

  return (
    <div className="space-y-4">
      {naoAdicionados.length > 0 && (
        <div>
          <Label className="text-xs">Cargos cadastrados ainda fora do organograma</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {naoAdicionados.map(c => (
              <Button key={c.id} size="sm" variant="outline" onClick={()=>addCargoCadastrado(c.nome)}>
                <Plus className="w-3 h-3 mr-1"/>{c.nome}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-sm font-semibold">Adicionar novo nó</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Nome do cargo" value={novoNome} onChange={e=>setNovoNome(e.target.value)} />
          <Select value={novoNivel} onValueChange={setNovoNivel}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{NIVEIS.map(n => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={novoParent} onValueChange={setNovoParent}>
            <SelectTrigger><SelectValue placeholder="Reporta a…"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Topo (sem chefe) —</SelectItem>
              {nodes.map(n => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={add}><Plus className="w-4 h-4 mr-1"/>Adicionar</Button>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-semibold">Estrutura atual ({nodes.length})</div>
        {nodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum nó. Adicione cargos acima.</p>
        ) : (
          <div className="space-y-1">
            {nodes.map(n => (
              <div key={n.id} className="flex items-center gap-2 border rounded p-2">
                <Input className="flex-1" value={n.nome} onChange={e=>update(n.id, { nome: e.target.value })} />
                <Select value={n.nivel || 'analista'} onValueChange={(v)=>update(n.id, { nivel: v })}>
                  <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
                  <SelectContent>{NIVEIS.map(nv => <SelectItem key={nv.v} value={nv.v}>{nv.l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={n.parent_id || 'none'} onValueChange={(v)=>update(n.id, { parent_id: v === 'none' ? null : v })}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Reporta a…"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Topo —</SelectItem>
                    {nodes.filter(o => o.id !== n.id).map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={()=>remove(n.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgChart({ nodes, cadastrados }: { nodes: any[]; cadastrados: string[] }) {
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
  const allow = new Set((cadastrados || []).map(norm));
  const filtered = nodes.filter(n => allow.has(norm(n.nome)));
  const allowedIds = new Set(filtered.map(n => n.id));
  const cleaned = filtered.map(n => ({ ...n, parent_id: n.parent_id && allowedIds.has(n.parent_id) ? n.parent_id : null }));
  const byParent = new Map<string | null, any[]>();
  for (const n of cleaned) {
    const k = n.parent_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(n);
  }
  const renderNode = (n: any): any => {
    const children = byParent.get(n.id) || [];
    return (
      <div key={n.id} className="flex flex-col items-center">
        <div className="px-3 py-2 rounded-md border bg-card shadow-sm text-center min-w-[140px]">
          <div className="text-sm font-semibold">{n.nome}</div>
          {n.nivel && <div className="text-[10px] text-muted-foreground uppercase">{n.nivel}</div>}
        </div>
        {children.length ? (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex gap-4 items-start pt-2 border-t border-border">
              {children.map(renderNode)}
            </div>
          </>
        ) : null}
      </div>
    );
  };
  const roots = byParent.get(null) || [];
  return (
    <div className="overflow-auto p-4">
      <div className="flex gap-6 justify-center items-start">
        {roots.map(renderNode)}
      </div>
    </div>
  );
}

function CriteriosManuaisBlock({ criterios, cargos, etapas, onAdd, onRemove }: { criterios: any[]; cargos: any[]; etapas: string[]; onAdd: (t: string, cargo: string, nivelAlvo: string) => void; onRemove: (i: number) => void }) {
  const [v, setV] = useState('');
  const [cargoSel, setCargoSel] = useState<string>('__all__');
  const [nivelSel, setNivelSel] = useState<string>('__any__');
  const opcoesNiveis = etapas && etapas.length ? etapas : ['Inicial','Pleno','Sênior','Especialista','Referência'];
  const submit = () => {
    const cargoNome = cargoSel === '__all__' ? 'Geral (todos os cargos)' : cargoSel;
    const nivelNome = nivelSel === '__any__' ? 'Qualquer nível' : `Para alcançar ${nivelSel}`;
    onAdd(v, cargoNome, nivelNome);
    setV('');
  };
  return (
    <div className="pt-2 border-t">
      <div className="text-sm font-semibold mb-1">Critérios específicos para evolução salarial</div>
      <p className="text-[11px] text-muted-foreground mb-2">Adicione critérios complementares aos sugeridos pela IA (ex.: avaliação de desempenho semestral, certificações específicas, tempo mínimo no nível). Informe o cargo e o nível-alvo (ex.: "Para alcançar Pleno") a que o critério se refere. Serão incluídos no relatório final.</p>
      <div className="flex flex-wrap gap-2 mb-2 items-end">
        <div className="min-w-[200px]">
          <Label className="text-xs">Cargo de referência</Label>
          <Select value={cargoSel} onValueChange={setCargoSel}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Geral (todos os cargos)</SelectItem>
              {cargos.map((c:any) => (
                <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-xs">Nível-alvo</Label>
          <Select value={nivelSel} onValueChange={setNivelSel}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer nível</SelectItem>
              {opcoesNiveis.map(n => <SelectItem key={n} value={n}>Para alcançar {n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[260px]">
          <Label className="text-xs">Critério</Label>
          <Input placeholder="Ex.: Tempo mínimo de 12 meses no nível anterior" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); }} />
        </div>
        <Button type="button" onClick={submit}><Plus className="w-4 h-4 mr-1"/>Adicionar</Button>
      </div>
      {criterios.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum critério específico cadastrado.</p>
      ) : (
        <ul className="space-y-1">
          {criterios.map((c: any, i: number) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm border rounded p-2">
              <span>
                <Badge variant="outline" className="mr-2">{c.cargo || 'Geral (todos os cargos)'}</Badge>
                {c.nivel_alvo ? <Badge variant="secondary" className="mr-2">{c.nivel_alvo}</Badge> : null}
                {c.texto || c}
              </span>
              <Button size="icon" variant="ghost" onClick={()=>onRemove(i)}><X className="w-4 h-4 text-destructive"/></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}