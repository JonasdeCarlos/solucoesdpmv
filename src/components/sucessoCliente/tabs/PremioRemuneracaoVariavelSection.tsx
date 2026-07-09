import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { PrizePolicy } from '@/hooks/usePrizePolicies';

type Tier = { ate: number | null; percentual: number };

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PremioRemuneracaoVariavelSection({
  policy, onUpdate,
}: {
  policy: PrizePolicy;
  onUpdate: (patch: Partial<PrizePolicy>) => Promise<void>;
}) {
  const initialTiers: Tier[] = Array.isArray(policy.rv_tiers) && policy.rv_tiers.length
    ? policy.rv_tiers as Tier[]
    : [{ ate: 100000, percentual: 5 }, { ate: null, percentual: 8 }];

  const [enabled, setEnabled] = useState(!!policy.remuneracao_variavel);
  const [base, setBase] = useState(policy.rv_base || 'faturamento');
  const [baseLabel, setBaseLabel] = useState(policy.rv_base_label || '');
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [pctIndividual, setPctIndividual] = useState<number>(Number(policy.rv_pct_individual ?? 60));
  const [pctIgual, setPctIgual] = useState<number>(Number(policy.rv_pct_igualitario ?? 40));
  const [observ, setObserv] = useState(policy.rv_observacoes || '');
  const [saving, setSaving] = useState(false);

  // Simulador
  const [simValor, setSimValor] = useState<number>(0);

  const totalPct = pctIndividual + pctIgual;

  const poolSimulado = useMemo(() => {
    if (!simValor) return 0;
    const ordered = [...tiers].sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
    const match = ordered.find(t => t.ate == null || simValor <= t.ate);
    return match ? simValor * (Number(match.percentual) / 100) : 0;
  }, [simValor, tiers]);

  const addTier = () => setTiers([...tiers, { ate: null, percentual: 0 }]);
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));
  const updateTier = (i: number, patch: Partial<Tier>) =>
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const save = async () => {
    if (enabled) {
      if (!tiers.length) { toast.error('Cadastre ao menos uma faixa.'); return; }
      if (totalPct > 100.01) { toast.error('A soma dos percentuais de distribuição não pode passar de 100%.'); return; }
      for (const t of tiers) {
        if (Number(t.percentual) < 0 || Number(t.percentual) > 100) {
          toast.error('Percentual da faixa deve estar entre 0 e 100.');
          return;
        }
      }
    }
    setSaving(true);
    try {
      await onUpdate({
        remuneracao_variavel: enabled,
        rv_base: base,
        rv_base_label: baseLabel || null,
        rv_tiers: tiers,
        rv_pct_individual: Number(pctIndividual || 0),
        rv_pct_igualitario: Number(pctIgual || 0),
        rv_observacoes: observ || null,
      } as any);
      toast.success('Remuneração variável salva.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-1">
          <TrendingUp className="w-4 h-4"/> Prêmio com remuneração variável
        </h4>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled}/>
          <span className="text-xs text-muted-foreground">Ativar</span>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label className="text-xs">Base de cálculo</Label>
              <Select value={base} onValueChange={setBase}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturamento">Faturamento bruto</SelectItem>
                  <SelectItem value="faturamento_liquido">Faturamento líquido</SelectItem>
                  <SelectItem value="lucro">Lucro</SelectItem>
                  <SelectItem value="meta_vendas">Meta de vendas</SelectItem>
                  <SelectItem value="outro">Outro (personalizado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {base === 'outro' && (
              <div className="md:col-span-8">
                <Label className="text-xs">Descreva a base</Label>
                <Input value={baseLabel} onChange={(e)=>setBaseLabel(e.target.value)} placeholder="Ex.: Nº de contratos fechados no mês"/>
              </div>
            )}
          </div>

          <div className="border rounded-md p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Faixas de distribuição</Label>
              <Button size="sm" variant="outline" onClick={addTier}><Plus className="w-3 h-3 mr-1"/>Adicionar faixa</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Para cada faixa, defina o valor máximo ({base === 'outro' ? 'unidade personalizada' : 'R$'}) da base e o percentual que será distribuído como {policy.verba_label}. Deixe "Até" vazio para "acima disso".
            </p>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-5">
                    <Label className="text-[11px]">Até {base === 'outro' ? '(unid.)' : '(R$)'}</Label>
                    <Input
                      type="number" step="0.01"
                      value={t.ate ?? ''}
                      placeholder="acima disso"
                      onChange={(e)=>updateTier(i, { ate: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <Label className="text-[11px]">% distribuído como prêmio</Label>
                    <Input type="number" step="0.01" min={0} max={100}
                      value={t.percentual}
                      onChange={(e)=>updateTier(i, { percentual: Number(e.target.value) })}/>
                  </div>
                  <div className="md:col-span-2">
                    <Button size="sm" variant="ghost" onClick={()=>removeTier(i)}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label className="text-xs">% do bolo distribuído por critérios individuais</Label>
              <Input type="number" step="0.01" min={0} max={100}
                value={pctIndividual} onChange={(e)=>setPctIndividual(Number(e.target.value))}/>
              <p className="text-[10px] text-muted-foreground mt-1">
                Ponderado por assiduidade, pontualidade, e demais critérios da política.
              </p>
            </div>
            <div className="md:col-span-4">
              <Label className="text-xs">% distribuído igualitariamente</Label>
              <Input type="number" step="0.01" min={0} max={100}
                value={pctIgual} onChange={(e)=>setPctIgual(Number(e.target.value))}/>
              <p className="text-[10px] text-muted-foreground mt-1">
                Parte fixa dividida em partes iguais entre elegíveis.
              </p>
            </div>
            <div className="md:col-span-4 flex items-end">
              <div className={`text-xs px-2 py-1 rounded w-full text-center ${totalPct > 100 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                Soma: <strong>{totalPct.toFixed(2)}%</strong> {totalPct < 100 && <span className="text-muted-foreground">(retenção: {(100-totalPct).toFixed(2)}%)</span>}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações / regulamento</Label>
            <Textarea rows={2} value={observ} onChange={(e)=>setObserv(e.target.value)}
              placeholder="Ex.: valor limitado ao caixa disponível; faltas injustificadas reduzem a nota individual."/>
          </div>

          <div className="border rounded-md p-3 bg-primary/5 space-y-2">
            <Label className="text-xs font-semibold">Simulador rápido</Label>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-4">
                <Label className="text-[11px]">{base === 'outro' ? (baseLabel || 'Base personalizada') : 'Valor da base ' + (base === 'faturamento' ? '(faturamento)' : '')}</Label>
                <Input type="number" step="0.01" value={simValor} onChange={(e)=>setSimValor(Number(e.target.value))}/>
              </div>
              <div className="md:col-span-8 text-xs space-y-1">
                <div>Bolo total do {policy.verba_label}: <strong>{fmtBRL(poolSimulado)}</strong></div>
                <div>→ Distribuído por critérios individuais ({pctIndividual}%): <strong>{fmtBRL(poolSimulado * pctIndividual / 100)}</strong></div>
                <div>→ Distribuído igualitariamente ({pctIgual}%): <strong>{fmtBRL(poolSimulado * pctIgual / 100)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-3 h-3 mr-1"/>Salvar remuneração variável
        </Button>
      </div>
    </div>
  );
}