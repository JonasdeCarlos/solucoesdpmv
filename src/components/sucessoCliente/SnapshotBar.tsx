import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDPProfile } from '@/hooks/useSucessoCliente';
import type { ClienteDP, DPProfile } from '@/types/sucessoCliente';
import { emptyProfile } from '@/types/sucessoCliente';
import {
  buildSnapshot, toCSV, toJSON, parseCSV, parseJSON,
  diffSnapshot, download, type DiffEntry, type Snapshot,
} from '@/utils/sucessoCliente/snapshot';

export default function SnapshotBar({
  cliente, profile, onRestored,
}: { cliente: ClienteDP; profile: DPProfile | null; onRestored: () => void }) {
  const { upsert } = useDPProfile(cliente.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [incoming, setIncoming] = useState<Snapshot | null>(null);
  const [diff, setDiff] = useState<DiffEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const safeProfile: DPProfile = { ...emptyProfile(cliente.id), ...(profile || {}), client_id: cliente.id };

  const exportSnap = (format: 'json' | 'csv') => {
    const snap = buildSnapshot(cliente, safeProfile);
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `cadastro-${(cliente.nome || 'cliente').replace(/[^\w-]+/g, '_').slice(0, 40)}-${stamp}`;
    if (format === 'json') download(`${base}.json`, toJSON(snap), 'application/json');
    else download(`${base}.csv`, toCSV(snap), 'text/csv;charset=utf-8');
  };

  const onFile = async (f: File) => {
    try {
      const text = await f.text();
      const snap = f.name.toLowerCase().endsWith('.csv') ? parseCSV(text) : parseJSON(text);
      if (snap.cliente.id !== cliente.id) {
        const ok = confirm(
          `Atenção: o snapshot pertence ao cliente ${snap.cliente.id}, diferente do atual (${cliente.id}). ` +
          `Os dados serão IMPORTADOS para o cliente atual mesmo assim. Continuar?`
        );
        if (!ok) return;
        snap.cliente.id = cliente.id;
        snap.profile.client_id = cliente.id;
      }
      setIncoming(snap);
      setDiff(diffSnapshot({ cliente, profile: safeProfile }, snap));
      setOpen(true);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao ler arquivo.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const apply = async () => {
    if (!incoming) return;
    setBusy(true);
    try {
      const c = incoming.cliente;
      const { error: e1 } = await supabase.from('clientes' as any).update({
        nome: c.nome, codigo_cliente: c.codigo_cliente || null, nome_fantasia: c.nome_fantasia,
        cnpj: c.cnpj, cpf: c.cpf, tipo: c.tipo, municipio: c.municipio, uf: c.uf, segmento: c.segmento,
        contato_nome: c.contato_nome, contato_telefone: c.contato_telefone, contato_email: c.contato_email,
        status: c.status, endereco: c.endereco, gestor_carteira: c.gestor_carteira || '',
        tipo_folha: c.tipo_folha || null,
      } as any).eq('id', cliente.id);
      if (e1) throw new Error('Cliente: ' + e1.message);
      const { error: e2 } = await upsert({ ...incoming.profile, client_id: cliente.id });
      if (e2) throw new Error('Perfil: ' + e2.message);
      toast.success('Dados restaurados.');
      setOpen(false); setIncoming(null); setDiff([]);
      onRestored();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao restaurar.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: unknown) =>
    v === null || v === undefined || v === '' ? <span className="text-muted-foreground italic">(vazio)</span>
    : typeof v === 'boolean' ? (v ? 'Sim' : 'Não')
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v);

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center justify-end">
        <span className="text-xs text-muted-foreground mr-auto">Backup do cadastro:</span>
        <Button size="sm" variant="outline" onClick={() => exportSnap('json')}><FileJson className="w-4 h-4 mr-1"/>Exportar JSON</Button>
        <Button size="sm" variant="outline" onClick={() => exportSnap('csv')}><FileSpreadsheet className="w-4 h-4 mr-1"/>Exportar CSV</Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1"/>Importar (prévia)</Button>
        <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}/>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia da importação</DialogTitle>
          </DialogHeader>
          {incoming && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                <div><strong>Origem:</strong> snapshot v{incoming.version} exportado em {new Date(incoming.exported_at).toLocaleString('pt-BR')}</div>
                <div><strong>Cliente no arquivo:</strong> {incoming.cliente.nome} ({incoming.cliente.tipo})</div>
              </div>
              {diff.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma diferença detectada — os dados atuais já correspondem ao snapshot.</div>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>
                    <div className="text-xs">
                      <strong>{diff.length}</strong> campo(s) serão sobrescritos. Revise antes de confirmar — esta ação não pode ser desfeita automaticamente.
                    </div>
                  </div>
                  <div className="max-h-[50vh] overflow-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Campo</th>
                          <th className="text-left p-2">Atual</th>
                          <th className="text-left p-2">Será gravado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((d) => (
                          <tr key={d.field} className="border-t">
                            <td className="p-2 font-mono">{d.field}</td>
                            <td className="p-2">{fmt(d.current)}</td>
                            <td className="p-2 text-primary">{fmt(d.incoming)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={apply} disabled={busy || !incoming || diff.length === 0}>
              <Download className="w-4 h-4 mr-1"/>{busy ? 'Restaurando...' : 'Confirmar e restaurar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}