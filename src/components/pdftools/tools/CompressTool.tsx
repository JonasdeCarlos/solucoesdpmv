import { useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import { compressPdf } from '@/utils/pdfTools';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const CompressTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    setBusy(true);
    try {
      for (const f of files) await compressPdf(f);
      toast.success('Compactação concluída.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao compactar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reduz o tamanho do PDF reotimizando streams. Para imagens muito grandes, a redução pode ser modesta.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple />
      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Compactar
      </Button>
    </div>
  );
};

export default CompressTool;
