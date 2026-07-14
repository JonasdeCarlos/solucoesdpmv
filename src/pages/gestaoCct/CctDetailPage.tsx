import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, FileText, Download, MessageSquare, Sparkles, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCctAnalysis, logCctAudit, type CctAnalysis } from '@/hooks/cct/useCctAnalyses';

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

type CctFile = {
  id: string;
  file_path: string;
  file_name: string;
  file_kind: string;
  mime_type: string | null;
  size_bytes: number | null;
  order_index: number;
};

function JsonBlock({ data }: { data: any }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <p className="text-sm text-muted-foreground italic">Ainda não extraído. Clique em "Analisar com IA".</p>;
  }
  return <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}

export default function CctDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<CctAnalysis | null>(null);
  const [files, setFiles] = useState<CctFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [aData, fData] = await Promise.all([
      fetchCctAnalysis(id),
      supabase.from('cct_analysis_files' as any).select('*').eq('cct_analysis_id', id).order('order_index'),
    ]);
    setA(aData);
    setFiles(((fData.data || []) as any) as CctFile[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('cct-docs').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error('Não foi possível abrir o arquivo.'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const removeFile = async (f: CctFile) => {
    if (!confirm(`Remover ${f.file_name}?`)) return;
    await supabase.storage.from('cct-docs').remove([f.file_path]);
    await supabase.from('cct_analysis_files' as any).delete().eq('id', f.id);
    toast.success('Arquivo removido.');
    reload();
  };

  const changeKind = async (f: CctFile, kind: string) => {
    await supabase.from('cct_analysis_files' as any).update({ file_kind: kind } as any).eq('id', f.id);
    reload();
  };

  const addExtraFiles = async (list: FileList | null) => {
    if (!list || !a) return;
    setUploadingExtra(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      let nextIndex = files.length;
      for (const f of Array.from(list)) {
        const ext = f.name.split('.').pop() || 'bin';
        const key = `${a.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('cct-docs').upload(key, f, { upsert: false, contentType: f.type || undefined });
        if (upErr) throw upErr;
        await supabase.from('cct_analysis_files' as any).insert({
          cct_analysis_id: a.id,
          file_path: key,
          file_name: f.name,
          file_kind: 'aditivo',
          mime_type: f.type || null,
          size_bytes: f.size,
          order_index: nextIndex++,
          uploaded_by: userData?.user?.id ?? null,
        } as any);
      }
      await logCctAudit(a.id, 'upload', { extra_files: list.length });
      toast.success('Arquivo(s) anexado(s).');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao anexar arquivo.');
    } finally {
      setUploadingExtra(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyze = async () => {
    if (!a) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cct-analyze', { body: { analysis_id: a.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Análise concluída. Revise os blocos abaixo.');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Falha na análise IA.');
    } finally {
      setAnalyzing(false);
    }
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
            {a.ocr_applied ? <Badge>Analisado</Badge> : null}
            {a.confidence_score != null ? <Badge variant="outline">Confiança {Number(a.confidence_score).toFixed(2)}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={analyze} disabled={analyzing || files.length === 0}>
            {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Sparkles className="w-4 h-4 mr-1"/>}
            {a.ocr_applied ? 'Reanalisar com IA' : 'Analisar com IA'}
          </Button>
          <Button variant="outline" onClick={() => nav(`/gestao-cct/${a.id}/revisar`)}><FileText className="w-4 h-4 mr-1"/>Revisar Raio-X</Button>
          <Button variant="outline" onClick={() => nav(`/gestao-cct/${a.id}/perguntar`)}><MessageSquare className="w-4 h-4 mr-1"/>Perguntar à CCT</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Arquivos anexados ({files.length})</CardTitle>
          <div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx" className="hidden" onChange={(e)=>addExtraFiles(e.target.files)} />
            <Button size="sm" variant="outline" onClick={()=>fileInputRef.current?.click()} disabled={uploadingExtra}>
              {uploadingExtra ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Paperclip className="w-4 h-4 mr-1"/>}
              Anexar aditivo / arquivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo. Anexe a CCT antes de analisar.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                  <span className="flex-1 truncate">{f.file_name} {f.size_bytes ? <span className="text-xs text-muted-foreground">({Math.round(f.size_bytes/1024)} KB)</span> : null}</span>
                  <Select value={f.file_kind} onValueChange={(v)=>changeKind(f, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="aditivo">Aditivo</SelectItem>
                      <SelectItem value="errata">Errata</SelectItem>
                      <SelectItem value="anexo">Anexo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={()=>openFile(f.file_path)}><Download className="w-4 h-4"/></Button>
                  <Button size="sm" variant="ghost" onClick={()=>removeFile(f)}><X className="w-4 h-4"/></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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