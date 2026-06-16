import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, Eye, Loader2 } from 'lucide-react';
import { useUploads } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

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

type PreviewState = {
  open: boolean;
  loading: boolean;
  url: string;
  blob: Blob | null;
  fileName: string;
  type: string;
  path: string;
  error: string;
};

const emptyPreview: PreviewState = { open: false, loading: false, url: '', blob: null, fileName: '', type: '', path: '', error: '' };

const releasePreviewUrls = (state: PreviewState) => {
  if (state.url) URL.revokeObjectURL(state.url);
};

export default function UploadsTab({ client_id }: { client_id: string }) {
  const { items, upload, getFile } = useUploads(client_id);
  const [type, setType] = useState('holerite_modelo');
  const [preview, setPreview] = useState<PreviewState>(emptyPreview);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewName = safeTitle(preview.fileName || 'Arquivo');
  const previewIsPdf = preview.type.includes('pdf') || preview.fileName.toLowerCase().endsWith('.pdf');
  const previewIsImage = preview.type.startsWith('image/') && !preview.fileName.toLowerCase().endsWith('.heic');

  useEffect(() => {
    return () => {
      releasePreviewUrls(preview);
    };
  }, [preview.url]);

  const handle = async (f: File) => {
    const { error } = await upload(f, type);
    if (error) toast.error('Erro: ' + errorMessage(error));
    else toast.success('Arquivo enviado.');
  };

  const view = async (path: string, filename: string, mimeType?: string | null) => {
    releasePreviewUrls(preview);
    setPreview({ ...emptyPreview, open: true, loading: true, fileName: filename, path });
    try {
      const data = await getFile(path);
      const type = data.type || mimeType || fileTypeFromName(filename);
      const blob = data.type ? data : new Blob([await data.arrayBuffer()], { type });
      const url = URL.createObjectURL(blob);
      const isPdf = type.includes('pdf') || filename.toLowerCase().endsWith('.pdf');
      setPdfPage(1);
      setPdfPages(0);
      setPreview({ open: true, loading: false, url, blob: isPdf ? blob : null, fileName: filename, type, path, error: '' });
    } catch (e: unknown) {
      setPreview({ ...emptyPreview, open: true, fileName: filename, path, error: errorMessage(e) });
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

  useEffect(() => {
    if (!preview.open || !preview.blob || !previewIsPdf || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      setPdfRendering(true);
      try {
        const bytes = await preview.blob!.arrayBuffer();
        const pdf = await (pdfjs as any).getDocument({ data: bytes.slice(0) }).promise;
        if (cancelled) return;
        setPdfPages(pdf.numPages);
        const page = await pdf.getPage(Math.min(pdfPage, pdf.numPages));
        if (cancelled || !canvasRef.current) return;
        const containerWidth = canvasRef.current.parentElement?.clientWidth || 900;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.max(0.8, (containerWidth - 32) / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível renderizar o PDF.');
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (e) {
        if (!cancelled) setPreview((current) => ({ ...current, error: errorMessage(e) }));
      } finally {
        if (!cancelled) setPdfRendering(false);
      }
    };

    render();
    return () => { cancelled = true; };
  }, [preview.open, preview.blob, previewIsPdf, pdfPage]);

  const label = (t: string) => uploadTypeLabels[t] || t;

  return (
    <>
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
                <Button type="button" size="sm" variant="ghost" title="Visualizar" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); view(u.file_path, u.file_name, u.mime_type); }}><Eye className="w-4 h-4"/></Button>
                <Button type="button" size="sm" variant="ghost" title="Baixar" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); download(u.file_path, u.file_name); }}><Download className="w-4 h-4"/></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
      <Dialog open={preview.open} onOpenChange={(open) => {
        setPreview((current) => {
          if (!open) releasePreviewUrls(current);
          return open ? current : emptyPreview;
        });
      }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{previewName}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 rounded-md border bg-muted/20 overflow-hidden">
            {preview.loading ? (
              <div className="h-full grid place-items-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                Carregando arquivo...
              </div>
            ) : preview.error ? (
              <div className="h-full grid place-items-center p-6 text-center text-sm text-muted-foreground">
                Não foi possível visualizar este arquivo: {preview.error}
              </div>
            ) : previewIsPdf && preview.blob ? (
              <div className="h-full overflow-auto bg-muted/40 p-4">
                {pdfRendering && <div className="text-center text-xs text-muted-foreground mb-2">Renderizando página...</div>}
                <canvas ref={canvasRef} className="mx-auto max-w-full rounded-sm bg-background shadow-sm" />
              </div>
            ) : preview.url && previewIsImage ? (
              <div className="h-full grid place-items-center bg-background">
                <img src={preview.url} alt={previewName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="h-full grid place-items-center p-6 text-center text-sm text-muted-foreground">
                Pré-visualização indisponível para este formato. Use o botão de download.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {previewIsPdf && pdfPages > 1 && (
              <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Button type="button" variant="outline" size="sm" onClick={() => setPdfPage((p) => Math.max(1, p - 1))} disabled={pdfPage <= 1 || pdfRendering}>Anterior</Button>
                <span>Página {pdfPage} de {pdfPages}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPdfPage((p) => Math.min(pdfPages, p + 1))} disabled={pdfPage >= pdfPages || pdfRendering}>Próxima</Button>
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => download(preview.path, preview.fileName)} disabled={!preview.path || preview.loading}>
              <Download className="w-4 h-4 mr-1" />Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}