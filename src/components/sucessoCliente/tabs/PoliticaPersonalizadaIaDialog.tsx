import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Trash2, Plus, RefreshCw, Check, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { METRICAS_GENERICAS, METRICA_LABEL, HOTELARIA_CONFIG } from '@/utils/sucessoCliente/premioTemplates';

type Faixa = { nivel: string; pct: number; alvo: number | null };
type Indicador = { id: string; nome: string; descricao: string; metrica: string; unidade: string | null; escala_max: number | null; canal: null; peso_pct: number; faixas: Faixa[] };
type CritInd = { nome: string; descricao: string; peso: number };
export type PoliticaGerada = {
  nome: string; objetivo: string; regra_premiacao: string; periodo_tipo: string; base_label: string;
  split_coletivo: number; split_individual: number; individual_pct_distribuicao: number; rateio: 'pontos' | 'igualitario';
  indicadores: Indicador[]; criterios_individuais: CritInd[]; observacoes: string;
};

const METRICAS = ['faturamento_direto', ...METRICAS_GENERICAS];

const fileToBase64 = (f: File) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => { const r = String(fr.result || ''); const i = r.indexOf('base64,'); res(i >= 0 ? r.slice(i + 7) : r); };
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(f);
});

export default function PoliticaPersonalizadaIaDialog({ open, onOpenChange, verbaLabel, atividade, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; verbaLabel: string; atividade?: string;
  onConfirm: (p: PoliticaGerada) => Promise<void>;
}) {
  const [descricao, setDescricao] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [ajustes, setAjustes] = useState('');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<PoliticaGerada | null>(null);

  const gerar = async (refazer = false) => {
    if (!descricao.trim() && files.length === 0) { toast.error('Explique a política ou anexe ao menos um arquivo.'); return; }
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 8 * 1024 * 1024) { toast.error('Os anexos somam mais de 8 MB. Envie arquivos menores ou menos arquivos.'); return; }
    setRunning(true);
    try {
      const payloadFiles = await Promise.all(files.map(async f => ({ name: f.name, mime: f.type || 'application/octet-stream', data_base64: await fileToBase64(f) })));
      const { data, error } = await supabase.functions.invoke('premio-politica-personalizada-ia', {
        body: { descricao, verba_label: verbaLabel, atividade, files: payloadFiles, ...(refazer && p ? { anterior: p, ajustes } : {}) },
      });
      const msg = (data as any)?.error;
      if (error || msg) {
        let m = msg;
        try { m = m || (await (error as any)?.context?.json?.())?.error; } catch { /* */ }
        throw new Error(m || error?.message || 'Falha na IA');
      }
      setP((data as any).politica);
      setAjustes('');
      toast.success(refazer ? 'Política ajustada pela IA.' : 'Política montada. Revise antes de salvar.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar com IA.');
    } finally { setRunning(false); }
  };

  const updInd = (i: number, patch: Partial<Indicador>) => setP(prev => prev ? { ...prev, indicadores: prev.indicadores.map((x, k) => k === i ? { ...x, ...patch } : x) } : prev);
  const updFaixa = (i: number, fi: number, patch: Partial<Faixa>) => setP(prev => prev ? { ...prev, indicadores: prev.indicadores.map((x, k) => k === i ? { ...x, faixas: x.faixas.map((f, j) => j === fi ? { ...f, ...patch } : f) } : x) } : prev);
  const updCrit = (i: number, patch: Partial<CritInd>) => setP(prev => prev ? { ...prev, criterios_individuais: prev.criterios_individuais.map((x, k) => k === i ? { ...x, ...patch } : x) } : prev);

  const confirmar = async () => {
    if (!p) return;
    if (!p.nome.trim()) { toast.error('Dê um nome à política.'); return; }
    setSaving(true);
    try { await onConfirm(p); setP(null); setDescricao(''); setFiles([]); onOpenChange(false); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/>Criar uma política nova, do seu jeito</DialogTitle>
          <DialogDescription>Explique como deve funcionar e anexe o que tiver. A IA monta a política, os indicadores da apuração, as faixas e os critérios individuais. Você revisa tudo antes de salvar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Explique como deve funcionar esta política</Label>
            <Textarea rows={6} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex.: Prêmio mensal para a equipe da loja. 70% pelo resultado da loja (vendas acima de R$ 150 mil, ticket médio e perdas abaixo de 1%) e 30% individual (atendimento, organização, pontualidade). Divide por pontos conforme o cargo. Quem tiver falta injustificada perde a parte individual…"/>
          </div>
          <div>
            <Label className="flex items-center gap-1"><Paperclip className="w-3 h-3"/>Arquivos (PDF, Word, Excel/CSV, fotos)</Label>
            <Input type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" onChange={e => setFiles(Array.from(e.target.files || []))}/>
            {files.length > 0 && <p className="text-[11px] text-muted-foreground mt-1">{files.map(f => f.name).join(', ')}</p>}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => gerar(false)} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Sparkles className="w-4 h-4 mr-1"/>}
              {p ? 'Montar de novo do zero' : 'Montar política com IA'}
            </Button>
          </div>
          {running && <p className="text-xs text-muted-foreground text-right">Lendo os arquivos e montando a política… pode levar até 1 minuto.</p>}
        </div>

        {p && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold text-sm">Prévia — revise e ajuste</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome da política</Label><Input value={p.nome} onChange={e => setP({ ...p, nome: e.target.value })}/></div>
              <div><Label className="text-xs">Periodicidade</Label>
                <Select value={p.periodo_tipo} onValueChange={v => setP({ ...p, periodo_tipo: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{['mensal','quinzenal','bimestral','trimestral','semestral','anual'].map(x => <SelectItem key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label className="text-xs">Objetivo</Label><Textarea rows={2} value={p.objetivo} onChange={e => setP({ ...p, objetivo: e.target.value })}/></div>
              <div className="md:col-span-2"><Label className="text-xs">Regra do prêmio</Label><Textarea rows={3} value={p.regra_premiacao} onChange={e => setP({ ...p, regra_premiacao: e.target.value })}/></div>
              <div><Label className="text-xs">Base de cálculo (nome)</Label><Input value={p.base_label} onChange={e => setP({ ...p, base_label: e.target.value })}/></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">% coletivo</Label><Input type="number" value={p.split_coletivo} onChange={e => { const v = Math.min(100, Math.max(0, Number(e.target.value))); setP({ ...p, split_coletivo: v, split_individual: 100 - v }); }}/></div>
                <div><Label className="text-xs">% individual</Label><Input type="number" value={p.split_individual} readOnly className="bg-muted"/></div>
                <div><Label className="text-xs">Rateio</Label>
                  <Select value={p.rateio} onValueChange={v => setP({ ...p, rateio: v as any })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="pontos">Por pontos</SelectItem><SelectItem value="igualitario">Igualitário</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground">Indicadores coletivos (apuração)</h5>
                <Button size="sm" variant="outline" onClick={() => setP({ ...p, indicadores: [...p.indicadores, { id: `ind_${Date.now()}`, nome: 'Novo indicador', descricao: '', metrica: 'realizado_meta', unidade: null, escala_max: null, canal: null, peso_pct: 10, faixas: HOTELARIA_CONFIG.criterios[0].faixas.map(f => ({ ...f })) }] })}><Plus className="w-3 h-3 mr-1"/>Indicador</Button>
              </div>
              {p.indicadores.map((c, i) => (
                <div key={c.id} className="border rounded-md p-2 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-4"><Label className="text-[10px]">Nome</Label><Input value={c.nome} onChange={e => updInd(i, { nome: e.target.value })}/></div>
                    <div className="md:col-span-4"><Label className="text-[10px]">Tipo de medição</Label>
                      <Select value={c.metrica} onValueChange={v => updInd(i, { metrica: v })}>
                        <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                        <SelectContent>{METRICAS.map(m => <SelectItem key={m} value={m}>{METRICA_LABEL[m]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1"><Label className="text-[10px]">Unid.</Label><Input value={c.unidade || ''} onChange={e => updInd(i, { unidade: e.target.value })}/></div>
                    <div className="md:col-span-2"><Label className="text-[10px]">Peso (% da base)</Label><Input type="number" step="0.5" value={c.peso_pct} onChange={e => updInd(i, { peso_pct: Number(e.target.value) })}/></div>
                    <div className="md:col-span-1"><Button size="icon" variant="ghost" onClick={() => setP({ ...p, indicadores: p.indicadores.filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4"/></Button></div>
                  </div>
                  {c.descricao && <p className="text-[11px] text-muted-foreground">{c.descricao}</p>}
                  <div className="grid grid-cols-4 gap-2">
                    {c.faixas.map((f, fi) => (
                      <div key={f.nivel} className="border rounded p-2 text-xs bg-background">
                        <div className="font-semibold text-[11px] uppercase">{f.nivel.replace('_', ' ')}</div>
                        <Label className="text-[10px]">% verba</Label>
                        <Input className="h-8" type="number" step="0.1" value={f.pct} onChange={e => updFaixa(i, fi, { pct: Number(e.target.value) })}/>
                        {f.nivel !== 'piso' && c.metrica !== 'sim_nao' && (<>
                          <Label className="text-[10px]">Alvo</Label>
                          <Input className="h-8" type="number" step="0.01" value={f.alvo ?? 0} onChange={e => updFaixa(i, fi, { alvo: Number(e.target.value) })}/>
                        </>)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground">Critérios individuais (avaliação e feedback)</h5>
                <Button size="sm" variant="outline" onClick={() => setP({ ...p, criterios_individuais: [...p.criterios_individuais, { nome: '', descricao: '', peso: 1 }] })}><Plus className="w-3 h-3 mr-1"/>Critério</Button>
              </div>
              {p.criterios_individuais.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-3" value={c.nome} onChange={e => updCrit(i, { nome: e.target.value })} placeholder="Critério"/>
                  <Textarea className="col-span-7" rows={2} value={c.descricao} onChange={e => updCrit(i, { descricao: e.target.value })}/>
                  <Input className="col-span-1" type="number" value={c.peso} onChange={e => updCrit(i, { peso: Number(e.target.value) })}/>
                  <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setP({ ...p, criterios_individuais: p.criterios_individuais.filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4"/></Button>
                </div>
              ))}
            </div>

            {p.observacoes && (
              <div className="text-xs border rounded p-2 bg-accent/30"><strong>Pontos para confirmar:</strong> {p.observacoes}</div>
            )}

            <div className="border rounded-md p-3 space-y-2 bg-primary/5">
              <Label className="text-xs">Pedir ajustes à IA</Label>
              <Textarea rows={2} value={ajustes} onChange={e => setAjustes(e.target.value)} placeholder="Ex.: troque o ticket médio por quantidade de peças vendidas e aumente o peso das vendas para 40%."/>
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => gerar(true)} disabled={running || !ajustes.trim()}>
                  {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <RefreshCw className="w-3 h-3 mr-1"/>}Refazer com IA
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmar} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Check className="w-4 h-4 mr-1"/>}Criar esta política
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
