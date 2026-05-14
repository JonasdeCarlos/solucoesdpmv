import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processarImportacao, type ParsedPdf } from '@/utils/avisos/importer';
import { useAvisoImports } from '@/hooks/useAvisoImports';
import { useOperatorName } from '@/hooks/useOperatorName';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const sha256File = async (file: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const safeStorageName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'arquivo.pdf';

const AvisosImportPage = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [logOpen, setLogOpen] = useState<any | null>(null);
  const [reportOpen, setReportOpen] = useState<null | { fileName: string; totalEmpresas: number; totalRows: number; novos: number; ignorados: number }>(null);
  const { imports, refresh } = useAvisoImports();
  const { ensure } = useOperatorName();
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    if (!file) return;
    const operator = ensure() || 'desconhecido';
    setBusy(true);
    try {
      setStage('Verificando arquivo...');
      const fileHash = await sha256File(file);
      const legacyFileHash = `name-size:${file.name}|${file.size}`;
      const { data: existingImport } = await supabase
        .from('aviso_imports' as any)
        .select('id,total_empresas,total_rows,novos,ignorados')
        .in('file_hash', [fileHash, legacyFileHash])
        .maybeSingle();
      if (existingImport) {
        const imp = existingImport as any;
        setReportOpen({
          fileName: file.name,
          totalEmpresas: imp.total_empresas ?? 0,
          totalRows: imp.total_rows ?? 0,
          novos: 0,
          ignorados: imp.total_rows ?? imp.ignorados ?? 0,
        });
        toast.info('Este mesmo PDF já foi importado; nenhum aviso novo foi gerado.');
        return;
      }

      setStage('Enviando PDF...');
      const path = `${Date.now()}-${safeStorageName(file.name)}`;
      const { error: upErr } = await supabase.storage.from('aviso-pdfs').upload(path, file, { contentType: 'application/pdf' });
      if (upErr) throw upErr;

      setStage('Extraindo dados com IA...');
      const { data, error } = await supabase.functions.invoke('parse-aviso-pdf', { body: { file_path: path } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const parsed = data as ParsedPdf;

      setStage('Processando avisos (dedupe)...');
      const summary = await processarImportacao({ parsed, fileName: file.name, filePath: path, importedBy: operator, fileHash });

      setReportOpen({
        fileName: file.name,
        totalEmpresas: summary.totalEmpresas,
        totalRows: summary.totalRows,
        novos: summary.novos,
        ignorados: summary.ignorados,
      });
      toast.success(`Importação concluída: ${summary.novos} novos, ${summary.ignorados} já existentes.`);
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error('Falha na importação: ' + (e?.message || 'erro'));
    } finally {
      setBusy(false);
      setStage('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar PDF de Avisos</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie diariamente o PDF "Relação de Vencimentos". Avisos repetidos são ignorados automaticamente.</p>
      </div>

      <Card className="p-6">
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <Button onClick={() => inputRef.current?.click()} disabled={busy} size="lg">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {busy ? stage : 'Enviar PDF'}
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Histórico de importações</h2>
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>
        ) : (
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="border rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                <div className="md:col-span-2">
                  <div className="font-medium truncate">{imp.file_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(imp.imported_at).toLocaleString('pt-BR')}</div>
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Empresas:</span> <b>{imp.total_empresas}</b></div>
                <div className="text-xs"><span className="text-muted-foreground">Linhas:</span> <b>{imp.total_rows}</b></div>
                <div className="text-xs text-green-700"><span className="text-muted-foreground">Novos:</span> <b>{imp.novos}</b></div>
                <div className="text-xs text-amber-700"><span className="text-muted-foreground">Já existentes:</span> <b>{imp.ignorados}</b></div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => setReportOpen({
                    fileName: imp.file_name,
                    totalEmpresas: imp.total_empresas,
                    totalRows: imp.total_rows,
                    novos: imp.novos,
                    ignorados: imp.ignorados,
                  })}>
                    <BarChart3 className="w-3 h-3 mr-1" /> Relatório
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLogOpen(imp)}>
                    <AlertCircle className="w-3 h-3 mr-1" /> Log
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!logOpen} onOpenChange={(o) => !o && setLogOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Log de importação — {logOpen?.file_name}</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded max-h-[400px] overflow-auto">
            {JSON.stringify(logOpen?.errors_json || [], null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportOpen} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório de importação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground truncate">Arquivo: <b className="text-foreground">{reportOpen?.fileName}</b></p>
            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Empresas</div>
                <div className="text-2xl font-bold">{reportOpen?.totalEmpresas ?? 0}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Linhas no PDF</div>
                <div className="text-2xl font-bold">{reportOpen?.totalRows ?? 0}</div>
              </div>
              <div className="border rounded-lg p-3 bg-green-500/5 border-green-500/30">
                <div className="text-xs text-green-700">Novos avisos gerados</div>
                <div className="text-2xl font-bold text-green-700">{reportOpen?.novos ?? 0}</div>
              </div>
              <div className="border rounded-lg p-3 bg-amber-500/5 border-amber-500/30">
                <div className="text-xs text-amber-700">Já existentes (ignorados)</div>
                <div className="text-2xl font-bold text-amber-700">{reportOpen?.ignorados ?? 0}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReportOpen(null)}>Fechar</Button>
              {(reportOpen?.novos ?? 0) > 0 && (
                <Button onClick={() => { setReportOpen(null); navigate('/avisos'); }}>Ver avisos</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvisosImportPage;
