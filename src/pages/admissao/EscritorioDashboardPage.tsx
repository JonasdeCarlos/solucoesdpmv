import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Copy as CopyIcon, FileText, Trash2 } from 'lucide-react';
import { useAdmissaoRequests, STATUS_LABELS, AdmissionStatus } from '@/hooks/useAdmissaoRequests';
import { extractEmployeeIdentity } from '@/utils/admissao/dossieBuilder';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const ALL_STATUSES: ('all' | AdmissionStatus)[] = ['all','rascunho','enviado','em_analise','pendente','aprovado','concluido','cancelado'];

const EscritorioDashboardPage = () => {
  const { requests, loading, remove } = useAdmissaoRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdmissionStatus>('all');

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

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Excluir admissão "${label}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await remove(id);
    if (error) toast.error('Erro ao excluir');
    else toast.success('Admissão excluída');
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
            <Button variant="outline" size="sm" onClick={() => handleDelete(r.id, title)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </Card>
            );
          })()
        ))}
      </div>
    </div>
  );
};

export default EscritorioDashboardPage;