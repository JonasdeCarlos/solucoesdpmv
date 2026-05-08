import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Archive, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface ArchiveRow {
  id: string;
  employee_name: string;
  company_name: string;
  company_cnpj: string;
  template_name: string;
  previous_status: string;
  original_created_at: string | null;
  admission_completed: boolean;
  responsible_name: string;
  archived_at: string;
}

const ArquivoPage = () => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [delId, setDelId] = useState<string | null>(null);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_archive' as any)
      .select('*')
      .order('archived_at', { ascending: false });
    if (!error && data) setRows(data as any[] as ArchiveRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.employee_name.toLowerCase().includes(s) ||
      r.company_name.toLowerCase().includes(s) ||
      r.responsible_name.toLowerCase().includes(s) ||
      r.template_name.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const confirmDelete = async () => {
    if (!delId) return;
    if (!pwd) return toast.error('Informe a senha do proprietário');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('verify-owner', { body: { password: pwd } });
    if (error || !data?.ok) {
      setBusy(false);
      return toast.error('Senha do proprietário inválida');
    }
    const { error: delErr } = await supabase
      .from('admission_archive' as any)
      .delete()
      .eq('id', delId);
    setBusy(false);
    if (delErr) return toast.error('Erro ao excluir do arquivo');
    toast.success('Registro excluído do arquivo');
    setDelId(null);
    setPwd('');
    await fetchAll();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Archive className="w-6 h-6" /> Arquivo de Admissões
        </h2>
        <p className="text-sm text-muted-foreground">
          Histórico de admissões excluídas. Apenas o proprietário pode remover registros deste arquivo.
        </p>
      </div>

      <Input placeholder="Buscar por colaborador, empresa ou responsável..." value={q} onChange={(e) => setQ(e.target.value)} />

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <Archive className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum registro arquivado.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map((r) => (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">
                  {(r.company_name || '—')} · {(r.employee_name || '(sem nome)')}
                </h3>
                <Badge variant={r.admission_completed ? 'default' : 'secondary'}>
                  {r.admission_completed ? 'Admissão concluída' : 'Não concluída'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Formulário: {r.template_name || '—'} · Status anterior: {r.previous_status || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Responsável: <strong>{r.responsible_name || '—'}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Arquivado em {new Date(r.archived_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setDelId(r.id); setPwd(''); }}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) { setDelId(null); setPwd(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir do arquivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é permanente e exige a senha do proprietário do app.
          </p>
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="owner-pwd">Senha do proprietário</Label>
            <Input
              id="owner-pwd"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDelete(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDelId(null); setPwd(''); }} disabled={busy}>Cancelar</Button>
            <Button onClick={confirmDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? 'Validando...' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArquivoPage;