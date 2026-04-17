import { useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import { pdfToImages } from '@/utils/pdfTools';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const PdfToImagesTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    setBusy(true);
    try {
      await pdfToImages(files[0]);
      toast.success('Imagens geradas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na conversão.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Converta cada página do PDF em uma imagem JPG (alta qualidade).
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />
      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Converter para imagens
      </Button>
    </div>
  );
};

export default PdfToImagesTool;
