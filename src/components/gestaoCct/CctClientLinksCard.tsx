import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Users, UserPlus, Link2Off, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClientes } from '@/hooks/useClientes';
import { useCctClientLinks } from '@/hooks/cct/useCctClientLinks';

export function CctClientLinksCard({ analysis }: { analysis: any }) {
  const { links, loading, linkClients, unlink } = useCctClientLinks(analysis?.id);
  const { clientes } = useClientes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'keep' | 'archive'>('archive');
  const [saving, setSaving] = useState(false);

  const activeLinks = links.filter((l) => l.status === 'ativo');
  const removedLinks = links.filter((l) => l.status !== 'ativo');

  const alreadyLinkedIds = useMemo(() => new Set(activeLinks.map((l) => l.client_id)), [activeLinks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientes.filter((c) => {
      if (alreadyLinkedIds.has(c.id)) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.cnpj || '').toLowerCase().includes(q) ||
        (c.cpf || '').toLowerCase().includes(q)
      );
    });
  }, [clientes, query, alreadyLinkedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const confirmLink = async () => {
    if (selected.size === 0) { toast.error('Selecione ao menos um cliente.'); return; }
    setSaving(true);
    try {
      await linkClients(Array.from(selected), analysis, mode);
      toast.success(`${selected.size} cliente(s) vinculado(s).`);
      setSelected(new Set());
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao vincular.');
    } finally {
      setSaving(false);
    }
  };

  const doUnlink = async (link: any) => {
    if (!confirm(`Desvincular ${link.client_name}?`)) return;
    try {
      await unlink(link);
      toast.success('Cliente desvinculado.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao desvincular.');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4"/>Clientes vinculados ({activeLinks.length})</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="w-4 h-4 mr-1"/>Vincular clientes</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : activeLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente vinculado ainda.</p>
        ) : (
          <div className="space-y-2">
            {activeLinks.map((l) => (
              <div key={l.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{l.client_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.client_cnpj} · vinculado em {new Date(l.linked_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <Badge variant="secondary">Ativo</Badge>
                <Button size="sm" variant="ghost" onClick={() => doUnlink(l)}><Link2Off className="w-4 h-4"/></Button>
              </div>
            ))}
          </div>
        )}

        {removedLinks.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer">Histórico ({removedLinks.length})</summary>
            <div className="space-y-1 mt-2">
              {removedLinks.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-muted-foreground border rounded p-2">
                  <span className="flex-1 truncate">{l.client_name}</span>
                  <Badge variant="outline">{l.status}</Badge>
                  <span>{l.unlinked_at ? new Date(l.unlinked_at).toLocaleDateString('pt-BR') : ''}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular clientes a esta CCT</DialogTitle>
            <DialogDescription>Selecione os clientes que serão atendidos por esta convenção. Clientes já vinculados a esta CCT não aparecem na lista.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, CNPJ ou CPF…" className="pl-8"/>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{filtered.length} cliente(s) — {selected.size} selecionado(s)</span>
              <Button size="sm" variant="ghost" onClick={toggleAll}>
                {selected.size === filtered.length && filtered.length > 0 ? 'Limpar seleção' : 'Selecionar todos filtrados'}
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto border rounded divide-y">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Nenhum cliente disponível.</p>
              ) : filtered.map((c) => (
                <label key={c.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.tipo === 'PJ' ? c.cnpj : c.cpf}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm">Se o cliente já tem outra CCT ativa:</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
                <div className="flex items-center gap-2"><RadioGroupItem value="archive" id="m-arch"/><Label htmlFor="m-arch" className="text-sm font-normal">Arquivar a anterior (recomendado)</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="keep" id="m-keep"/><Label htmlFor="m-keep" className="text-sm font-normal">Manter ambas ativas</Label></div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmLink} disabled={saving || selected.size === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <UserPlus className="w-4 h-4 mr-1"/>}
              Vincular {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}