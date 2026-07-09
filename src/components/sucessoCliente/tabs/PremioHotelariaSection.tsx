import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Building2, Settings, ClipboardList, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import { usePrizeEmployees, type PrizePolicy } from '@/hooks/usePrizePolicies';
import { HOTELARIA_CONFIG, HOTELARIA_ESCALA_TEXTO, type HotelariaConfig, type HotelariaCriterio } from '@/utils/sucessoCliente/premioTemplates';

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

export default function PremioHotelariaSection({ policy, onUpdate }: {
  policy: PrizePolicy;
  onUpdate: (patch: Partial<PrizePolicy>) => Promise<void>;
}) {
  const { items: employees } = usePrizeEmployees(policy.id);
  const legacyPontos: Record<string, number> = ((policy as any).hotelaria_pontos as any) || {};

  const [config, setConfig] = useState<HotelariaConfig>(((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG);
  const [ap, setAp] = useState<ApuracaoState>({ ...APURACAO_DEFAULT, ...(((policy as any).hotelaria_apuracao as any) || {}) });

  useEffect(() => {
    setConfig(((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG);
    setAp({ ...APURACAO_DEFAULT, ...(((policy as any).hotelaria_apuracao as any) || {}) });
  }, [policy.id]);

  const saveConfig = async () => { await onUpdate({ hotelaria_config: config } as any); toast.success('Configuração salva.'); };
  const saveApuracao = async () => { await onUpdate({ hotelaria_apuracao: ap } as any); toast.success('Apuração salva.'); };

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
    const list = [...config.criterios]; list[idx] = { ...list[idx], ...patch }; setConfig({ ...config, criterios: list });
  };
  const updateFaixa = (ci: number, fi: number, patch: Partial<HotelariaCriterio['faixas'][number]>) => {
    const list = [...config.criterios]; const faixas = [...list[ci].faixas];
    faixas[fi] = { ...faixas[fi], ...patch }; list[ci] = { ...list[ci], faixas };
    setConfig({ ...config, criterios: list });
  };

  const addAvaliacao = () => setAp({ ...ap, avaliacoes: [...ap.avaliacoes, { id: crypto.randomUUID(), canal: 'booking', nota: 0, data: new Date().toISOString().slice(0, 10) }] });
  const rmAvaliacao = (id: string) => setAp({ ...ap, avaliacoes: ap.avaliacoes.filter(a => a.id !== id) });
  const updAvaliacao = (id: string, patch: Partial<Avaliacao>) => setAp({ ...ap, avaliacoes: ap.avaliacoes.map(a => a.id === id ? { ...a, ...patch } : a) });

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
            Metas coletivas por faixas (Piso / Meta 0 / Meta 1 / Meta 2). Os <strong>pontos são definidos no cadastro de cada colaborador</strong> (seção "Colaboradores participantes"). Apenas colaboradores ativos entram na base de cálculo. {HOTELARIA_ESCALA_TEXTO}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="config"><Settings className="w-3 h-3 mr-1"/>Configuração</TabsTrigger>
          <TabsTrigger value="apuracao"><ClipboardList className="w-3 h-3 mr-1"/>Apuração</TabsTrigger>
          <TabsTrigger value="evolucao"><LineChart className="w-3 h-3 mr-1"/>Evolução diária</TabsTrigger>
        </TabsList>

        {/* CONFIG */}
        <TabsContent value="config" className="mt-3 space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">% Coletivo</Label><Input type="number" value={config.split_coletivo} onChange={(e)=>setConfig({...config, split_coletivo: Number(e.target.value), split_individual: 100 - Number(e.target.value)})}/></div>
              <div><Label className="text-xs">% Individual</Label><Input type="number" value={config.split_individual} onChange={(e)=>setConfig({...config, split_individual: Number(e.target.value), split_coletivo: 100 - Number(e.target.value)})}/></div>
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

          <Card><CardContent className="p-4 space-y-2">
            <h5 className="text-sm font-semibold">Pontos por colaborador (definidos no cadastro)</h5>
            <p className="text-[11px] text-muted-foreground">Total de pontos ativos = <strong>{somaPontos}</strong>. Edite os pontos na seção "Colaboradores participantes" desta política.</p>
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum colaborador cadastrado.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto text-xs">
                {employees.filter(e=>e.ativo).map(e => {
                  const p = pontosByEmp(e.id);
                  const pct = somaPontos > 0 ? (p / somaPontos) * 100 : 0;
                  return (
                    <div key={e.id} className="flex items-center justify-between border rounded px-2 py-1">
                      <span>{e.nome} {e.cargo && <span className="text-muted-foreground">• {e.cargo}</span>}</span>
                      <span className="font-medium">{p} pts <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* APURACAO */}
        <TabsContent value="apuracao" className="mt-3">
          <Card><CardContent className="p-4 space-y-3">
            <h5 className="text-sm font-semibold">Apuração do período</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><Label className="text-xs">Faturamento total</Label><Input type="number" value={ap.faturamento_total} onChange={(e)=>setAp({...ap, faturamento_total: Number(e.target.value)})}/></div>
              <div>
                <Label className="text-xs">Ref./dia (auto = fat÷dia)</Label>
                <Input type="text" readOnly value={BRL(valorReferenciaDia)} className="bg-muted"/>
              </div>
              <div><Label className="text-xs">Qtd de reservas</Label><Input type="number" value={ap.qtd_reservas} onChange={(e)=>setAp({...ap, qtd_reservas: Number(e.target.value)})}/></div>
              <div><Label className="text-xs">Meta 0 (R$)</Label><Input type="number" value={ap.meta_0} onChange={(e)=>setAp({...ap, meta_0: Number(e.target.value)})}/></div>
              <div><Label className="text-xs">Meta 1 (R$)</Label><Input type="number" value={ap.meta_1} onChange={(e)=>setAp({...ap, meta_1: Number(e.target.value)})}/></div>
              <div><Label className="text-xs">Meta 2 (R$)</Label><Input type="number" value={ap.meta_2} onChange={(e)=>setAp({...ap, meta_2: Number(e.target.value)})}/></div>
              <div><Label className="text-xs">Data referência</Label><Input type="date" value={ap.data_referencia || ''} onChange={(e)=>setAp({...ap, data_referencia: e.target.value})}/></div>
              <div><Label className="text-xs">Dias do período</Label><Input type="number" min={1} value={ap.dias_periodo || 30} onChange={(e)=>setAp({...ap, dias_periodo: Number(e.target.value)})}/></div>
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
              <Badge variant="outline">Dia {diaAtual} de {diasPeriodo}</Badge>
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