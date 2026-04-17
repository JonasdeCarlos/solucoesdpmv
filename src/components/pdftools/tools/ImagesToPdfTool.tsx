import { useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import { imagesToPdf } from '@/utils/pdfTools';
import { toast } from 'sonner';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';

const ImagesToPdfTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  };

  const run = async () => {
    if (files.length === 0) return toast.error('Selecione imagens.');
    setBusy(true);
    try {
      await imagesToPdf(files);
      toast.success('PDF gerado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao converter.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Converta JPG ou PNG em um único PDF. Cada imagem vira uma página.
      </p>
      <FileDropZone
        files={files}
        setFiles={setFiles}
        accept="image/jpeg,image/png"
        multiple
        label="Arraste imagens (JPG/PNG)"
      />
      {files.length > 1 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded text-sm">
              <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
              <span className="flex-1 truncate">{f.name}</span>
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} className="h-7 w-7 p-0">
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="h-7 w-7 p-0">
                <ArrowDown className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button onClick={run} disabled={busy || files.length === 0} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Gerar PDF
      </Button>
    </div>
  );
};

export default ImagesToPdfTool;
