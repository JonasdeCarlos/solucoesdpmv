import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileDropZone from '../FileDropZone';
import { rotatePdf, parseRanges } from '@/utils/pdfTools';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const RotateTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [angle, setAngle] = useState<'90' | '180' | '270'>('90');
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    setBusy(true);
    try {
      let indices: number[] | undefined;
      if (pages.trim()) {
        const bytes = await files[0].arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const groups = parseRanges(pages, src.getPageCount());
        indices = Array.from(new Set(groups.flat()));
      }
      await rotatePdf(files[0], parseInt(angle, 10) as 90 | 180 | 270, indices);
      toast.success('Rotação aplicada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao rotacionar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gire páginas em 90°, 180° ou 270°. Deixe o campo de páginas vazio para girar todas.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ângulo</Label>
          <Select value={angle} onValueChange={(v) => setAngle(v as '90' | '180' | '270')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="90">90° horário</SelectItem>
              <SelectItem value="180">180°</SelectItem>
              <SelectItem value="270">270° (90° anti-horário)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Páginas (opcional)</Label>
          <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Ex.: 1-3,5" />
        </div>
      </div>

      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Rotacionar
      </Button>
    </div>
  );
};

export default RotateTool;
