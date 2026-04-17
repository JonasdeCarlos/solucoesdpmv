import { useRef, useState, DragEvent } from 'react';
import { Upload, X, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_FILE_SIZE, validateFileSize } from '@/utils/pdfTools';
import { toast } from 'sonner';

interface Props {
  files: File[];
  setFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const FileDropZone = ({
  files,
  setFiles,
  accept = 'application/pdf',
  multiple = true,
  label = 'Arraste arquivos aqui ou clique para selecionar',
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleAdd = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    for (const f of Array.from(incoming)) {
      const err = validateFileSize(f);
      if (err) {
        toast.error(err);
        continue;
      }
      valid.push(f);
    }
    if (multiple) {
      setFiles([...files, ...valid]);
    } else {
      setFiles(valid.slice(0, 1));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleAdd(e.dataTransfer.files);
  };

  const removeAt = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Limite: {(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB por arquivo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleAdd(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-sm">
              <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
              <Button variant="ghost" size="sm" onClick={() => removeAt(i)} className="h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
