import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Wand2, FileDown, Share2, Trash2, Eye } from 'lucide-react';
import { useFeedback, type FeedbackRecord } from '@/hooks/useFeedback';
import { generateFeedbackPdf } from '@/utils/sucessoCliente/feedbackPdf';
import { toast } from 'sonner';

type Tipo = 'feedback' | 'cobranca' | 'alinhamento';

export default function FeedbackTab({ client_id, cliente }: { client_id: string; cliente: any }) {
  const { items, create, update, remove, generate } = useFeedback(client_id);
  const [tipo, setTipo] = useState<Tipo>('feedback');
  const [form, setForm] = useState({
    employee_name: '',
    employee_role: '',
    manager_name: '',
    pontos_fortes: '',
    pontos_melhorar: '',
    fato_ocorrido: '',
    tom: 'medio' as 'leve' | 'medio' | 'cobranca',
  });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string>('');

  const reset = () => {
    setForm({ employee_name: '', employee_role: '', manager_name: '', pontos_fortes: '', pontos_melhorar: '', fato_ocorrido: '', tom: 'medio' });
    setPreview('');
  };

  const handleGenerate = async () => {
    if (!form.employee_name.trim()) { toast.error('Informe o nome do colaborador.'); return; }
    if (tipo === 'feedback' && !form.pontos_fortes.trim() && !form.pontos_melhorar.trim()) { toast.error('Informe pontos fortes ou a melhorar.'); return; }
    if ((tipo === 'cobranca' || tipo === 'alinhamento') && !form.fato_ocorrido.trim()) { toast.error('Descreva o fato ocorrido.'); return; }
    setGenerating(true);
    const { texto, error } = await generate({
      tipo,
      employee_name: form.employee_name,
      employee_role: form.employee_role || undefined,
      manager_name: form.manager_name || undefined,
      pontos_fortes: form.pontos_fortes || undefined,
      pontos_melhorar: form.pontos_melhorar || undefined,
      fato_ocorrido: form.fato_ocorrido || undefined,
      tom: tipo === 'feedback' ? undefined : form.tom,
    });
    setGenerating(false);
    if (error || !texto) { toast.error('Falha ao gerar texto.'); return; }
    setPreview(texto);
    toast.success('Texto gerado pela IA — revise antes de salvar.');
  };

  const handleSave = async () => {
    if (!preview.trim()) { toast.error('Gere o texto antes de salvar.'); return; }
    const { error } = await create({
      tipo,
      employee_name: form.employee_name,
      employee_role: form.employee_role || null,
      manager_name: form.manager_name || null,
      pontos_fortes: form.pontos_fortes || null,
      pontos_melhorar: form.pontos_melhorar || null,
      fato_ocorrido: form.fato_ocorrido || null,
      tom: tipo === 'feedback' ? null : form.tom,
      generated_text: preview,
    });
    if (error) { toast.error('Erro ao salvar.'); return; }
    toast.success('Registro salvo no histórico.');
    reset();
  };

  const handlePdf = async (rec: FeedbackRecord) => {
    await generateFeedbackPdf({
      empresa: cliente?.nome || '',
      tipo: rec.tipo,
      employee_name: rec.employee_name,
      employee_role: rec.employee_role,
      manager_name: rec.manager_name,
      tom: rec.tom,
      texto: rec.generated_text || '',
    });
  };

  const handleShare = async (rec: FeedbackRecord) => {
    const link = `${window.location.origin}/feedback/${rec.public_token}`;
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado: ' + link); }
    catch { prompt('Copie o link:', link); }
  };

  const tipoLabel = (t: Tipo) => t === 'feedback' ? 'Feedback' : t === 'cobranca' ? 'Cobrança/Alinhamento' : 'Documento de alinhamento';

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Novo registro</h3>
          <Tabs value={tipo} onValueChange={(v)=>{ setTipo(v as Tipo); setPreview(''); }}>
            <TabsList>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
              <TabsTrigger value="alinhamento">Alinhamento</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Colaborador *</Label><Input value={form.employee_name} onChange={(e)=>setForm({...form, employee_name: e.target.value})}/></div>
          <div><Label>Cargo</Label><Input value={form.employee_role} onChange={(e)=>setForm({...form, employee_role: e.target.value})}/></div>
          <div><Label>Gestor responsável</Label><Input value={form.manager_name} onChange={(e)=>setForm({...form, manager_name: e.target.value})}/></div>
        </div>

        {tipo === 'feedback' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Pontos fortes</Label><Textarea rows={4} value={form.pontos_fortes} onChange={(e)=>setForm({...form, pontos_fortes: e.target.value})} placeholder="O que o colaborador faz bem…"/></div>
            <div><Label>Pontos a melhorar</Label><Textarea rows={4} value={form.pontos_melhorar} onChange={(e)=>setForm({...form, pontos_melhorar: e.target.value})} placeholder="Oportunidades de desenvolvimento…"/></div>
          </div>
        )}

        {(tipo === 'cobranca' || tipo === 'alinhamento') && (
          <>
            <div><Label>Fato ocorrido *</Label><Textarea rows={4} value={form.fato_ocorrido} onChange={(e)=>setForm({...form, fato_ocorrido: e.target.value})} placeholder="Descreva o fato de forma objetiva (data, contexto, impacto)…"/></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Tom do alinhamento</Label>
                <Select value={form.tom} onValueChange={(v)=>setForm({...form, tom: v as any})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve (lembrete cordial)</SelectItem>
                    <SelectItem value="medio">Médio (alinhamento firme)</SelectItem>
                    <SelectItem value="cobranca">Cobrança (formal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tipo === 'alinhamento' && (
                <>
                  <div><Label>Pontos fortes (opcional)</Label><Input value={form.pontos_fortes} onChange={(e)=>setForm({...form, pontos_fortes: e.target.value})}/></div>
                  <div><Label>Pontos a melhorar (opcional)</Label><Input value={form.pontos_melhorar} onChange={(e)=>setForm({...form, pontos_melhorar: e.target.value})}/></div>
                </>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={reset}>Limpar</Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Wand2 className="w-4 h-4 mr-1"/>}
            Gerar com IA
          </Button>
        </div>

        {preview && (
          <div className="space-y-2 border rounded-md p-3 bg-muted/40">
            <Label>Texto gerado (você pode editar antes de salvar)</Label>
            <Textarea rows={12} value={preview} onChange={(e)=>setPreview(e.target.value)}/>
            <p className="text-xs text-muted-foreground">⚠ Texto gerado por IA com salvaguardas contra assédio moral. Revise antes de compartilhar.</p>
            <div className="flex justify-end"><Button onClick={handleSave}>Salvar no histórico</Button></div>
          </div>
        )}
      </CardContent></Card>

      <div className="space-y-2">
        <h3 className="font-semibold">Histórico</h3>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
        {items.map(rec => (
          <Card key={rec.id}><CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{tipoLabel(rec.tipo)}</Badge>
                  {rec.tom && <Badge variant="secondary">tom: {rec.tom}</Badge>}
                  <span className="text-sm font-semibold">{rec.employee_name}</span>
                  {rec.employee_role && <span className="text-xs text-muted-foreground">— {rec.employee_role}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(rec.created_at).toLocaleString('pt-BR')}
                  {rec.manager_name && ` • Gestor: ${rec.manager_name}`}
                  {Array.isArray(rec.view_log) && rec.view_log.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1"><Eye className="w-3 h-3"/>{rec.view_log.length} visualização(ões)</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={()=>handleShare(rec)}><Share2 className="w-3 h-3 mr-1"/>Link</Button>
                <Button size="sm" variant="outline" onClick={()=>handlePdf(rec)}><FileDown className="w-3 h-3 mr-1"/>PDF</Button>
                <Button size="sm" variant="ghost" onClick={async ()=>{ if (confirm('Excluir registro?')) { await remove(rec.id); toast.success('Excluído.'); } }}><Trash2 className="w-3 h-3"/></Button>
              </div>
            </div>
            {rec.generated_text && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Ver texto</summary>
                <p className="whitespace-pre-wrap mt-2">{rec.generated_text}</p>
              </details>
            )}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}