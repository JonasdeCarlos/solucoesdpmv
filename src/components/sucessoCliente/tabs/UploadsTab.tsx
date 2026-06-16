import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Eye } from 'lucide-react';
import { useUploads } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

const uploadTypeLabels: Record<string, string> = {
  holerite_modelo: 'Holerite modelo',
  ponto_modelo: 'Modelo de ponto',
  outro: 'Outro',
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error || 'Erro desconhecido');

const fileTypeFromName = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
};

const safeTitle = (filename: string) => filename.replace(/[<>&"']/g, '');

export default function UploadsTab({ client_id }: { client_id: string }) {
  const { items, upload, getFile } = useUploads(client_id);
  const [type, setType] = useState('holerite_modelo');

  const handle = async (f: File) => {
    const { error } = await upload(f, type);
    if (error) toast.error('Erro: ' + errorMessage(error));
    else toast.success('Arquivo enviado.');
  };

  const view = async (path: string, filename: string, mimeType?: string | null) => {
    const tab = window.open('', '_blank');
    if (!tab) {
      await download(path, filename);
      toast.message('Popup bloqueado — arquivo baixado.');
      return;
    }

    try {
      tab.document.write('<!doctype html><title>Carregando arquivo...</title><body style="font-family:Arial,sans-serif;padding:24px">Carregando arquivo...</body>');
      tab.document.close();

      const data = await getFile(path);
      const type = data.type || mimeType || fileTypeFromName(filename);
      const blob = data.type ? data : new Blob([await data.arrayBuffer()], { type });
      const url = URL.createObjectURL(blob);
      const title = safeTitle(filename || 'Arquivo');
      const isPdf = type.includes('pdf') || filename.toLowerCase().endsWith('.pdf');
      const isImage = type.startsWith('image/') && !filename.toLowerCase().endsWith('.heic');

      if (isPdf) {
        tab.document.open();
        tab.document.write(`<!doctype html><title>${title}</title><style>html,body{margin:0;height:100%;overflow:hidden}embed{width:100%;height:100%;border:0}</style><embed src="${url}#toolbar=1" type="application/pdf" />`);
        tab.document.close();
      } else if (isImage) {
        tab.document.open();
        tab.document.write(`<!doctype html><title>${title}</title><style>html,body{margin:0;min-height:100%;background:#111;display:grid;place-items:center}img{max-width:100%;max-height:100vh;object-fit:contain}</style><img src="${url}" alt="${title}" />`);
        tab.document.close();
      } else {
        tab.location.href = url;
      }

      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e: unknown) {
      tab.close();
      toast.error('Erro ao abrir: ' + errorMessage(e));
    }
  };

  const download = async (path: string, filename: string) => {
    try {
      const blob = await getFile(path);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'arquivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: unknown) {
      toast.error('Erro ao baixar: ' + errorMessage(e));
    }
  };

  const label = (t: string) => uploadTypeLabels[t] || t;

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex gap-2 items-end">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="holerite_modelo">Holerite modelo</SelectItem>
              <SelectItem value="ponto_modelo">Modelo de ponto</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="inline-flex">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={(e)=>e.target.files?.[0] && handle(e.target.files[0])}/>
          <span className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer hover:opacity-90"><Upload className="w-4 h-4 mr-1"/>Enviar arquivo</span>
        </label>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Versão</TableHead><TableHead>Data</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum arquivo.</TableCell></TableRow> :
          items.map(u => (
            <TableRow key={u.id}>
              <TableCell><Badge variant="outline">{label(u.upload_type)}</Badge></TableCell>
              <TableCell className="truncate max-w-xs">{u.file_name}</TableCell>
              <TableCell>v{u.version}</TableCell>
              <TableCell className="text-xs">{new Date(u.uploaded_at).toLocaleString('pt-BR')}</TableCell>
              <TableCell className="flex gap-1">
                <Button size="sm" variant="ghost" title="Visualizar" onClick={()=>view(u.file_path, u.file_name, u.mime_type)}><Eye className="w-4 h-4"/></Button>
                <Button size="sm" variant="ghost" title="Baixar" onClick={()=>download(u.file_path, u.file_name)}><Download className="w-4 h-4"/></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}