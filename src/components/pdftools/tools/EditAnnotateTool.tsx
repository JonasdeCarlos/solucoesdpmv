import { useState } from 'react';
import { Button } from '@/components/ui/button';
import FileDropZone from '../FileDropZone';
import PdfAnnotationEditor from '../editor/PdfAnnotationEditor';
import { loadSessions, deleteSession } from '@/utils/pdfEditor/history';
import { Trash2, Clock } from 'lucide-react';

const EditAnnotateTool = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [active, setActive] = useState(false);
  const [initialSessionId, setInitialSessionId] = useState<string | null>(null);
  const sessions = loadSessions().slice().reverse();
  const [, force] = useState(0);

  if (active && files[0]) {
    const initial = initialSessionId
      ? loadSessions().find((s) => s.id === initialSessionId)
      : undefined;
    return (
      <PdfAnnotationEditor
        file={files[0]}
        initialSession={initial}
        onExit={() => { setActive(false); setInitialSessionId(null); force((n) => n + 1); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Adicione comentários, destaque textos, insira setas, marcações e observações
        em documentos PDF. O arquivo original nunca é sobrescrito — o editor gera
        sempre uma nova versão.
      </p>
      <FileDropZone files={files} setFiles={setFiles} multiple={false} />
      <Button onClick={() => setActive(true)} disabled={files.length === 0} className="w-full">
        Abrir editor
      </Button>

      {sessions.length > 0 && (
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4" /> Histórico de edições
          </div>
          <div className="text-xs text-muted-foreground -mt-1">
            Para continuar uma sessão, selecione o PDF original acima e clique em "Continuar" na versão desejada.
          </div>
          <div className="space-y-1">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 border rounded p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{s.originalName}</div>
                  <div className="text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleString('pt-BR')} · {s.annotations.length} anotações · {s.versions.length} versões
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={files.length === 0}
                  onClick={() => { setInitialSessionId(s.id); setActive(true); }}>
                  Continuar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => { deleteSession(s.id); force((n) => n + 1); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditAnnotateTool;