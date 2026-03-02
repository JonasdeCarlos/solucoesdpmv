import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, Upload, FileText, AlertTriangle, CheckCircle, X, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { type PontoDia, type PontoConfig } from '@/types/ponto';

interface OcrRegistro {
  dia: number;
  marcacoes: string[];
  observacao?: string;
}

interface OcrResult {
  empregado_nome: string | null;
  mes_ano: string | null;
  registros: OcrRegistro[];
  confianca: 'alta' | 'media' | 'baixa';
  observacoes_gerais: string;
}

interface Props {
  config: PontoConfig;
  dias: PontoDia[];
  mesAno: string;
  onImportDias: (dias: PontoDia[]) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];

const PontoOcrImport: React.FC<Props> = ({ config, dias, mesAno, onImportDias }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editableRegistros, setEditableRegistros] = useState<OcrRegistro[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(selectedFiles).forEach(file => {
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
        toast({ title: 'Formato não suportado', description: `${file.name}: use JPG, PNG, HEIC ou PDF.`, variant: 'destructive' });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Arquivo muito grande', description: `${file.name}: máximo 10MB.`, variant: 'destructive' });
        return;
      }
      validFiles.push(file);
      if (file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic')) {
        const url = URL.createObjectURL(file);
        newPreviews.push(url);
      } else {
        newPreviews.push('');
      }
    });

    setFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      if (prev[idx]) URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      // Convert files to data URLs
      setProgress(20);
      const images = await Promise.all(
        files.map(async (file) => ({
          dataUrl: await fileToDataUrl(file),
          name: file.name,
        }))
      );
      setProgress(40);

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('ocr-ponto', {
        body: { images },
      });

      setProgress(80);

      if (error) {
        throw new Error(error.message || 'Erro ao processar OCR');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as OcrResult;
      setOcrResult(result);
      setEditableRegistros(result.registros || []);
      setProgress(100);

      // Save audit record
      await supabase.from('ponto_ocr_audit' as any).insert({
        arquivo_nome: files.map(f => f.name).join(', '),
        mes_ano: mesAno,
        resultado_ocr: result,
        status: 'extraido',
      } as any);

      // Switch to review dialog
      setShowUpload(false);
      setShowReview(true);

      toast({
        title: 'Extração concluída!',
        description: `${result.registros.length} dias extraídos. Confiança: ${result.confianca}. Revise antes de confirmar.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro no OCR', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [files, mesAno]);

  const handleMarkChange = useCallback((regIdx: number, markIdx: number, value: string) => {
    setEditableRegistros(prev => {
      const next = [...prev];
      const reg = { ...next[regIdx], marcacoes: [...next[regIdx].marcacoes] };
      reg.marcacoes[markIdx] = value;
      next[regIdx] = reg;
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    // Merge OCR data into existing dias
    const updatedDias = dias.map(d => {
      const reg = editableRegistros.find(r => r.dia === d.dia);
      if (!reg || reg.marcacoes.length === 0) return d;

      // Pad or trim marcacoes to match config
      const marcacoes = Array(config.colunasMarcacoes).fill('');
      reg.marcacoes.forEach((m, i) => {
        if (i < config.colunasMarcacoes && m !== '??:??') {
          marcacoes[i] = m;
        }
      });

      return { ...d, marcacoes, observacao: reg.observacao || d.observacao };
    });

    onImportDias(updatedDias);

    // Update audit
    supabase.from('ponto_ocr_audit' as any)
      .update({ status: 'confirmado', alteracoes_manuais: editableRegistros } as any)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(() => {});

    setShowReview(false);
    setFiles([]);
    setPreviews([]);
    setOcrResult(null);
    setEditableRegistros([]);

    toast({ title: 'Marcações importadas!', description: 'Os horários do cartão de ponto foram preenchidos na grade.' });
  }, [dias, editableRegistros, config.colunasMarcacoes, onImportDias]);

  const confiancaColor = (c: string) => {
    if (c === 'alta') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (c === 'media') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-dashed border-primary text-primary hover:bg-primary/10"
        onClick={() => setShowUpload(true)}
      >
        <Camera className="w-4 h-4" />
        Importar Cartão Manual (Foto/PDF)
      </Button>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Cartão de Ponto
            </DialogTitle>
            <DialogDescription>
              Envie a foto ou PDF do cartão de ponto manuscrito. O sistema extrairá as marcações automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,.pdf"
              multiple
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />
            <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste arquivos aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC ou PDF • Máximo 10MB cada</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  {previews[i] ? (
                    <img src={previews[i]} className="w-10 h-10 object-cover rounded" alt="" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progress < 40 ? 'Preparando imagens...' : progress < 80 ? 'Analisando cartão de ponto com IA...' : 'Finalizando extração...'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button onClick={handleProcess} disabled={files.length === 0 || isProcessing}>
              {isProcessing ? 'Processando...' : 'Extrair Marcações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Revisão das Marcações Extraídas
            </DialogTitle>
            <DialogDescription>
              Confira e corrija os horários antes de importar para a grade de apuração.
            </DialogDescription>
          </DialogHeader>

          {ocrResult && (
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={confiancaColor(ocrResult.confianca)}>
                Confiança: {ocrResult.confianca}
              </Badge>
              {ocrResult.empregado_nome && (
                <Badge variant="outline">Empregado: {ocrResult.empregado_nome}</Badge>
              )}
              {ocrResult.mes_ano && (
                <Badge variant="outline">Período: {ocrResult.mes_ano}</Badge>
              )}
              {ocrResult.observacoes_gerais && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {ocrResult.observacoes_gerais}
                </Badge>
              )}
            </div>
          )}

          <div className="overflow-auto flex-1 border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b sticky top-0">
                  <th className="px-2 py-2 text-left font-medium w-12">Dia</th>
                  <th className="px-2 py-2 text-center font-medium">Entrada</th>
                  <th className="px-2 py-2 text-center font-medium">Saída Int.</th>
                  <th className="px-2 py-2 text-center font-medium">Entrada Int.</th>
                  <th className="px-2 py-2 text-center font-medium">Saída</th>
                  {config.colunasMarcacoes === 6 && (
                    <>
                      <th className="px-2 py-2 text-center font-medium">Ent. Int.2</th>
                      <th className="px-2 py-2 text-center font-medium">Saída 2</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {editableRegistros.map((reg, regIdx) => {
                  const hasIlegivel = reg.marcacoes.some(m => m === '??:??');
                  const isEmpty = reg.marcacoes.length === 0 || reg.marcacoes.every(m => !m);
                  return (
                    <tr key={reg.dia} className={`border-b ${hasIlegivel ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                      <td className="px-2 py-1 font-medium">{String(reg.dia).padStart(2, '0')}</td>
                      {Array(config.colunasMarcacoes).fill('').map((_, mIdx) => (
                        <td key={mIdx} className="px-1 py-1">
                          <Input
                            value={reg.marcacoes[mIdx] || ''}
                            onChange={e => handleMarkChange(regIdx, mIdx, e.target.value)}
                            className={`w-16 text-center font-mono text-xs h-7 px-1 ${
                              reg.marcacoes[mIdx] === '??:??' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''
                            }`}
                            placeholder="--:--"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        {isEmpty ? (
                          <span className="text-muted-foreground text-[10px]">Sem marcação</span>
                        ) : hasIlegivel ? (
                          <span className="flex items-center gap-1 text-yellow-600 text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> Ilegível
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 text-[10px]">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              ⚠️ Revise todos os horários antes de confirmar. Dados ilegíveis estão marcados em amarelo.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowReview(false)}>Cancelar</Button>
              <Button onClick={handleConfirm} className="gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Confirmar e Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PontoOcrImport;
