import { useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import { pdfToWord } from '@/utils/pdfTools';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const PdfToWordTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    setBusy(true);
    try {
      await pdfToWord(files[0]);
      toast.success('Arquivo Word gerado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na conversão.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Extraia o texto do PDF e gere um documento Word editável (.docx).
      </p>
      <FileDropZone files={files} setFiles={setFiles} accept="application/pdf" multiple={false} />
      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Converter para Word
      </Button>
    </div>
  );
};

export default PdfToWordTool;