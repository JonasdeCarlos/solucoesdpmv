import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logCctAudit } from '@/hooks/cct/useCctAnalyses';

export default function CctNovaPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Informe um título para a CCT.'); return; }
    setUploading(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop() || 'bin';
        const key = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('cct-docs').upload(key, file, { upsert: false });
        if (upErr) throw upErr;
        filePath = key;
        fileName = file.name;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('cct_analyses' as any).insert({
        title: title.trim(),
        original_file_path: filePath,
        original_file_name: fileName,
        status: 'em_analise',
        created_by: userData?.user?.id ?? null,
      } as any).select('id').single();
      if (error) throw error;

      const id = (data as any).id as string;
      await logCctAudit(id, 'upload', { file_name: fileName, file_path: filePath });
      toast.success('CCT criada. Em breve o Raio-X automático (Fase 2) processará o documento.');
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
            <Label>Arquivo (PDF, imagem ou documento)</Label>
            <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground mt-1">O arquivo será armazenado com segurança. OCR e Raio-X automático são executados na Fase 2.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav('/gestao-cct')} disabled={uploading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Upload className="w-4 h-4 mr-1"/>}
              Criar CCT
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}