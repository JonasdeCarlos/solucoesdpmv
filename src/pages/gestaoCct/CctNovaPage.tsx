import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { logCctAudit } from '@/hooks/cct/useCctAnalyses';

type FileKind = 'principal' | 'aditivo' | 'errata' | 'anexo';
type FileEntry = { file: File; kind: FileKind };

export default function CctNovaPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const hasPrincipal = entries.some((e) => e.kind === 'principal');
    const next: FileEntry[] = list.map((f, i) => ({
      file: f,
      kind: !hasPrincipal && i === 0 ? 'principal' : 'aditivo',
    }));
    setEntries((prev) => [...prev, ...next]);
  };

  const removeAt = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx));
  const setKind = (idx: number, kind: FileKind) => setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, kind } : e));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Informe um título para a CCT.'); return; }
    if (entries.length === 0) { toast.error('Anexe ao menos um arquivo.'); return; }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('cct_analyses' as any).insert({
        title: title.trim(),
        status: 'em_analise',
        created_by: userData?.user?.id ?? null,
      } as any).select('id').single();
      if (error) throw error;
      const id = (data as any).id as string;

      const principal = entries.find((e) => e.kind === 'principal') || entries[0];
      let principalPath: string | null = null;
      let principalName: string | null = null;

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const ext = e.file.name.split('.').pop() || 'bin';
        const key = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('cct-docs').upload(key, e.file, { upsert: false, contentType: e.file.type || undefined });
        if (upErr) throw upErr;
        await supabase.from('cct_analysis_files' as any).insert({
          cct_analysis_id: id,
          file_path: key,
          file_name: e.file.name,
          file_kind: e.kind,
          mime_type: e.file.type || null,
          size_bytes: e.file.size,
          order_index: i,
          uploaded_by: userData?.user?.id ?? null,
        } as any);
        if (e === principal) { principalPath = key; principalName = e.file.name; }
      }

      if (principalPath) {
        await supabase.from('cct_analyses' as any).update({
          original_file_path: principalPath,
          original_file_name: principalName,
        } as any).eq('id', id);
      }

      await logCctAudit(id, 'upload', { files: entries.length });
      toast.success(`CCT criada com ${entries.length} arquivo(s). Agora clique em "Analisar com IA".`);
      nav(`/gestao-cct/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar CCT.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav('/gestao-cct')}><ChevronLeft className="w-4 h-4"/>Voltar</Button>
      <Card>
        <CardHeader><CardTitle>Nova CCT</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título / Identificação</Label>
            <Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Ex.: CCT SINDHOTEIS-MG 2026/2027" />
          </div>
          <div>
            <Label>Arquivos (CCT principal + termos aditivos, erratas ou anexos)</Label>
            <Input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx" onChange={(e)=>{ addFiles(e.target.files); e.currentTarget.value=''; }} />
            <p className="text-xs text-muted-foreground mt-1">Anexe vários arquivos. Marque um como <b>principal</b> e os demais como <b>aditivo</b>, <b>errata</b> ou <b>anexo</b>. Todos serão analisados em conjunto pela IA.</p>
            {entries.length > 0 && (
              <div className="mt-3 space-y-2">
                {entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 border rounded p-2 text-sm">
                    <span className="flex-1 truncate">{e.file.name} <span className="text-xs text-muted-foreground">({Math.round(e.file.size/1024)} KB)</span></span>
                    <Select value={e.kind} onValueChange={(v)=>setKind(i, v as FileKind)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="aditivo">Aditivo</SelectItem>
                        <SelectItem value="errata">Errata</SelectItem>
                        <SelectItem value="anexo">Anexo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={()=>removeAt(i)} disabled={uploading}><X className="w-4 h-4"/></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav('/gestao-cct')} disabled={uploading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading || entries.length === 0}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Upload className="w-4 h-4 mr-1"/>}
              Criar CCT
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}