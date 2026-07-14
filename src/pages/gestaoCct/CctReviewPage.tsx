import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Check, X, Edit3, AlertTriangle, Save, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCctAnalysis, logCctAudit, type CctAnalysis } from '@/hooks/cct/useCctAnalyses';
import { JsonEditor } from '@/components/gestaoCct/JsonEditor';

const BLOCKS: Array<{ key: keyof CctAnalysis; label: string }> = [
  { key: 'identification', label: 'A) Identificação' },
  { key: 'unions', label: 'B) Sindicatos' },
  { key: 'territorial_base', label: 'C) Base territorial' },
  { key: 'professional_classes', label: 'D) Categorias / classes' },
  { key: 'economic_clauses', label: 'E) Cláusulas econômicas' },
  { key: 'benefits_summary', label: 'F) Benefícios obrigatórios' },
  { key: 'journey_rules', label: 'G) Jornada' },
  { key: 'overtime_rules', label: 'H) Horas extras / adicionais' },
  { key: 'vacation_absence', label: 'I) Férias / afastamentos' },
  { key: 'admission_termination', label: 'J) Admissão / rescisão' },
  { key: 'union_obligations', label: 'K) Obrigações sindicais' },
  { key: 'health_safety', label: 'L) Saúde e segurança' },
  { key: 'penalties', label: 'M) Multas / penalidades' },
  { key: 'dp_attention_points', label: 'N) Pontos de atenção para DP' },
];

type BlockStatus = 'pendente' | 'confirmado' | 'ignorado' | 'revisar';

interface ReviewMeta {
  blocks: Record<string, BlockStatus>;
  notes: string;
}

const emptyMeta = (): ReviewMeta => ({ blocks: {}, notes: '' });

function parseMeta(raw: string | null): ReviewMeta {
  if (!raw) return emptyMeta();
  try {
    const p = JSON.parse(raw);
    return { blocks: p.blocks || {}, notes: p.notes || '' };
  } catch {
    return { blocks: {}, notes: raw };
  }
}

const STATUS_STYLES: Record<BlockStatus, { label: string; variant: any }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  ignorado: { label: 'Ignorado', variant: 'outline' },
  revisar: { label: 'Revisar', variant: 'destructive' },
};

export default function CctReviewPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<CctAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [meta, setMeta] = useState<ReviewMeta>(emptyMeta());
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await fetchCctAnalysis(id);
    setA(data);
    if (data) {
      const initial: Record<string, any> = {};
      for (const b of BLOCKS) initial[b.key as string] = (data as any)[b.key] ?? (b.key === 'dp_attention_points' ? [] : {});
      setValues(initial);
      setMeta(parseMeta(data.reviewer_notes));
    }
    // Carrega PDF principal
    const { data: files } = await supabase.from('cct_analysis_files' as any).select('*').eq('cct_analysis_id', id).order('order_index');
    const principal = (files as any[] | null)?.find((f) => f.file_kind === 'principal') || (files as any[] | null)?.[0];
    if (principal) {
      const { data: signed } = await supabase.storage.from('cct-docs').createSignedUrl(principal.file_path, 3600);
      setPdfUrl(signed?.signedUrl || null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const setBlockStatus = (key: string, status: BlockStatus) => {
    setMeta((m) => ({ ...m, blocks: { ...m.blocks, [key]: status } }));
  };

  const stats = useMemo(() => {
    const total = BLOCKS.length;
    const confirmed = BLOCKS.filter((b) => meta.blocks[b.key as string] === 'confirmado').length;
    const pending = BLOCKS.filter((b) => !meta.blocks[b.key as string] || meta.blocks[b.key as string] === 'pendente').length;
    const toReview = BLOCKS.filter((b) => meta.blocks[b.key as string] === 'revisar').length;
    return { total, confirmed, pending, toReview };
  }, [meta]);

  const saveDraft = async (silent = false) => {
    if (!a) return;
    setSaving(true);
    try {
      const patch: any = { reviewer_notes: JSON.stringify(meta) };
      for (const b of BLOCKS) patch[b.key] = values[b.key as string];
      const { error } = await supabase.from('cct_analyses' as any).update(patch).eq('id', a.id);
      if (error) throw error;
      await logCctAudit(a.id, 'review_draft_saved', { blocks: meta.blocks });
      if (!silent) toast.success('Rascunho salvo.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!a) return;
    const notConfirmed = BLOCKS.filter((b) => meta.blocks[b.key as string] !== 'confirmado' && meta.blocks[b.key as string] !== 'ignorado');
    if (notConfirmed.length > 0) {
      if (!confirm(`Ainda há ${notConfirmed.length} bloco(s) sem confirmação/ignorar. Aprovar mesmo assim?`)) return;
    }
    setApproving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const patch: any = {
        reviewer_notes: JSON.stringify(meta),
        reviewed_by: userData?.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        status: 'aprovada',
      };
      for (const b of BLOCKS) patch[b.key] = values[b.key as string];
      const { error } = await supabase.from('cct_analyses' as any).update(patch).eq('id', a.id);
      if (error) throw error;
      await logCctAudit(a.id, 'review_approved', { blocks: meta.blocks });
      toast.success('Análise aprovada.');
      nav(`/gestao-cct/${a.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao aprovar.');
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!a) return <p className="text-muted-foreground">Análise não encontrada.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => nav(`/gestao-cct/${a.id}`)}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
          <h2 className="text-2xl font-bold">Revisar Raio-X</h2>
          <p className="text-sm text-muted-foreground">{a.title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <Badge variant="secondary">Total {stats.total}</Badge>
            <Badge variant="default">Confirmados {stats.confirmed}</Badge>
            <Badge variant="outline">Pendentes {stats.pending}</Badge>
            {stats.toReview > 0 && <Badge variant="destructive">Revisar {stats.toReview}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Save className="w-4 h-4 mr-1"/>}
            Salvar rascunho
          </Button>
          <Button onClick={approve} disabled={approving}>
            {approving ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <CheckCircle2 className="w-4 h-4 mr-1"/>}
            Aprovar análise
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4"/>Documento principal</CardTitle></CardHeader>
            <CardContent className="p-2">
              {pdfUrl ? (
                <embed src={`${pdfUrl}#toolbar=1`} type="application/pdf" className="w-full h-[75vh] rounded" />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum PDF disponível.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {BLOCKS.map((b) => {
            const key = b.key as string;
            const status: BlockStatus = meta.blocks[key] || 'pendente';
            const style = STATUS_STYLES[status];
            const conf = (values[key] && typeof values[key] === 'object' && 'confidence' in values[key]) ? (values[key] as any).confidence : null;
            return (
              <Card key={key} data-status={status}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">{b.label}</CardTitle>
                    <div className="flex items-center gap-1">
                      {conf && <Badge variant="outline" className="text-xs">Confiança: {conf}</Badge>}
                      <Badge variant={style.variant} className="text-xs">{style.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <JsonEditor value={values[key]} onChange={(nv) => setValues((prev) => ({ ...prev, [key]: nv }))} />
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" variant={status === 'confirmado' ? 'default' : 'outline'} onClick={() => setBlockStatus(key, 'confirmado')}><Check className="w-3 h-3 mr-1"/>Confirmar</Button>
                    <Button size="sm" variant={status === 'revisar' ? 'destructive' : 'outline'} onClick={() => setBlockStatus(key, 'revisar')}><AlertTriangle className="w-3 h-3 mr-1"/>Marcar p/ revisão</Button>
                    <Button size="sm" variant={status === 'ignorado' ? 'secondary' : 'outline'} onClick={() => setBlockStatus(key, 'ignorado')}><X className="w-3 h-3 mr-1"/>Ignorar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setBlockStatus(key, 'pendente')}><Edit3 className="w-3 h-3 mr-1"/>Pendente</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Notas do revisor</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={meta.notes} onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))} placeholder="Observações gerais sobre a revisão…" className="min-h-[100px]" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}