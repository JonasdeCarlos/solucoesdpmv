import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, GitCompareArrows, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BLOCO_LABEL: Record<string, string> = {
  identification: 'Identificação',
  unions: 'Sindicatos',
  territorial_base: 'Base territorial',
  professional_classes: 'Categorias / classes',
  economic_clauses: 'Cláusulas econômicas',
  benefits_summary: 'Benefícios obrigatórios',
  journey_rules: 'Jornada',
  overtime_rules: 'Horas extras / adicionais',
  vacation_absence: 'Férias / afastamentos',
  admission_termination: 'Admissão / rescisão',
  union_obligations: 'Obrigações sindicais',
  health_safety: 'Saúde e segurança',
  penalties: 'Multas / penalidades',
};

const TIPO_VARIANT: Record<string, any> = {
  alterado: 'default',
  novo: 'secondary',
  removido: 'destructive',
  mantido: 'outline',
};

interface Item { bloco?: string; titulo?: string; anterior?: string; nova?: string; tipo?: string; impacto?: string }

export default function CctCompararPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [analises, setAnalises] = useState<any[]>([]);
  const [anterior, setAnterior] = useState<string>(params.get('anterior') || '');
  const [nova, setNova] = useState<string>(params.get('nova') || '');
  const [rodando, setRodando] = useState(false);
  const [comparacao, setComparacao] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  const carregar = async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from('cct_analyses' as any).select('id, title, created_at, status').order('created_at', { ascending: false }),
      supabase.from('cct_comparacoes' as any).select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setAnalises((a || []) as any[]);
    setHistorico((c || []) as any[]);
  };

  useEffect(() => { carregar(); }, []);

  const nomePor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of analises) m[a.id] = a.title || 'Sem título';
    return m;
  }, [analises]);

  const comparar = async () => {
    if (!anterior || !nova) return toast.error('Selecione a CCT anterior e a nova.');
    if (anterior === nova) return toast.error('Selecione CCTs diferentes.');
    setRodando(true);
    const { data, error } = await supabase.functions.invoke('cct-comparar', {
      body: { analise_anterior_id: anterior, analise_nova_id: nova },
    });
    setRodando(false);
    if (error) return toast.error('Falha ao comparar as CCTs.');
    if ((data as any)?.error) return toast.error(String((data as any).error));
    setComparacao((data as any).comparacao);
    toast.success('Comparativo gerado.');
    carregar();
  };

  const itens: Item[] = Array.isArray(comparacao?.resultado?.itens) ? comparacao.resultado.itens : [];
  const porBloco = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const i of itens) {
      const k = i.bloco && BLOCO_LABEL[i.bloco] ? i.bloco : 'outros';
      (g[k] ||= []).push(i);
    }
    return g;
  }, [itens]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><GitCompareArrows className="w-6 h-6 text-primary" />Comparar CCTs</h2>
          <p className="text-sm text-muted-foreground">Confronte a convenção anterior com a nova e veja, bloco a bloco, o que mudou e o impacto no DP.</p>
        </div>
        <Button variant="outline" onClick={() => nav('/gestao-cct')}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">CCT anterior</Label>
            <Select value={anterior} onValueChange={setAnterior}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {analises.map((a) => <SelectItem key={a.id} value={a.id}>{a.title || 'Sem título'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CCT nova</Label>
            <Select value={nova} onValueChange={setNova}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {analises.map((a) => <SelectItem key={a.id} value={a.id}>{a.title || 'Sem título'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={comparar} disabled={rodando}>
            {rodando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <GitCompareArrows className="w-4 h-4 mr-1" />}
            Comparar
          </Button>
        </CardContent>
      </Card>

      {comparacao && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {comparacao.resumo && <p className="text-sm whitespace-pre-wrap">{comparacao.resumo}</p>}
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma diferença relevante identificada.</p>
            ) : (
              Object.entries(porBloco).map(([bloco, lista]) => (
                <div key={bloco} className="space-y-2">
                  <div className="font-semibold text-sm">{BLOCO_LABEL[bloco] || 'Outros pontos'}</div>
                  {lista.map((i, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={TIPO_VARIANT[i.tipo || 'alterado'] || 'default'}>{i.tipo || 'alterado'}</Badge>
                        <span className="text-sm font-medium">{i.titulo || '—'}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <div className="rounded bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground mb-1">Anterior</div>
                          <div className="whitespace-pre-wrap break-words">{i.anterior || '—'}</div>
                        </div>
                        <div className="rounded bg-primary/5 p-2">
                          <div className="text-xs text-muted-foreground mb-1">Nova</div>
                          <div className="whitespace-pre-wrap break-words">{i.nova || '—'}</div>
                        </div>
                      </div>
                      {i.impacto && <p className="text-xs text-muted-foreground">Impacto: {i.impacto}</p>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Comparativos anteriores</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comparativo gerado ainda.</p>
          ) : historico.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
              <span className="flex-1 min-w-[200px]">
                {nomePor[h.analise_anterior_id] || '—'} <span className="text-muted-foreground">→</span> {nomePor[h.analise_nova_id] || '—'}
              </span>
              {h.resultado?.origem === 'derivacao' && <Badge variant="outline">Consolidação parcial</Badge>}
              <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
              <Button size="sm" variant="ghost" onClick={() => setComparacao(h)}>Ver</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}