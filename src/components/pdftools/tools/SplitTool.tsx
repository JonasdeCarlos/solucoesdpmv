import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FileDropZone from '../FileDropZone';
import { splitPdf } from '@/utils/pdfTools';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const SplitTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [ranges, setRanges] = useState('1-3,5');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    if (!ranges.trim()) return toast.error('Informe ao menos um intervalo.');
    setBusy(true);
    try {
      await splitPdf(files[0], ranges);
      toast.success('Divisão concluída.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao dividir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Extraia páginas específicas em um ou mais novos PDFs. Use vírgula para múltiplas saídas.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />

      <div className="space-y-1.5">
        <Label>Intervalos de páginas</Label>
        <Input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="Ex.: 1-3,5,7-9" />
        <p className="text-xs text-muted-foreground">
          Cada item separado por vírgula gera um PDF. Ex.: <code>1-3,5</code> → dois PDFs.
        </p>
      </div>

      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Dividir
      </Button>
    </div>
  );
};

export default SplitTool;
