import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Eye, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { gerarCapaRescisao, imageToPdfArrayBuffer } from '@/utils/rescisaoPdfGenerator';
import type { UploadedFile } from '@/types/rescisaoDossier';
import type { RescisaoTipoId } from '@/utils/rescisaoTipos';

// pdf-lib for merging
async function loadPdfLib() {
  const mod = await import('pdf-lib');
  return mod;
}

interface CapaData {
  employeeName: string;
  terminationDate: string;
  paymentDateSuggested: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
  rescisaoTipo: RescisaoTipoId;
}

interface Props {
  capaData: CapaData;
  files: UploadedFile[];
  onBack: () => void;
  onFinish: (pdfBlob: Blob, fileName: string) => void;
}

const RescisaoStep3Generate: React.FC<Props> = ({ capaData, files, onBack, onFinish }) => {
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileName = `RESCISÃO - ${capaData.employeeName.toUpperCase()} - ${capaData.terminationDate.replace(/-/g, '')}`;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewImages.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrl, previewImages]);

  const renderPdfPreview = async (blob: Blob): Promise<string[]> => {
    const pdfjs: any = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const bytes = await blob.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const imageUrls: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Não foi possível renderizar a pré-visualização do PDF.');
      }

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const pageBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('Falha ao converter página da pré-visualização.'));
        }, 'image/jpeg', 0.92);
      });

      imageUrls.push(URL.createObjectURL(pageBlob));
    }

    return imageUrls;
  };

  const generatePdf = async () => {
    setGenerating(true);
    setError(null);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewImages.forEach((url) => URL.revokeObjectURL(url));
      setPreviewImages([]);
      setPreviewUrl(null);

      const { PDFDocument } = await loadPdfLib();
      const merged = await PDFDocument.create();

      // 1. Generate cover
      const capaDoc = await gerarCapaRescisao({
        ...capaData,
        uploadedDocs: files.map(f => ({ categoria: f.category, nome: f.name })),
      });
      const capaBytes = capaDoc.output('arraybuffer');
      const capaPdf = await PDFDocument.load(capaBytes);
      const capaPages = await merged.copyPages(capaPdf, capaPdf.getPageIndices());
      capaPages.forEach(p => merged.addPage(p));

      // 2. Process each uploaded file
      for (const uf of files) {
        try {
          let pdfBytes: ArrayBuffer;
          if (uf.file.type === 'application/pdf') {
            pdfBytes = await uf.file.arrayBuffer();
          } else {
            // Image -> PDF
            pdfBytes = await imageToPdfArrayBuffer(uf.file);
          }
          const sourcePdf = await PDFDocument.load(pdfBytes);
          const pages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } catch (e) {
          console.warn(`Erro ao processar ${uf.name}:`, e);
        }
      }

      const finalBytes = await merged.save();
      const blob = new Blob([new Uint8Array(finalBytes)], { type: 'application/pdf' });
      setFinalBlob(blob);

      // Preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      const renderedPages = await renderPdfPreview(blob);
      setPreviewImages(renderedPages);
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar PDF');
    }
    setGenerating(false);
  };

  const download = () => {
    if (!finalBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(finalBlob);
    a.download = `${fileName}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFinish = () => {
    if (finalBlob) onFinish(finalBlob, `${fileName}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="font-medium">Empregado:</span> {capaData.employeeName}</div>
        <div><span className="font-medium">Data Rescisão:</span> {capaData.terminationDate && format(new Date(capaData.terminationDate + 'T12:00:00'), 'dd/MM/yyyy')}</div>
        <div><span className="font-medium">Data Pagamento:</span> {capaData.paymentDateFinal && format(new Date(capaData.paymentDateFinal + 'T12:00:00'), 'dd/MM/yyyy')}</div>
        <div><span className="font-medium">Documentos:</span> {files.length} arquivo(s)</div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <p className="text-sm font-medium">Ordem dos documentos no PDF final:</p>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
          <li className="font-medium text-foreground">Capa (gerada automaticamente)</li>
          {files.map((f, i) => (
            <li key={f.id}>{f.category} — {f.name}</li>
          ))}
        </ol>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {(previewImages.length > 0 || previewUrl) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pré-visualização:</p>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
              <ExternalLink className="h-3 w-3 mr-1" /> Abrir em nova aba
            </Button>
          </div>
          <div className="border rounded-md bg-muted/20 p-3 overflow-y-auto space-y-4" style={{ height: 500 }}>
            {previewImages.length > 0 ? previewImages.map((imageUrl, index) => (
              <div key={imageUrl} className="bg-background border rounded-sm shadow-sm overflow-hidden">
                <img
                  src={imageUrl}
                  alt={`Página ${index + 1} do PDF de rescisão`}
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
            )) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                A pré-visualização está disponível pela nova aba.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-2">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <div className="flex gap-2">
          {!finalBlob ? (
            <Button onClick={generatePdf} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              Gerar e Pré-visualizar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={download}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              <Button onClick={handleFinish}>
                <CheckCircle className="h-4 w-4 mr-1" /> Salvar Dossiê
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RescisaoStep3Generate;
