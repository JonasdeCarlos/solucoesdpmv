import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Scissors, Upload, Download, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PDFDocument } from 'pdf-lib';

const PdfSplitter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || f.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF válido');
      return;
    }
    setFile(f);
    setLoading(true);
    try {
      const buffer = await f.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const pdf = await PDFDocument.load(bytes);
      const count = pdf.getPageCount();
      setPageCount(count);
      setPdfBytes(bytes);
      setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i)));
      toast.success(`PDF carregado: ${count} página(s)`);
    } catch {
      toast.error('Erro ao ler o PDF');
    }
    setLoading(false);
  }, []);

  const togglePage = (idx: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPages.size === pageCount) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
    }
  };

  const handleExtractSelected = async () => {
    if (!pdfBytes || selectedPages.size === 0) {
      toast.error('Selecione ao menos uma página');
      return;
    }
    setLoading(true);
    try {
      const srcPdf = await PDFDocument.load(pdfBytes);
      const newPdf = await PDFDocument.create();
      const sorted = Array.from(selectedPages).sort((a, b) => a - b);
      const pages = await newPdf.copyPages(srcPdf, sorted);
      pages.forEach(p => newPdf.addPage(p));
      const out = await newPdf.save();
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' }), `separado_paginas_${sorted.map(i => i + 1).join('-')}.pdf`);
      toast.success(`PDF gerado com ${sorted.length} página(s)`);
    } catch {
      toast.error('Erro ao gerar PDF');
    }
    setLoading(false);
  };

  const handleExtractEach = async () => {
    if (!pdfBytes || pageCount === 0) return;
    setLoading(true);
    try {
      const srcPdf = await PDFDocument.load(pdfBytes);
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(srcPdf, [i]);
        newPdf.addPage(page);
        const out = await newPdf.save();
        downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' }), `pagina_${i + 1}.pdf`);
      }
      toast.success(`${pageCount} arquivo(s) gerado(s)`);
    } catch {
      toast.error('Erro ao separar páginas');
    }
    setLoading(false);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scissors className="w-5 h-5" />
          Separador de PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Selecionar PDF para separar</Label>
          <Input type="file" accept="application/pdf" onChange={handleFileChange} className="mt-1" />
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {pageCount > 0 && !loading && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <FileText className="w-4 h-4 inline mr-1" />
                {file?.name} — {pageCount} página(s)
              </p>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                {selectedPages.size === pageCount ? 'Desmarcar todas' : 'Selecionar todas'}
              </Button>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded">
              {Array.from({ length: pageCount }, (_, i) => (
                <label
                  key={i}
                  className={`flex flex-col items-center gap-1 p-2 rounded cursor-pointer border text-xs transition-colors ${
                    selectedPages.has(i) ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedPages.has(i)}
                    onCheckedChange={() => togglePage(i)}
                    className="sr-only"
                  />
                  <span className="font-mono font-bold">{i + 1}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleExtractSelected} disabled={selectedPages.size === 0} className="gap-1.5">
                <Download className="w-4 h-4" />
                Extrair selecionadas ({selectedPages.size})
              </Button>
              <Button variant="outline" size="sm" onClick={handleExtractEach} className="gap-1.5">
                <Scissors className="w-4 h-4" />
                Separar todas (1 por arquivo)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PdfSplitter;
