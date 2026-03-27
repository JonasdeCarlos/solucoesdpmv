import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Trash2, GripVertical, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { DOC_CATEGORIES, ESSENTIAL_DOCS, type UploadedFile, type DocCategory } from '@/types/rescisaoDossier';

interface Props {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const RescisaoStep2Upload: React.FC<Props> = ({ files, onChange, onNext, onBack }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((f, i) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      category: 'Outros' as DocCategory,
      sortOrder: files.length + i,
    }));
    onChange([...files, ...newFiles]);
  }, [files, onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const remove = (id: string) => onChange(files.filter(f => f.id !== id));

  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...files];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr.map((f, i) => ({ ...f, sortOrder: i })));
  };

  const setCategory = (id: string, cat: DocCategory) => {
    onChange(files.map(f => f.id === id ? { ...f, category: cat } : f));
  };

  const missingEssentials = ESSENTIAL_DOCS.filter(
    doc => !files.some(f => f.category === doc)
  );

  const accepted = '.pdf,.jpg,.jpeg,.png,.heic';

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, HEIC</p>
        <input
          ref={inputRef}
          type="file"
          accept={accepted}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label>Documentos ({files.length})</Label>
          {files.map((f, idx) => (
            <div key={f.id} className="flex items-center gap-2 p-2 border rounded-md bg-card">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-accent rounded disabled:opacity-30">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === files.length - 1} className="p-0.5 hover:bg-accent rounded disabled:opacity-30">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground w-6 text-center">{idx + 1}</span>
              <span className="text-sm truncate flex-1 min-w-0">{f.name}</span>
              <Select value={f.category} onValueChange={(v) => setCategory(f.id, v as DocCategory)}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Missing docs warning */}
      {missingEssentials.length > 0 && files.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Documentos essenciais não identificados:</strong>
            <ul className="list-disc ml-4 mt-1">
              {missingEssentials.map(d => <li key={d}>{d}</li>)}
            </ul>
            Classifique os documentos acima ou adicione os faltantes.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext} disabled={files.length === 0}>
          Próximo: Gerar PDF Final
        </Button>
      </div>
    </div>
  );
};

export default RescisaoStep2Upload;
