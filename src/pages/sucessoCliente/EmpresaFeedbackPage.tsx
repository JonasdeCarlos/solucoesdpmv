import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, FileDown, Trash2, Share2, Pencil, Save, X } from 'lucide-react';
import { generateFeedbackPdf } from '@/utils/sucessoCliente/feedbackPdf';
import { buildExternalAppLink } from '@/utils/publicLinks';
import { toast } from 'sonner';

type Tipo = 'feedback' | 'cobranca' | 'alinhamento';

export default function EmpresaFeedbackPage() {
  const { token } = useParams();
  const [empresa, setEmpresa] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<Tipo>('feedback');
  const [form, setForm] = useState({ employee_name: '', employee_role: '', manager_name: '', pontos_fortes: '', pontos_melhorar: '', fato_ocorrido: '', tom: 'medio' as 'leve'|'medio'|'cobranca' });
  const [preview, setPreview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const call = useCallback(async (action: string, extra: any = {}) => {
    const { data, error } = await supabase.functions.invoke('feedback-empresa', { body: { token, action, ...extra } });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  }, [token]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const d = await call('list');
      setEmpresa(d.empresa); setItems(d.items || []);
    } catch (e: any) { setError(e.message || 'Erro'); }
    finally { setLoading(false); }
  }, [call]);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    if (!form.employee_name.trim()) { toast.error('Informe o colaborador.'); return; }
    if (tipo === 'feedback' && !form.pontos_fortes.trim() && !form.pontos_melhorar.trim()) { toast.error('Informe pontos fortes ou a melhorar.'); return; }
    if (tipo !== 'feedback' && !form.fato_ocorrido.trim()) { toast.error('Descreva o fato ocorrido.'); return; }
    setGenerating(true);
    try {
      const d = await call('generate', { input: { tipo, ...form, tom: tipo === 'feedback' ? undefined : form.tom } });
      setPreview(d.texto || '');
      toast.success('Texto gerado — revise antes de salvar.');
    } catch (e: any) { toast.error(e.message || 'Falha ao gerar.'); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!preview.trim()) { toast.error('Gere o texto antes de salvar.'); return; }
    try {
      await call('create', { record: { ...form, tipo, tom: tipo === 'feedback' ? null : form.tom, generated_text: preview } });
      toast.success('Salvo no histórico.');
      setForm({ employee_name: '', employee_role: '', manager_name: '', pontos_fortes: '', pontos_melhorar: '', fato_ocorrido: '', tom: 'medio' });
      setPreview('');
      reload();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar.'); }
  };

  const handleUpdate = async (id: string) => {
    try { await call('update', { id, generated_text: editText }); toast.success('Atualizado.'); setEditId(null); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir registro?')) return;
    try { await call('delete', { id }); toast.success('Excluído.'); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleShare = async (rec: any) => {
    const link = buildExternalAppLink(`/feedback/${rec.public_token}`);
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado.'); }
    catch { prompt('Copie o link:', link); }
  };

  const handlePdf = async (rec: any) => {
    await generateFeedbackPdf({
      empresa: empresa?.nome || '', tipo: rec.tipo, employee_name: rec.employee_name,
      employee_role: rec.employee_role, manager_name: rec.manager_name, tom: rec.tom,
      texto: rec.generated_text || '',
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;

  const tipoLabel = (t: Tipo) => t === 'feedback' ? 'Feedback' : t === 'cobranca' ? 'Cobrança/Alinhamento' : 'Documento de alinhamento';

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <Card><CardContent className="p-6">
          <h1 className="text-2xl font-bold">Ferramenta de Feedback</h1>
          <p className="text-sm text-muted-foreground">{empresa?.nome}{empresa?.nome_fantasia ? ` — ${empresa.nome_fantasia}` : ''}</p>
          <p className="text-xs text-muted-foreground mt-2">Espaço exclusivo da sua empresa. Os registros ficam armazenados no histórico abaixo e podem ser compartilhados por link individual com gestor/diretor.</p>
        </CardContent></Card>

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
              <div><Label>Pontos fortes</Label><Textarea rows={4} value={form.pontos_fortes} onChange={(e)=>setForm({...form, pontos_fortes: e.target.value})}/></div>
              <div><Label>Pontos a melhorar</Label><Textarea rows={4} value={form.pontos_melhorar} onChange={(e)=>setForm({...form, pontos_melhorar: e.target.value})}/></div>
            </div>
          )}
          {tipo !== 'feedback' && (
            <>
              <div><Label>Fato ocorrido *</Label><Textarea rows={4} value={form.fato_ocorrido} onChange={(e)=>setForm({...form, fato_ocorrido: e.target.value})} placeholder="Descreva o fato (data, contexto, impacto)…"/></div>
              <div className="md:w-1/3"><Label>Tom</Label>
                <Select value={form.tom} onValueChange={(v)=>setForm({...form, tom: v as any})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="cobranca">Cobrança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Wand2 className="w-4 h-4 mr-1"/>}Gerar com IA
            </Button>
          </div>

          {preview && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/40">
              <Label>Texto gerado (edite antes de salvar)</Label>
              <Textarea rows={12} value={preview} onChange={(e)=>setPreview(e.target.value)}/>
              <p className="text-xs text-muted-foreground">⚠ Gerado por IA com salvaguardas contra assédio moral. Revise antes de compartilhar.</p>
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
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {editId === rec.id ? (
                    <>
                      <Button size="sm" onClick={()=>handleUpdate(rec.id)}><Save className="w-3 h-3 mr-1"/>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={()=>setEditId(null)}><X className="w-3 h-3"/></Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>{ setEditId(rec.id); setEditText(rec.generated_text || ''); }}><Pencil className="w-3 h-3 mr-1"/>Editar</Button>
                      <Button size="sm" variant="outline" onClick={()=>handleShare(rec)}><Share2 className="w-3 h-3 mr-1"/>Link</Button>
                      <Button size="sm" variant="outline" onClick={()=>handlePdf(rec)}><FileDown className="w-3 h-3 mr-1"/>PDF</Button>
                      <Button size="sm" variant="ghost" onClick={()=>handleDelete(rec.id)}><Trash2 className="w-3 h-3"/></Button>
                    </>
                  )}
                </div>
              </div>
              {editId === rec.id ? (
                <Textarea rows={10} value={editText} onChange={(e)=>setEditText(e.target.value)}/>
              ) : rec.generated_text && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Ver texto</summary>
                  <p className="whitespace-pre-wrap mt-2">{rec.generated_text}</p>
                </details>
              )}
            </CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}