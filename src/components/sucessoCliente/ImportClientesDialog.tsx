import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { parseExcelFile, buildPreview, applyImport, exportErrorsCsv, downloadTemplate, type ImportPreview } from '@/utils/sucessoCliente/excelImport';
import { toast } from 'sonner';

export default function ImportClientesDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (b: boolean) => void; onDone: () => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const rows = await parseExcelFile(file);
      const p = await buildPreview(rows);
      setPreview(p);
    } catch (e: any) {
      toast.error('Erro ao ler arquivo: ' + e.message);
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!preview) return;
    setLoading(true);
    const res = await applyImport(preview);
    setLoading(false);
    toast.success(`Criados: ${res.created} • Atualizados: ${res.updated} • Erros: ${res.errors}`);
    if (res.errMsgs.length) console.warn('Importação erros:', res.errMsgs);
    setPreview(null);
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPreview(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Excel de Clientes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1"/>Baixar modelo</Button>
            <label className="inline-flex">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <span className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer hover:opacity-90">
                <Upload className="w-4 h-4 mr-1"/>Escolher planilha
              </span>
            </label>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Processando…</p>}
          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Novos</div><div className="text-2xl font-bold">{preview.novos.length}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Atualizar</div><div className="text-2xl font-bold">{preview.atualizar.length}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Conflitos</div><div className="text-2xl font-bold text-amber-600">{preview.conflitos.length}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Erros</div><div className="text-2xl font-bold text-destructive">{preview.erros.length}</div></CardContent></Card>
              </div>
              {preview.erros.length > 0 && (
                <div className="border rounded p-3 bg-destructive/5 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1"><AlertCircle className="w-4 h-4 text-destructive"/>Linhas com erro</span>
                    <Button size="sm" variant="outline" onClick={() => {
                      const blob = exportErrorsCsv(preview.erros);
                      const url = URL.createObjectURL(blob); const a = document.createElement('a');
                      a.href = url; a.download = 'erros-importacao.csv'; a.click(); URL.revokeObjectURL(url);
                    }}><FileSpreadsheet className="w-4 h-4 mr-1"/>Exportar CSV</Button>
                  </div>
                  <ul className="max-h-32 overflow-auto text-xs">
                    {preview.erros.map((e, i) => <li key={i}>• {e.row.razao_social || '(sem nome)'} — {e.erro}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
                <Button onClick={handleApply} disabled={loading}>Aplicar importação</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}