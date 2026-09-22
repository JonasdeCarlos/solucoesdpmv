import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export type EmpresaOpcao = { key: string; label: string; default?: boolean };

export default function SelecionarEmpresaDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirmar',
  excludeIds = [], options = [], onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  excludeIds?: string[];
  options?: EmpresaOpcao[];
  onConfirm: (clientId: string, opts: Record<string, boolean>) => Promise<void> | void;
}) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [opts, setOpts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setSelected(''); setQ('');
    setOpts(Object.fromEntries(options.map(o => [o.key, o.default !== false])));
    setLoading(true);
    supabase.from('clientes' as any).select('id,nome,cnpj').order('nome').then(({ data }) => {
      setClientes((data as any[]) || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clientes
      .filter(c => !excludeIds.includes(c.id))
      .filter(c => !term || String(c.nome || '').toLowerCase().includes(term) || String(c.cnpj || '').includes(term));
  }, [clientes, q, excludeIds]);

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onConfirm(selected, opts);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Buscar empresa</Label>
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Nome ou CNPJ"/>
          </div>
          <div className="max-h-64 overflow-auto border rounded-md divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Carregando…</div>
            ) : list.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
            ) : list.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={()=>setSelected(c.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selected === c.id ? 'bg-primary/10 font-medium' : ''}`}
              >
                {c.nome}
                {c.cnpj && <span className="text-xs text-muted-foreground ml-2">{c.cnpj}</span>}
              </button>
            ))}
          </div>
          {options.length > 0 && (
            <div className="space-y-2">
              {options.map(o => (
                <label key={o.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!opts[o.key]} onCheckedChange={(v)=>setOpts(s => ({ ...s, [o.key]: !!v }))}/>
                  {o.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!selected || busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}{confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
