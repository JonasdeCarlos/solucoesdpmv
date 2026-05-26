import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, FolderOpen, Save, Plus } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';
import {
  HISTORY_KEY,
  type SavedCalculation,
  loadHistory,
} from '@/utils/calcHistory';

interface Props {
  currentId: string | null;
  onLoad: (item: SavedCalculation) => void;
  onNew: () => void;
}

const SavedCalculations = ({ currentId, onLoad, onNew }: Props) => {
  const [items, setItems] = useState<SavedCalculation[]>(() => loadHistory());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) setItems(loadHistory());
    };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(() => setItems(loadHistory()), 1500);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  const handleDelete = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setItems(next);
    toast.success('Cálculo removido do histórico');
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Save className="h-4 w-4" />
          Cálculos salvos ({items.length})
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo cálculo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cálculo salvo. Os cálculos finalizados aparecerão aqui automaticamente.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((item) => {
                  const isCurrent = item.id === currentId;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                        isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.label || 'Sem identificação'}
                          {isCurrent && (
                            <span className="ml-2 text-xs text-primary">(em edição)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total {formatCurrency(item.total)} •{' '}
                          {new Date(item.updatedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onLoad(item)}
                        title="Carregar para edição"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default SavedCalculations;