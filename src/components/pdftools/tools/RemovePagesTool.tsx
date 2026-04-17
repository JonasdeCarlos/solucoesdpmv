import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FileDropZone from '../FileDropZone';
import { removePages, parseRanges } from '@/utils/pdfTools';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const RemovePagesTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    if (!pages.trim()) return toast.error('Informe as páginas a remover.');
    setBusy(true);
    try {
      const bytes = await files[0].arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const groups = parseRanges(pages, src.getPageCount());
      const indices = Array.from(new Set(groups.flat()));
      await removePages(files[0], indices);
      toast.success('Páginas removidas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao remover.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Remova páginas específicas e baixe o PDF restante.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />
      <div className="space-y-1.5">
        <Label>Páginas a remover</Label>
        <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Ex.: 2,4-6" />
      </div>
      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Remover páginas
      </Button>
    </div>
  );
};

export default RemovePagesTool;
