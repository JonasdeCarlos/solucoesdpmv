import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Building2 } from 'lucide-react';
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
};

const APURACAO_DEFAULT: ApuracaoState = {
  faturamento_total: 0, vendas_diretas: 0, qtd_reservas: 0,
  meta_0: 0, meta_1: 0, meta_2: 0, avaliacoes: [],
};

export default function PremioHotelariaSection({ policy, onUpdate }: {
  policy: PrizePolicy;
  onUpdate: (patch: Partial<PrizePolicy>) => Promise<void>;
}) {
  const { items: employees } = usePrizeEmployees(policy.id);
  const cfg: HotelariaConfig = ((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG;
  const pontos: Record<string, number> = ((policy as any).hotelaria_pontos as any) || {};
  const apuracaoSaved: ApuracaoState = { ...APURACAO_DEFAULT, ...(((policy as any).hotelaria_apuracao as any) || {}) };

  const [config, setConfig] = useState<HotelariaConfig>(cfg);
  const [ap, setAp] = useState<ApuracaoState>(apuracaoSaved);
  const [localPontos, setLocalPontos] = useState<Record<string, number>>(pontos);

  useEffect(() => {
    setConfig(((policy as any).hotelaria_config as HotelariaConfig) || HOTELARIA_CONFIG);
    setAp({ ...APURACAO_DEFAULT, ...(((policy as any).hotelaria_apuracao as any) || {}) });
    setLocalPontos(((policy as any).hotelaria_pontos as any) || {});
  }, [policy.id]);

  const saveConfig = async () => {
    await onUpdate({ hotelaria_config: config } as any);
    toast.success('Configuração salva.');
  };

  const savePontos = async () => {
    await onUpdate({ hotelaria_pontos: localPontos } as any);
    toast.success('Pontos salvos.');
  };

  const saveApuracao = async () => {
    await onUpdate({ hotelaria_apuracao: ap } as any);
    toast.success('Apuração salva.');
  };

  // --- Cálculos ---
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
    () => employees.filter(e => e.ativo).reduce((s, e) => s + Number(localPontos[e.id] || 0), 0),
    [employees, localPontos]
  );

  const calcCriterio = (c: HotelariaCriterio) => {
    const bc = ap.faturamento_total * (c.peso_pct / 100);
    let atingido: typeof c.faixas[number] = c.faixas[0];
    let mediaCanal = 0;
    if (c.metrica === 'faturamento_direto') {
      // Faixas por VENDAS DIRETAS (reserva direta) contra Meta 0/1/2 informadas.
      // A BC do critério continua sendo faturamento_total × peso_pct.
      const metas = [ap.meta_0, ap.meta_1, ap.meta_2];
      const nivelValues: Array<'meta_0' | 'meta_1' | 'meta_2'> = ['meta_0', 'meta_1', 'meta_2'];
      for (let i = 2; i >= 0; i--) {
        if (metas[i] > 0 && ap.vendas_diretas >= metas[i]) {
          const f = c.faixas.find(x => x.nivel === nivelValues[i]);
          if (f) { atingido = f; break; }
        }
      }
    } else if (c.metrica === 'nota_media') {
      mediaCanal = notasPorCanal.media[(c.canal || '').toLowerCase()] || 0;
      const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
      for (const f of ordered) {
        if (mediaCanal >= (f.alvo || 0)) { atingido = f; break; }
      }
    } else if (c.metrica === 'pct_avaliacoes') {
      const ordered = c.faixas.filter(f => f.nivel !== 'piso').slice().sort((a, b) => (b.alvo || 0) - (a.alvo || 0));
      for (const f of ordered) {
        if (pctAvaliacoes >= (f.alvo || 0)) { atingido = f; break; }
      }
    }
    const valor = bc * (atingido.pct / 100);
    return { bc, atingido, valor, mediaCanal };
  };

  const criteriosCalc = config.criterios.map(c => ({ criterio: c, ...calcCriterio(c) }));
  const totalColetivo = criteriosCalc.reduce((s, r) => s + r.valor, 0);

  // --- Handlers de config ---
  const updateCriterio = (idx: number, patch: Partial<HotelariaCriterio>) => {
    const list = [...config.criterios];
    list[idx] = { ...list[idx], ...patch };
    setConfig({ ...config, criterios: list });
  };
  const updateFaixa = (ci: number, fi: number, patch: Partial<HotelariaCriterio['faixas'][number]>) => {
    const list = [...config.criterios];
    const faixas = [...list[ci].faixas];
    faixas[fi] = { ...faixas[fi], ...patch };
    list[ci] = { ...list[ci], faixas };
    setConfig({ ...config, criterios: list });
  };

  const addAvaliacao = () => setAp({ ...ap, avaliacoes: [...ap.avaliacoes, { id: crypto.randomUUID(), canal: 'booking', nota: 0, data: new Date().toISOString().slice(0, 10) }] });
  const rmAvaliacao = (id: string) => setAp({ ...ap, avaliacoes: ap.avaliacoes.filter(a => a.id !== id) });
  const updAvaliacao = (id: string, patch: Partial<Avaliacao>) => setAp({ ...ap, avaliacoes: ap.avaliacoes.map(a => a.id === id ? { ...a, ...patch } : a) });

  return (
    <div className="space-y-4">
      <Card className="border-primary/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary"/>
            <h4 className="font-semibold text-sm">Modelo: Prêmio para Hotelaria</h4>
            <Badge variant="secondary">Coletivo {config.split_coletivo}% • Individual {config.split_individual}%</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Modelo com metas coletivas por faixas (Piso / Meta 0 / Meta 1 / Meta 2) e distribuição por pontos entre os colaboradores.
            A parcela individual usa os critérios cadastrados nesta política. {HOTELARIA_ESCALA_TEXTO}
          </p>

          {/* Splits */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">% Coletivo</Label><Input type="number" value={config.split_coletivo} onChange={(e)=>setConfig({...config, split_coletivo: Number(e.target.value), split_individual: 100 - Number(e.target.value)})}/></div>
            <div><Label className="text-xs">% Individual</Label><Input type="number" value={config.split_individual} onChange={(e)=>setConfig({...config, split_individual: Number(e.target.value), split_coletivo: 100 - Number(e.target.value)})}/></div>
          </div>

          {/* Editor de critérios coletivos */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase text-muted-foreground">Critérios coletivos (80% da meta)</h5>
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
        </CardContent>
      </Card>

      {/* Pontos por colaborador */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h5 className="text-sm font-semibold">Pontos por colaborador (distribuição proporcional)</h5>
          <p className="text-[11px] text-muted-foreground">Total de pontos = {somaPontos}. O valor de cada critério é dividido por esta soma e multiplicado pelos pontos de cada colaborador.</p>
          {employees.length === 0 ? (
            <p className="text-xs text-muted-foreground">Cadastre colaboradores participantes na seção acima.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {employees.filter(e=>e.ativo).map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{e.nome} {e.cargo && <span className="text-[10px] text-muted-foreground">• {e.cargo}</span>}</span>
                  <Input type="number" min={0} className="h-8 w-24" value={localPontos[e.id] || 0}
                    onChange={(ev)=>setLocalPontos({ ...localPontos, [e.id]: Number(ev.target.value) })}/>
                  <span className="text-[10px] text-muted-foreground w-14 text-right">
                    {somaPontos > 0 ? ((Number(localPontos[e.id] || 0) / somaPontos) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={savePontos}><Save className="w-3 h-3 mr-1"/>Salvar pontos</Button>
          </div>
        </CardContent>
      </Card>

      {/* Apuração */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h5 className="text-sm font-semibold">Apuração do período</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label className="text-xs">Faturamento total</Label><Input type="number" value={ap.faturamento_total} onChange={(e)=>setAp({...ap, faturamento_total: Number(e.target.value)})}/></div>
            <div><Label className="text-xs">Vendas diretas</Label><Input type="number" value={ap.vendas_diretas} onChange={(e)=>setAp({...ap, vendas_diretas: Number(e.target.value)})}/></div>
            <div><Label className="text-xs">Qtd de reservas</Label><Input type="number" value={ap.qtd_reservas} onChange={(e)=>setAp({...ap, qtd_reservas: Number(e.target.value)})}/></div>
            <div><Label className="text-xs">Meta 0 (R$)</Label><Input type="number" value={ap.meta_0} onChange={(e)=>setAp({...ap, meta_0: Number(e.target.value)})}/></div>
            <div><Label className="text-xs">Meta 1 (R$)</Label><Input type="number" value={ap.meta_1} onChange={(e)=>setAp({...ap, meta_1: Number(e.target.value)})}/></div>
            <div><Label className="text-xs">Meta 2 (R$)</Label><Input type="number" value={ap.meta_2} onChange={(e)=>setAp({...ap, meta_2: Number(e.target.value)})}/></div>
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

          {/* Resultado */}
          <div className="border-t pt-3 space-y-2">
            <h5 className="text-sm font-semibold">Resultado por critério coletivo</h5>
            <div className="space-y-1 text-xs">
              {criteriosCalc.map(({ criterio, bc, atingido, valor, mediaCanal }) => (
                <div key={criterio.id} className="grid grid-cols-12 gap-2 border rounded p-2">
                  <div className="col-span-4 font-medium">{criterio.nome}</div>
                  <div className="col-span-2 text-muted-foreground">BC ({criterio.peso_pct}%): {BRL(bc)}</div>
                  <div className="col-span-2"><Badge variant="outline">{atingido.nivel.replace('_',' ')} • {atingido.pct}%</Badge></div>
                  <div className="col-span-2 text-muted-foreground">
                    {criterio.metrica === 'nota_media' && `Média: ${mediaCanal.toFixed(2)}`}
                    {criterio.metrica === 'pct_avaliacoes' && `${pctAvaliacoes.toFixed(1)}%`}
                    {criterio.metrica === 'faturamento_direto' && `Diretas: ${BRL(ap.vendas_diretas)}`}
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
                    const p = Number(localPontos[e.id] || 0);
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
        </CardContent>
      </Card>
    </div>
  );
}