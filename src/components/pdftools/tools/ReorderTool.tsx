import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import { reorderPdf } from '@/utils/pdfTools';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

const ReorderTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (files.length === 0) return setOrder([]);
      try {
        const bytes = await files[0].arrayBuffer();
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setOrder(pdf.getPageIndices());
      } catch {
        toast.error('Não foi possível ler o PDF.');
        setOrder([]);
      }
    })();
  }, [files]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione um PDF.');
    setBusy(true);
    try {
      await reorderPdf(files[0], order);
      toast.success('PDF reordenado gerado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao reordenar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reorganize a sequência de páginas. Use as setas para mover cada página.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />

      {order.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto border rounded-md p-2">
          {order.map((origIdx, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded text-sm">
              <span className="text-xs text-muted-foreground w-12">Pos {i + 1}</span>
              <span className="flex-1">Página original {origIdx + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} className="h-7 w-7 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="h-7 w-7 p-0">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={run} disabled={busy || order.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Gerar PDF reordenado
      </Button>
    </div>
  );
};

export default ReorderTool;
