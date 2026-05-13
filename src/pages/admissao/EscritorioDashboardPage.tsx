import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Copy as CopyIcon, FileText, Trash2, AlertCircle } from 'lucide-react';
import { useAdmissaoRequests, STATUS_LABELS, AdmissionStatus, AdmissionRequest } from '@/hooks/useAdmissaoRequests';
import { extractEmployeeIdentity } from '@/utils/admissao/dossieBuilder';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';

const ALL_STATUSES: ('all' | AdmissionStatus)[] = ['all','rascunho','enviado','em_analise','pendente','aguardando_documentos','aguardando_informacoes','aguardando_sst','aprovado','concluido','cancelado'];

const EscritorioDashboardPage = () => {
  const { requests, loading, remove } = useAdmissaoRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdmissionStatus>('all');
  const [delTarget, setDelTarget] = useState<AdmissionRequest | null>(null);
  const [delTitle, setDelTitle] = useState('');
  const [completed, setCompleted] = useState<'sim' | 'nao' | ''>('');
  const [responsible, setResponsible] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.company_name.toLowerCase().includes(s) ||
        r.employee_name.toLowerCase().includes(s) ||
        r.template_name_snapshot.toLowerCase().includes(s)
      );
    });
  }, [requests, q, status]);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/admissao/preencher/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado');
  };

  const openDelete = (req: AdmissionRequest, title: string) => {
    setDelTarget(req);
    setDelTitle(title);
    setCompleted('');
    setResponsible('');
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    if (!completed) return toast.error('Informe se a admissão foi concluída');
    if (!responsible.trim()) return toast.error('Informe o responsável pela admissão');
    setBusy(true);
    const r = delTarget;
    const { error: archErr } = await supabase
      .from('admission_archive' as any)
      .insert({
        original_request_id: r.id,
        employee_name: r.employee_name || '',
        company_name: r.company_name || '',
        company_cnpj: r.company_cnpj || '',
        template_name: r.template_name_snapshot || '',
        previous_status: r.status,
        original_created_at: r.created_at,
        request_snapshot: r as any,
        admission_completed: completed === 'sim',
        responsible_name: responsible.trim(),
      } as any);
    if (archErr) {
      setBusy(false);
      return toast.error('Erro ao arquivar');
    }
    const { error } = await remove(r.id);
    setBusy(false);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Admissão arquivada e excluída');
    setDelTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admissões</h2>
          <p className="text-sm text-muted-foreground">Crie processos de admissão e envie o link ao cliente.</p>
        </div>
        <Button asChild>
          <Link to="/admissao/escritorio/admissoes/nova">
            <Plus className="w-4 h-4 mr-1" /> Nova admissão
          </Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por empresa ou colaborador..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'Todos os status' : STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma admissão encontrada.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map((r) => (
          (() => {
            const ans = r.status === 'rascunho' ? r.draft_answers : r.answers;
            const ident = extractEmployeeIdentity(r.template_schema_snapshot, ans);
            const collab = r.employee_name || ident.name || '(sem nome)';
            const company = r.company_name || '—';
            const title = `${company} · ${collab}`;
            return (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{title}</h3>
                <Badge variant="secondary">{STATUS_LABELS[r.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {r.template_name_snapshot}
              </p>
              {r.responsible_name && (
                <p className="text-xs text-muted-foreground truncate">
                  Responsável: {r.responsible_name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Criada em {new Date(r.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyLink(r.token)}>
              <CopyIcon className="w-4 h-4 mr-1" /> Link
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admissao/escritorio/admissoes/${r.id}`}>
                <Eye className="w-4 h-4 mr-1" /> Abrir
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => openDelete(r, title)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </Card>
            );
          })()
        ))}
      </div>

      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir admissão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{delTitle}" será arquivada antes da exclusão. Responda os campos abaixo para confirmar.
          </p>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>A admissão foi concluída? *</Label>
              <RadioGroup value={completed} onValueChange={(v) => setCompleted(v as any)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="adm-sim" value="sim" />
                  <Label htmlFor="adm-sim" className="font-normal">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="adm-nao" value="nao" />
                  <Label htmlFor="adm-nao" className="font-normal">Não</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resp">Responsável pela admissão *</Label>
              <Input id="resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome do responsável" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={confirmDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? 'Arquivando...' : 'Arquivar e excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EscritorioDashboardPage;