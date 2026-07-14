import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, FileText, Download, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCctAnalysis, type CctAnalysis } from '@/hooks/cct/useCctAnalyses';

const BLOCK_TITLES: Record<string, string> = {
  identification: 'A) Identificação',
  unions: 'B) Sindicatos',
  territorial_base: 'C) Base territorial',
  professional_classes: 'D) Categorias / classes',
  economic_clauses: 'E) Cláusulas econômicas',
  benefits_summary: 'F) Benefícios obrigatórios',
  journey_rules: 'G) Jornada',
  overtime_rules: 'H) Horas extras / adicionais',
  vacation_absence: 'I) Férias / afastamentos',
  admission_termination: 'J) Admissão / rescisão',
  union_obligations: 'K) Obrigações sindicais',
  health_safety: 'L) Saúde e segurança',
  penalties: 'M) Multas / penalidades',
};

function JsonBlock({ data }: { data: any }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <p className="text-sm text-muted-foreground italic">Ainda não extraído. Execute a análise (Fase 2) para preencher.</p>;
  }
  return <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}

export default function CctDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<CctAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const data = await fetchCctAnalysis(id);
      setA(data);
      setLoading(false);
    })();
  }, [id]);

  const openFile = async () => {
    if (!a?.original_file_path) return;
    const { data, error } = await supabase.storage.from('cct-docs').createSignedUrl(a.original_file_path, 3600);
    if (error || !data?.signedUrl) { toast.error('Não foi possível abrir o arquivo.'); return; }
    setDownloadingUrl(data.signedUrl);
    window.open(data.signedUrl, '_blank');
  };

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!a) return <p className="text-muted-foreground">Análise não encontrada.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => nav('/gestao-cct')}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
          <h2 className="text-2xl font-bold">{a.title || 'Sem título'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{a.status}</Badge>
            {a.ocr_applied ? <Badge>OCR aplicado</Badge> : null}
            {a.confidence_score != null ? <Badge variant="outline">Confiança {Number(a.confidence_score).toFixed(2)}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.original_file_path && <Button variant="outline" onClick={openFile}><Download className="w-4 h-4 mr-1"/>Baixar original</Button>}
          <Button variant="outline" onClick={() => nav(`/gestao-cct/${a.id}/revisar`)}><FileText className="w-4 h-4 mr-1"/>Revisar Raio-X</Button>
          <Button variant="outline" onClick={() => nav(`/gestao-cct/${a.id}/perguntar`)}><MessageSquare className="w-4 h-4 mr-1"/>Perguntar à CCT</Button>
          <Button disabled><Sparkles className="w-4 h-4 mr-1"/>Gerar Raio-X (Fase 2)</Button>
        </div>
      </div>

      {a.ai_summary && (
        <Card><CardHeader><CardTitle>Resumo IA</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{a.ai_summary}</p></CardContent></Card>
      )}

      {Object.entries(BLOCK_TITLES).map(([key, label]) => (
        <Card key={key}>
          <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
          <CardContent><JsonBlock data={(a as any)[key]} /></CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle className="text-base">N) Pontos de atenção para DP</CardTitle></CardHeader>
        <CardContent>
          {Array.isArray(a.dp_attention_points) && a.dp_attention_points.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-sm">
              {a.dp_attention_points.map((p: any, i: number) => <li key={i}>{typeof p === 'string' ? p : JSON.stringify(p)}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground italic">Ainda não extraído.</p>}
        </CardContent>
      </Card>
    </div>
  );
}