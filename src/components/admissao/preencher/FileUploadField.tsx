import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, FileIcon, Loader2 } from 'lucide-react';
import { FormField } from '@/utils/admissao/formSchema';
import type { AdmissionFileRow } from '@/utils/admissao/dossieBuilder';
import { toast } from 'sonner';

interface Props {
  field: FormField;
  files: AdmissionFileRow[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string, path: string) => Promise<void>;
  disabled?: boolean;
  error?: string;
}

const FileUploadField = ({ field, files, onUpload, onDelete, disabled, error }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const accept = (field.accept || ['pdf', 'jpg', 'png', 'heic', 'webp'])
    .map((e) => `.${e}`)
    .join(',');
  const maxMb = field.max_size_mb ?? 20;

  const handle = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > maxMb * 1024 * 1024) {
          toast.error(`${f.name} excede ${maxMb}MB`);
          continue;
        }
        await onUpload(f);
      }
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="font-medium">
        {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <div className="border-2 border-dashed rounded-lg p-4 text-center">
        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple={!!field.multiple}
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => handle(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ref.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Enviar arquivo
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Aceita: {(field.accept || []).join(', ').toUpperCase()} — máx {maxMb}MB
        </p>
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded text-sm">
              <FileIcon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate">{f.original_name}</span>
              {!disabled && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(f.id, f.storage_path)} className="h-7 w-7 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default FileUploadField;