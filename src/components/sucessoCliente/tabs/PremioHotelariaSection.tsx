import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Building2, Settings, ClipboardList, LineChart, CalendarDays, ArrowRightCircle, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePrizeEmployees, usePrizeCriteria, type PrizePolicy } from '@/hooks/usePrizePolicies';
import { HOTELARIA_CONFIG, HOTELARIA_ESCALA_TEXTO, HOTELARIA_CRITERIOS_INDIVIDUAIS, type HotelariaConfig, type HotelariaCriterio, type MetaMensal } from '@/utils/sucessoCliente/premioTemplates';
import { generatePremioPoliticaPdf } from '@/utils/sucessoCliente/premioPoliticaPdf';
import { EmployeesSection } from './PremioTab';
import { Textarea } from '@/components/ui/textarea';
import { buildExternalAppLink } from '@/utils/publicLinks';
import { Link2 } from 'lucide-react';

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Avaliacao = { id: string; canal: string; nota: number; data: string };

type ApuracaoState = {
  faturamento_total: number;
  vendas_diretas: number;
  qtd_reservas: number;
  meta_0: number;
  meta_1: number;
  meta_2: number;
  avaliacoes: Avaliacao[];
  data_referencia?: string;
  dias_periodo?: number;
};

const APURACAO_DEFAULT: ApuracaoState = {
  faturamento_total: 0, vendas_diretas: 0, qtd_reservas: 0,
  meta_0: 0, meta_1: 0, meta_2: 0, avaliacoes: [],
  data_referencia: new Date().toISOString().slice(0, 10),
  dias_periodo: 30,
};

export default function PremioHotelariaSection({ policy, cliente, onUpdate, onDraftChange }: {
  policy: PrizePolicy;
  cliente: any;
  onUpdate: (patch: Partial<PrizePolicy>, options?: { silent?: boolean }) => Promise<void>;
  onDraftChange?: (patch: Partial<PrizePolicy>) => void;
}) {
  const { items: employees } = usePrizeEmployees(policy.id);
  const { items: criteriosPolicy } = usePrizeCriteria(policy.id);
  const legacyPontos: Record<string, number> = ((policy as any).hotelaria_pontos as any) || {};

  const [config, setConfig] = useState<HotelariaConfig>(((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG);

  // Apurações por competência. Formato: { 'YYYY-MM': ApuracaoState }.
  // Compatibilidade: se a política tem `hotelaria_apuracao` legado (objeto único),
  // migra para o mês corrente na primeira leitura.
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const buildInitialMap = (): Record<string, ApuracaoState> => {
    const mapa = ((policy as any).hotelaria_apuracoes as Record<string, ApuracaoState>) || {};
    if (Object.keys(mapa).length > 0) return mapa;
    const legacy = (policy as any).hotelaria_apuracao;
    if (legacy && typeof legacy === 'object' && ('faturamento_total' in legacy || 'meta_0' in legacy)) {
      return { [currentMonth()]: { ...APURACAO_DEFAULT, ...legacy } };
    }
    return {};
  };
  const [apMap, setApMap] = useState<Record<string, ApuracaoState>>(buildInitialMap);

  // Competência ativa nas abas Apuração/Evolução
  const cfgMeses = Object.keys(((policy as any).hotelaria_config as HotelariaConfig)?.metas_mensais || {});
  const [activeComp, setActiveComp] = useState<string>(() => {
    const keys = [...Object.keys(buildInitialMap()), ...cfgMeses].sort().reverse();
    return keys[0] || currentMonth();
  });

  useEffect(() => {
    setConfig(((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG);
    setApMap(buildInitialMap());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy.id]);

  // ap atual (com fallback: se a competência tem meta cadastrada e ainda não tem apuração, usa metas)
  const metaDaComp = (config.metas_mensais || {})[activeComp];
  const ap: ApuracaoState = apMap[activeComp] || {
    ...APURACAO_DEFAULT,
    meta_0: metaDaComp?.meta_0 || 0,
    meta_1: metaDaComp?.meta_1 || 0,
    meta_2: metaDaComp?.meta_2 || 0,
    data_referencia: `${activeComp}-${String(Math.min(new Date().getDate(), 28)).padStart(2,'0')}`,
    dias_periodo: new Date(Number(activeComp.split('-')[0]), Number(activeComp.split('-')[1]), 0).getDate() || 30,
  };

  const updateConfigState = (next: HotelariaConfig) => {
    setConfig(next);
    onDraftChange?.({ hotelaria_config: next } as any);
  };
  const updateApState = (next: ApuracaoState, autosave = false) => {
    const nextMap = { ...apMap, [activeComp]: next };
    setApMap(nextMap);
    onDraftChange?.({ hotelaria_apuracoes: nextMap } as any);
    if (autosave) void onUpdate({ hotelaria_apuracoes: nextMap } as any, { silent: true });
  };

  const saveConfig = async () => { await onUpdate({ hotelaria_config: config } as any); toast.success('Configuração salva.'); };
  const saveApuracao = async () => {
    const nextMap = { ...apMap, [activeComp]: ap };
    setApMap(nextMap);
    await onUpdate({ hotelaria_apuracoes: nextMap } as any);
    toast.success('Apuração salva.');
  };
  const saveApuracaoSilent = (next: ApuracaoState) => {
    const nextMap = { ...apMap, [activeComp]: next };
    void onUpdate({ hotelaria_apuracoes: nextMap } as any, { silent: true });
  };

  // Lista de competências disponíveis (metas + apurações + mês corrente)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(config.metas_mensais || {}),
      ...Object.keys(apMap),
      currentMonth(),
    ]);
    return Array.from(set).sort().reverse();
  }, [config.metas_mensais, apMap]);

  useEffect(() => {
    if (!mesesDisponiveis.includes(activeComp) && mesesDisponiveis[0]) setActiveComp(mesesDisponiveis[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesDisponiveis.join('|')]);

  const labelMes = (m: string) => {
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const [a, mm] = m.split('-');
    return `${MESES[Number(mm)-1] || mm}/${a}`;
  };

  // PDF da política do mês
  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = async (mes: string) => {
    const metasMap = config.metas_mensais || {};
    if (!metasMap[mes]) {
      toast.error('Cadastre e salve as metas desta competência antes de gerar o PDF.');
      return;
    }
    setExportingPdf(true);
    try {
      const legacy: Record<string, number> = ((policy as any).hotelaria_pontos as any) || {};
      const participantes = (employees || []).filter(p => p.ativo);
      const criteriosBase = criteriosPolicy.length > 0
        ? criteriosPolicy.map(c => ({ nome: c.nome, descricao: c.descricao, peso: c.peso, essencial: c.essencial }))
        : HOTELARIA_CRITERIOS_INDIVIDUAIS.map(c => ({ nome: c.nome, descricao: c.descricao, peso: c.peso, essencial: false }));
      await generatePremioPoliticaPdf({
        empresa: cliente?.razao_social || cliente?.nome_fantasia || cliente?.nome || 'Empresa',
        cnpj: cliente?.cnpj || undefined,
        verba_label: policy.verba_label,
        politica_nome: policy.nome,
        objetivo: policy.objetivo,
        periodo_tipo: policy.periodo_tipo,
        valor_base: policy.valor_base,
        criterios: criteriosBase,
        participantes: participantes.map(p => ({ nome: p.nome, cpf: p.cpf, cargo: p.cargo, matricula: p.matricula })),
        remuneracao_variavel: null,
        hotelaria: {
          split_coletivo: config.split_coletivo,
          split_individual: config.split_individual,
          criterios: config.criterios,
          escala: config.escala,
          pontos: participantes.map(p => ({
            nome: p.nome, cargo: p.cargo,
            pontos: Number((p as any).pontos ?? legacy[p.id] ?? 0),
          })),
        },
        metas_mes: { competencia: mes, ...metasMap[mes] },
      });
      toast.success(`PDF da política de ${labelMes(mes)} gerado.`);
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    } finally {
      setExportingPdf(false);
    }
  };

  // Pontos vêm do cadastro (prize_employees.pontos); fallback para mapa legado.
  const pontosByEmp = (eid: string) => {
    const emp = employees.find(e => e.id === eid);
    const v = Number(emp?.pontos ?? 0);
    return v > 0 ? v : Number(legacyPontos[eid] || 0);
  };

  const dataRef = ap.data_referencia || new Date().toISOString().slice(0, 10);
  const diaAtual = Math.max(1, new Date(dataRef).getDate());
  const diasPeriodo = Math.max(1, Number(ap.dias_periodo || 30));

  // Valor de referência diário: faturamento total dividido pelo dia de referência.
  // Ex.: 81.413 / 8 (08/07) = 10.176,63 — é este valor que é comparado às metas.
  const valorReferenciaDia = ap.faturamento_total / diaAtual;

  const notasPorCanal = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const a of ap.avaliacoes) {
      const c = (a.canal || '').toLowerCase();
      if (!c) continue;
      map[c] = map[c] || [];
      if (!isNaN(Number(a.nota))) map[c].push(Number(a.nota));
    }
    const media: Record<string, number> = {};
    for (const [k, arr] of Object.entries(map)) {
      media[k] = arr.reduce((s, n) => s + n, 0) / arr.length;
    }
    return { media, counts: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length])) };
  }, [ap.avaliacoes]);

  const totalAvaliacoes = ap.avaliacoes.length;
  const pctAvaliacoes = ap.qtd_reservas > 0 ? (totalAvaliacoes / ap.qtd_reservas) * 100 : 0;

  const somaPontos = useMemo(
    () => employees.filter(e => e.ativo).reduce((s, e) => s + pontosByEmp(e.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees]
  );

  const calcCriterio = (c: HotelariaCriterio) => {
    const bc = ap.faturamento_total * (c.peso_pct / 100);
    let atingido: typeof c.faixas[number] = c.faixas[0];
    let mediaCanal = 0;
    if (c.metrica === 'faturamento_direto') {
      const metas = [ap.meta_0, ap.meta_1, ap.meta_2];
      const nivelValues: Array<'meta_0' | 'meta_1' | 'meta_2'> = ['meta_0', 'meta_1', 'meta_2'];
      for (let i = 2; i >= 0; i--) {
        if (metas[i] > 0 && valorReferenciaDia >= metas[i]) {
          const f = c.faixas.find(x => x.nivel === nivelValues[i]);
          if (f) { atingido = f; break; }
        }
      }
    } else if (c.metrica === 'nota_media') {
      mediaCanal = notasPorCanal.media[(c.canal || '').toLowerCase()] || 0;
      const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
      for (const f of ordered) if (mediaCanal >= (f.alvo || 0)) { atingido = f; break; }
    } else if (c.metrica === 'pct_avaliacoes') {
      const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
      for (const f of ordered) if (pctAvaliacoes >= (f.alvo || 0)) { atingido = f; break; }
    }
    const valor = bc * (atingido.pct / 100);
    return { bc, atingido, valor, mediaCanal };
  };

  const criteriosCalc = config.criterios.map(c => ({ criterio: c, ...calcCriterio(c) }));
  const totalColetivo = criteriosCalc.reduce((s, r) => s + r.valor, 0);

  const evolucao = useMemo(() => {
    const fatDia = ap.faturamento_total / diaAtual;
    const fatProj = fatDia * diasPeriodo;
    // Vendas diretas passam a ser derivadas do faturamento/dia (mesma base de referência das metas).
    const vendasDia = fatDia;
    const vendasProj = fatProj;
    const linhas = config.criterios.map(c => {
      const bcDia = fatDia * (c.peso_pct / 100);
      let atingido: typeof c.faixas[number] = c.faixas[0];
      let referencia = '';
      if (c.metrica === 'faturamento_direto') {
        const metas = [ap.meta_0, ap.meta_1, ap.meta_2];
        const nivelValues: Array<'meta_0' | 'meta_1' | 'meta_2'> = ['meta_0', 'meta_1', 'meta_2'];
        for (let i = 2; i >= 0; i--) {
          if (metas[i] > 0 && fatDia >= metas[i]) {
            const f = c.faixas.find(x => x.nivel === nivelValues[i]);
            if (f) { atingido = f; break; }
          }
        }
        referencia = `Ref/dia: ${BRL(fatDia)} (fat÷${diaAtual})`;
      } else if (c.metrica === 'nota_media') {
        const media = notasPorCanal.media[(c.canal || '').toLowerCase()] || 0;
        const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
        for (const f of ordered) if (media >= (f.alvo || 0)) { atingido = f; break; }
        referencia = `Média: ${media.toFixed(2)}`;
      } else if (c.metrica === 'pct_avaliacoes') {
        const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
        for (const f of ordered) if (pctAvaliacoes >= (f.alvo || 0)) { atingido = f; break; }
        referencia = `${pctAvaliacoes.toFixed(1)}%`;
      }
      const valorDia = bcDia * (atingido.pct / 100);
      const valorProj = valorDia * diasPeriodo;
      return { criterio: c, bcDia, atingido, valorDia, valorProj, referencia };
    });
    const totalDia = linhas.reduce((s, l) => s + l.valorDia, 0);
    const totalProj = linhas.reduce((s, l) => s + l.valorProj, 0);
    return { fatDia, vendasDia, fatProj, vendasProj, linhas, totalDia, totalProj };
  }, [ap, config, diaAtual, diasPeriodo, notasPorCanal, pctAvaliacoes]);

  const updateCriterio = (idx: number, patch: Partial<HotelariaCriterio>) => {
    const list = [...config.criterios]; list[idx] = { ...list[idx], ...patch }; updateConfigState({ ...config, criterios: list });
  };
  const updateFaixa = (ci: number, fi: number, patch: Partial<HotelariaCriterio['faixas'][number]>) => {
    const list = [...config.criterios]; const faixas = [...list[ci].faixas];
    faixas[fi] = { ...faixas[fi], ...patch }; list[ci] = { ...list[ci], faixas };
    updateConfigState({ ...config, criterios: list });
  };

  const addAvaliacao = () => updateApState({ ...ap, avaliacoes: [...ap.avaliacoes, { id: crypto.randomUUID(), canal: 'booking', nota: 0, data: new Date().toISOString().slice(0, 10) }] });
  const rmAvaliacao = (id: string) => updateApState({ ...ap, avaliacoes: ap.avaliacoes.filter(a => a.id !== id) });
  const updAvaliacao = (id: string, patch: Partial<Avaliacao>) => updateApState({ ...ap, avaliacoes: ap.avaliacoes.map(a => a.id === id ? { ...a, ...patch } : a) });

  return (
    <div className="space-y-4">
      <Card className="border-primary/40">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary"/>
            <h4 className="font-semibold text-sm">Modelo: Prêmio para Hotelaria</h4>
            <Badge variant="secondary">Coletivo {config.split_coletivo}% • Individual {config.split_individual}%</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estrutura da política (perene): divisão coletivo/individual, critérios coletivos e faixas de atingimento. Os <strong>colaboradores participantes, os pontos e as metas do mês</strong> são configurados na aba <strong>Metas mensais</strong>. A <strong>Apuração</strong> e a <strong>Evolução diária</strong> são feitas por competência. {HOTELARIA_ESCALA_TEXTO}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="config"><Settings className="w-3 h-3 mr-1"/>Configuração</TabsTrigger>
          <TabsTrigger value="metas"><CalendarDays className="w-3 h-3 mr-1"/>Metas mensais</TabsTrigger>
          <TabsTrigger value="apuracao"><ClipboardList className="w-3 h-3 mr-1"/>Apuração</TabsTrigger>
          <TabsTrigger value="evolucao"><LineChart className="w-3 h-3 mr-1"/>Evolução diária</TabsTrigger>
        </TabsList>

        {/* CONFIG */}
        <TabsContent value="config" className="mt-3 space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">% Coletivo</Label><Input type="number" value={config.split_coletivo} onChange={(e)=>updateConfigState({...config, split_coletivo: Number(e.target.value), split_individual: 100 - Number(e.target.value)})}/></div>
              <div><Label className="text-xs">% Individual</Label><Input type="number" value={config.split_individual} onChange={(e)=>updateConfigState({...config, split_individual: Number(e.target.value), split_coletivo: 100 - Number(e.target.value)})}/></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">% de distribuição do pool individual (teto do prêmio)</Label>
                <Input type="number" step="0.1" value={config.individual_pct_distribuicao ?? 1}
                  onChange={(e)=>updateConfigState({...config, individual_pct_distribuicao: Number(e.target.value)})}/>
              </div>
              <div className="text-[11px] text-muted-foreground border rounded p-2 bg-muted/30">
                Fórmula: pool individual = <strong>faturamento × {config.split_individual}%</strong>.
                Teto de prêmios = pool × <strong>{config.individual_pct_distribuicao ?? 1}%</strong>.
                Teto por colaborador = teto × (pontos do colaborador ÷ soma de pontos).
                Prêmio = teto × % de desempenho da avaliação.
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase text-muted-foreground">Critérios coletivos ({config.split_coletivo}% da meta)</h5>
              {config.criterios.map((c, ci) => (
                <div key={c.id} className="border rounded-md p-2 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-4"><Label className="text-[10px]">Nome</Label><Input value={c.nome} onChange={(e)=>updateCriterio(ci, { nome: e.target.value })}/></div>
                    <div className="md:col-span-2"><Label className="text-[10px]">Peso (% do faturamento)</Label><Input type="number" step="0.5" value={c.peso_pct} onChange={(e)=>updateCriterio(ci, { peso_pct: Number(e.target.value) })}/></div>
                    <div className="md:col-span-3">
                      <Label className="text-[10px]">Métrica</Label>
                      <Select value={c.metrica} onValueChange={(v)=>updateCriterio(ci, { metrica: v as any })}>
                        <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faturamento_direto">Faturamento (Meta 0/1/2)</SelectItem>
                          <SelectItem value="nota_media">Nota média do canal</SelectItem>
                          <SelectItem value="pct_avaliacoes">% de avaliações / reservas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3"><Label className="text-[10px]">Canal (se aplicável)</Label><Input value={c.canal || ''} onChange={(e)=>updateCriterio(ci, { canal: e.target.value })} placeholder="booking / google / tripadvisor"/></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {c.faixas.map((f, fi) => (
                      <div key={f.nivel} className="border rounded p-2 text-xs">
                        <div className="font-semibold text-[11px] mb-1 uppercase">{f.nivel.replace('_', ' ')}</div>
                        <Label className="text-[10px]">% Verba</Label>
                        <Input type="number" step="0.1" value={f.pct} onChange={(e)=>updateFaixa(ci, fi, { pct: Number(e.target.value) })} className="h-8"/>
                        {f.nivel !== 'piso' && (
                          <>
                            <Label className="text-[10px] mt-1 block">Alvo</Label>
                            <Input type="number" step="0.1" value={f.alvo ?? 0} onChange={(e)=>updateFaixa(ci, fi, { alvo: Number(e.target.value) })} className="h-8"/>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={saveConfig}><Save className="w-3 h-3 mr-1"/>Salvar configuração</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* METAS MENSAIS */}
        <TabsContent value="metas" className="mt-3">
          <div className="space-y-3">
            <MetasMensaisPanel
            config={config}
            ap={ap}
            onSaveMeta={async (mes, meta) => {
              const next = { ...config, metas_mensais: { ...(config.metas_mensais || {}), [mes]: meta } };
              updateConfigState(next);
              await onUpdate({ hotelaria_config: next } as any);
              toast.success(`Metas de ${mes} salvas.`);
            }}
            onRemoveMeta={async (mes) => {
              const nextMap = { ...(config.metas_mensais || {}) };
              delete nextMap[mes];
              const next = { ...config, metas_mensais: nextMap };
              updateConfigState(next);
              await onUpdate({ hotelaria_config: next } as any);
              toast.success(`Metas de ${mes} removidas.`);
            }}
            onApplyToApuracao={(meta, mes) => {
              const [ano, m] = mes.split('-');
              const dataRef = `${ano}-${m}-${String(new Date().getDate()).padStart(2, '0')}`;
              setActiveComp(mes);
              const base = apMap[mes] || { ...APURACAO_DEFAULT };
              const next: ApuracaoState = {
                ...base,
                meta_0: meta.meta_0,
                meta_1: meta.meta_1,
                meta_2: meta.meta_2,
                data_referencia: dataRef,
                dias_periodo: new Date(Number(ano), Number(m), 0).getDate() || 30,
              };
              const nextMap = { ...apMap, [mes]: next };
              setApMap(nextMap);
              void onUpdate({ hotelaria_apuracoes: nextMap } as any, { silent: true });
              toast.success(`Competência ${mes} ativada na apuração.`);
            }}
            />

            <Card><CardContent className="p-4 space-y-2">
              <h5 className="text-sm font-semibold">Colaboradores participantes & pontos</h5>
              <p className="text-[11px] text-muted-foreground">
                Os colaboradores abaixo participam desta política. A coluna "pontos" define a proporção da distribuição da parcela coletiva. Total ativo: <strong>{somaPontos} pts</strong>.
              </p>
              <EmployeesSection policy={policy} cliente={cliente}/>
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-2">
              <h5 className="text-sm font-semibold">PDF da política do mês</h5>
              <p className="text-[11px] text-muted-foreground">
                Gera o documento para assinatura dos colaboradores contendo os critérios coletivos, distribuição por pontos, escala individual e as <strong>metas da competência selecionada</strong>.
              </p>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="min-w-[160px]">
                  <Label className="text-xs">Competência do PDF</Label>
                  <Select
                    value={mesesDisponiveis.includes(activeComp) ? activeComp : (mesesDisponiveis[0] || currentMonth())}
                    onValueChange={setActiveComp}
                  >
                    <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {mesesDisponiveis.map(m => (
                        <SelectItem key={m} value={m}>
                          {labelMes(m)} {(config.metas_mensais || {})[m] ? '' : '(sem metas)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={()=>handleExportPdf(activeComp)} disabled={exportingPdf}>
                  {exportingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <FileDown className="w-3 h-3 mr-1"/>}
                  Gerar PDF de {labelMes(activeComp)}
                </Button>
                <Button size="sm" variant="outline" onClick={async ()=>{
                  const link = buildExternalAppLink(`/politica-hotelaria/${policy.id}`);
                  try { await navigator.clipboard.writeText(link); toast.success('Link público copiado.'); }
                  catch { toast.info(link); }
                }}>
                  <Link2 className="w-3 h-3 mr-1"/>Copiar link público
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Link público (sem login) para a equipe da pousada consultar a política e baixar o PDF de cada competência.
              </p>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* APURACAO */}
        <TabsContent value="apuracao" className="mt-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h5 className="text-sm font-semibold">Apuração do período</h5>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Competência</Label>
                <Select value={activeComp} onValueChange={setActiveComp}>
                  <SelectTrigger className="h-8 w-40"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!(config.metas_mensais || {})[activeComp] && (
              <p className="text-[11px] text-amber-600">Sem metas cadastradas para {labelMes(activeComp)}. Cadastre em <strong>Metas mensais</strong> ou preencha Meta 0/1/2 abaixo.</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><Label className="text-xs">Faturamento total</Label><Input type="number" value={ap.faturamento_total} onChange={(e)=>updateApState({...ap, faturamento_total: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, faturamento_total: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div>
                <Label className="text-xs">Ref./dia (auto = fat÷dia)</Label>
                <Input type="text" readOnly value={BRL(valorReferenciaDia)} className="bg-muted"/>
              </div>
              <div><Label className="text-xs">Qtd de reservas</Label><Input type="number" value={ap.qtd_reservas} onChange={(e)=>updateApState({...ap, qtd_reservas: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, qtd_reservas: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div><Label className="text-xs">Meta 0 (R$)</Label><Input type="number" value={ap.meta_0} onChange={(e)=>updateApState({...ap, meta_0: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, meta_0: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div><Label className="text-xs">Meta 1 (R$)</Label><Input type="number" value={ap.meta_1} onChange={(e)=>updateApState({...ap, meta_1: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, meta_1: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div><Label className="text-xs">Meta 2 (R$)</Label><Input type="number" value={ap.meta_2} onChange={(e)=>updateApState({...ap, meta_2: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, meta_2: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div><Label className="text-xs">Data referência</Label><Input type="date" value={ap.data_referencia || ''} onChange={(e)=>updateApState({...ap, data_referencia: e.target.value})} onBlur={(e)=>{ const next = {...ap, data_referencia: e.currentTarget.value}; updateApState(next); saveApuracaoSilent(next); }}/></div>
              <div><Label className="text-xs">Dias do período</Label><Input type="number" min={1} value={ap.dias_periodo || 30} onChange={(e)=>updateApState({...ap, dias_periodo: Number(e.target.value)})} onBlur={(e)=>{ const next = {...ap, dias_periodo: Number(e.currentTarget.value)}; updateApState(next); saveApuracaoSilent(next); }}/></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Avaliações por canal (canal, nota, data)</Label>
                <Button size="sm" variant="outline" onClick={addAvaliacao}><Plus className="w-3 h-3 mr-1"/>Adicionar</Button>
              </div>
              {ap.avaliacoes.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma avaliação lançada.</p>}
              {ap.avaliacoes.map(a => (
                <div key={a.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Select value={a.canal} onValueChange={(v)=>updAvaliacao(a.id, { canal: v })}>
                      <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking">Booking</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3"><Input type="number" step="0.1" value={a.nota} onChange={(e)=>updAvaliacao(a.id, { nota: Number(e.target.value) })} placeholder="Nota"/></div>
                  <div className="col-span-4"><Input type="date" value={a.data} onChange={(e)=>updAvaliacao(a.id, { data: e.target.value })}/></div>
                  <div className="col-span-1"><Button size="sm" variant="ghost" onClick={()=>rmAvaliacao(a.id)}><Trash2 className="w-3 h-3"/></Button></div>
                </div>
              ))}
              {ap.avaliacoes.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Médias — Booking: {(notasPorCanal.media['booking']||0).toFixed(2)} ({notasPorCanal.counts['booking']||0}) •
                  Google: {(notasPorCanal.media['google']||0).toFixed(2)} ({notasPorCanal.counts['google']||0}) •
                  TripAdvisor: {(notasPorCanal.media['tripadvisor']||0).toFixed(2)} ({notasPorCanal.counts['tripadvisor']||0}) •
                  Total avaliações: {totalAvaliacoes} • % sobre reservas: {pctAvaliacoes.toFixed(1)}%
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <h5 className="text-sm font-semibold">Resultado por critério coletivo (acumulado)</h5>
              <div className="space-y-1 text-xs">
                {criteriosCalc.map(({ criterio, bc, atingido, valor, mediaCanal }) => (
                  <div key={criterio.id} className="grid grid-cols-12 gap-2 border rounded p-2">
                    <div className="col-span-4 font-medium">{criterio.nome}</div>
                    <div className="col-span-2 text-muted-foreground">BC ({criterio.peso_pct}%): {BRL(bc)}</div>
                    <div className="col-span-2"><Badge variant="outline">{atingido.nivel.replace('_',' ')} • {atingido.pct}%</Badge></div>
                    <div className="col-span-2 text-muted-foreground">
                      {criterio.metrica === 'nota_media' && `Média: ${mediaCanal.toFixed(2)}`}
                      {criterio.metrica === 'pct_avaliacoes' && `${pctAvaliacoes.toFixed(1)}%`}
                      {criterio.metrica === 'faturamento_direto' && `Ref/dia: ${BRL(valorReferenciaDia)}`}
                    </div>
                    <div className="col-span-2 text-right font-semibold">{BRL(valor)}</div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Total coletivo apurado ({config.split_coletivo}%)</span>
                  <span className="font-bold text-primary">{BRL(totalColetivo)}</span>
                </div>
              </div>

              {somaPontos > 0 && employees.filter(e=>e.ativo).length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-semibold mt-2">Distribuição por colaborador (parcela coletiva)</h5>
                  <div className="max-h-64 overflow-y-auto space-y-1 text-xs">
                    {employees.filter(e=>e.ativo).map(e => {
                      const p = pontosByEmp(e.id);
                      const val = somaPontos > 0 ? totalColetivo * (p / somaPontos) : 0;
                      return (
                        <div key={e.id} className="flex justify-between border rounded px-2 py-1">
                          <span>{e.nome} <span className="text-muted-foreground">• {p} pts</span></span>
                          <span className="font-medium">{BRL(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={saveApuracao}><Save className="w-3 h-3 mr-1"/>Salvar apuração</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* EVOLUCAO */}
        <TabsContent value="evolucao" className="mt-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h5 className="text-sm font-semibold">Painel de evolução diária</h5>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Competência</Label>
                <Select value={activeComp} onValueChange={setActiveComp}>
                  <SelectTrigger className="h-8 w-40"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge variant="outline">Dia {diaAtual} de {diasPeriodo}</Badge>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O valor de cada faixa é diário. Ritmo diário = valor acumulado ÷ dia atual. Projeção do período = ritmo × dias do período.
              Ajuste "Data referência" e "Dias do período" na aba <strong>Apuração</strong>.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="border rounded p-2">
                <div className="text-muted-foreground">Faturamento acumulado</div>
                <div className="font-semibold">{BRL(ap.faturamento_total)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-muted-foreground">Faturamento / dia</div>
                <div className="font-semibold">{BRL(evolucao.fatDia)}</div>
                <div className="text-[10px] text-muted-foreground">Proj.: {BRL(evolucao.fatProj)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-muted-foreground">Vendas diretas / dia</div>
                <div className="font-semibold">{BRL(evolucao.vendasDia)}</div>
                <div className="text-[10px] text-muted-foreground">Proj.: {BRL(evolucao.vendasProj)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-muted-foreground">Reservas / dia</div>
                <div className="font-semibold">{(ap.qtd_reservas / diaAtual).toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">Proj.: {((ap.qtd_reservas / diaAtual) * diasPeriodo).toFixed(0)}</div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="grid grid-cols-12 gap-2 font-semibold text-[10px] uppercase text-muted-foreground px-2">
                <div className="col-span-3">Critério</div>
                <div className="col-span-2">BC diária</div>
                <div className="col-span-2">Faixa projetada</div>
                <div className="col-span-2">Referência</div>
                <div className="col-span-1 text-right">Valor/dia</div>
                <div className="col-span-2 text-right">Projeção período</div>
              </div>
              {evolucao.linhas.map(l => (
                <div key={l.criterio.id} className="grid grid-cols-12 gap-2 border rounded p-2 items-center">
                  <div className="col-span-3 font-medium">{l.criterio.nome}</div>
                  <div className="col-span-2 text-muted-foreground">{BRL(l.bcDia)}</div>
                  <div className="col-span-2"><Badge variant="outline">{l.atingido.nivel.replace('_',' ')} • {l.atingido.pct}%</Badge></div>
                  <div className="col-span-2 text-muted-foreground">{l.referencia}</div>
                  <div className="col-span-1 text-right font-semibold">{BRL(l.valorDia)}</div>
                  <div className="col-span-2 text-right font-semibold text-primary">{BRL(l.valorProj)}</div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Totais</span>
                <span className="text-xs">
                  <span className="text-muted-foreground mr-3">Dia: <strong>{BRL(evolucao.totalDia)}</strong></span>
                  <span className="text-primary font-bold">Projeção: {BRL(evolucao.totalProj)}</span>
                </span>
              </div>
            </div>

            {somaPontos > 0 && employees.filter(e=>e.ativo).length > 0 && (
              <div className="space-y-1">
                <h5 className="text-xs font-semibold mt-2">Projeção por colaborador (parcela coletiva)</h5>
                <div className="max-h-64 overflow-y-auto space-y-1 text-xs">
                  {employees.filter(e=>e.ativo).map(e => {
                    const p = pontosByEmp(e.id);
                    const val = somaPontos > 0 ? evolucao.totalProj * (p / somaPontos) : 0;
                    return (
                      <div key={e.id} className="flex justify-between border rounded px-2 py-1">
                        <span>{e.nome} <span className="text-muted-foreground">• {p} pts</span></span>
                        <span className="font-medium">{BRL(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetasMensaisPanel({
  config, ap, onSaveMeta, onRemoveMeta, onApplyToApuracao,
}: {
  config: HotelariaConfig;
  ap: ApuracaoState;
  onSaveMeta: (mes: string, meta: MetaMensal) => Promise<void>;
  onRemoveMeta: (mes: string) => Promise<void>;
  onApplyToApuracao: (meta: MetaMensal, mes: string) => void;
}) {
  const currentMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState<string>(currentMes);
  const existentes = config.metas_mensais || {};
  const atual = existentes[mes];
  const [form, setForm] = useState<MetaMensal>(atual || {
    meta_0: ap.meta_0 || 0,
    meta_1: ap.meta_1 || 0,
    meta_2: ap.meta_2 || 0,
    faturamento_previsto: 0,
    observacoes: '',
    vigencia_inicio: `${mes}-01`,
    vigencia_fim: '',
  });

  useEffect(() => {
    const ex = (config.metas_mensais || {})[mes];
    setForm(ex || {
      meta_0: 0, meta_1: 0, meta_2: 0, faturamento_previsto: 0,
      observacoes: '', vigencia_inicio: `${mes}-01`, vigencia_fim: '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, config.metas_mensais]);

  const meses = Object.keys(existentes).sort().reverse();

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary"/>
          <h5 className="text-sm font-semibold">Metas por competência</h5>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cadastre as metas de faturamento (Meta 0/1/2) para cada mês. As metas ficam vinculadas à política e aparecem no <strong>PDF da política do mês</strong>, para assinatura da equipe. Use "Aplicar à apuração" para trazer os valores para a apuração corrente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">Competência</Label>
            <Input type="month" value={mes} onChange={(e)=>setMes(e.target.value || currentMes)}/>
          </div>
          <div><Label className="text-xs">Vigência início</Label><Input type="date" value={form.vigencia_inicio || ''} onChange={(e)=>setForm({...form, vigencia_inicio: e.target.value})}/></div>
          <div><Label className="text-xs">Vigência fim</Label><Input type="date" value={form.vigencia_fim || ''} onChange={(e)=>setForm({...form, vigencia_fim: e.target.value})}/></div>
          <div><Label className="text-xs">Faturamento previsto (R$)</Label><Input type="number" value={form.faturamento_previsto ?? 0} onChange={(e)=>setForm({...form, faturamento_previsto: Number(e.target.value)})}/></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><Label className="text-xs">Meta 0 (R$/dia)</Label><Input type="number" value={form.meta_0} onChange={(e)=>setForm({...form, meta_0: Number(e.target.value)})}/></div>
          <div><Label className="text-xs">Meta 1 (R$/dia)</Label><Input type="number" value={form.meta_1} onChange={(e)=>setForm({...form, meta_1: Number(e.target.value)})}/></div>
          <div><Label className="text-xs">Meta 2 (R$/dia)</Label><Input type="number" value={form.meta_2} onChange={(e)=>setForm({...form, meta_2: Number(e.target.value)})}/></div>
        </div>

        <div>
          <Label className="text-xs">Observações (opcional — sai no PDF)</Label>
          <Textarea rows={2} value={form.observacoes || ''} onChange={(e)=>setForm({...form, observacoes: e.target.value})} placeholder="Ex.: mês com evento sazonal; metas revisadas em reunião de 01/07."/>
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={()=>onApplyToApuracao(form, mes)}>
            <ArrowRightCircle className="w-3 h-3 mr-1"/>Aplicar à apuração
          </Button>
          <Button size="sm" onClick={()=>onSaveMeta(mes, form)}><Save className="w-3 h-3 mr-1"/>Salvar metas do mês</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <h5 className="text-sm font-semibold">Histórico de metas ({meses.length})</h5>
        {meses.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma competência cadastrada ainda.</p>
        ) : (
          <div className="space-y-1 text-xs">
            {meses.map(m => {
              const it = existentes[m];
              return (
                <div key={m} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                  <div className="col-span-2 font-semibold">{m}</div>
                  <div className="col-span-2">M0: {BRL(it.meta_0)}</div>
                  <div className="col-span-2">M1: {BRL(it.meta_1)}</div>
                  <div className="col-span-2">M2: {BRL(it.meta_2)}</div>
                  <div className="col-span-2 text-muted-foreground truncate">{it.observacoes || '—'}</div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={()=>setMes(m)} title="Editar">Editar</Button>
                    <Button size="sm" variant="ghost" onClick={async ()=>{ if (confirm(`Remover metas de ${m}?`)) await onRemoveMeta(m); }}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}