import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Copy, Phone, X, ExternalLink, CheckSquare, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAvisos } from '@/hooks/useAvisos';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { useOperatorName } from '@/hooks/useOperatorName';
import { MOTIVO_CATEGORIES, STATUS_OPTIONS, formatBR, formatCnpj, statusLabel } from '@/utils/avisos/normalize';
import { buildWhatsappMessage } from '@/utils/avisos/whatsappMessage';
import { copyToClipboard } from '@/utils/clipboard';
import CallDialog from '@/components/avisos/CallDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const STATUS_COLOR: Record<string, string> = {
  sem_retorno: 'bg-destructive/15 text-destructive border-destructive/30',
  aberto: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  em_tratamento: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  concluido: 'bg-green-500/10 text-green-700 border-green-500/30',
};

const TRI_STATE = [
  { value: 'all', label: 'Todos' },
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
];

const AvisosListPage = () => {
  const { items, loading, updateAviso, addAttempt, refresh } = useAvisos();
  const { empresas, setEmpresaDefaultResponsavel } = useAvisoEmpresas();
  const { ensure } = useOperatorName();
  const [params, setParams] = useSearchParams();

  const [empresaF, setEmpresaF] = useState(params.get('empresa') || 'all');
  const [motivoF, setMotivoF] = useState<string>('all');
  const [statusF, setStatusF] = useState<string[]>([]);
  const [a1F, setA1F] = useState<string>('all');
  const [a2F, setA2F] = useState<string>('all');
  const [a3F, setA3F] = useState<string>('all');
  const [noRespF, setNoRespF] = useState<string>('all');
  const [callF, setCallF] = useState<string>('all');
  const [respF, setRespF] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [impFrom, setImpFrom] = useState('');
  const [impTo, setImpTo] = useState('');

  const [callDialog, setCallDialog] = useState<{ id: string } | null>(null);
  const [respEdit, setRespEdit] = useState<Record<string, string>>({});
  const [msgDialog, setMsgDialog] = useState<{ text: string } | null>(null);
  const msgTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (empresaF !== 'all' && a.empresa_code !== empresaF) return false;
      if (motivoF !== 'all' && a.motivo !== motivoF) return false;
      if (statusF.length > 0 && !statusF.includes(a.status)) return false;
      if (a1F !== 'all') {
        const has = !!a.aviso1_at;
        if (a1F === 'yes' && !has) return false;
        if (a1F === 'no' && has) return false;
      }
      if (a2F !== 'all') {
        const has = !!a.aviso2_at;
        if (a2F === 'yes' && !has) return false;
        if (a2F === 'no' && has) return false;
      }
      if (a3F !== 'all') {
        const has = !!a.aviso3_at;
        if (a3F === 'yes' && !has) return false;
        if (a3F === 'no' && has) return false;
      }
      if (noRespF !== 'all') {
        const has = !!a.no_response_at;
        if (noRespF === 'yes' && !has) return false;
        if (noRespF === 'no' && has) return false;
      }
      if (callF !== 'all') {
        const has = !!a.has_call;
        if (callF === 'yes' && !has) return false;
        if (callF === 'no' && has) return false;
      }
      if (respF.trim()) {
        const r = (a.responsavel || '').toLowerCase();
        if (!r.includes(respF.toLowerCase())) return false;
      }
      if (dueFrom && (!a.due_date || a.due_date < dueFrom)) return false;
      if (dueTo && (!a.due_date || a.due_date > dueTo)) return false;
      if (impFrom && a.created_at.slice(0, 10) < impFrom) return false;
      if (impTo && a.created_at.slice(0, 10) > impTo) return false;
      return true;
    });
  }, [items, empresaF, motivoF, statusF, a1F, a2F, a3F, noRespF, callF, respF, dueFrom, dueTo, impFrom, impTo]);

  const clearFilters = () => {
    setEmpresaF('all');
    setMotivoF('all');
    setStatusF([]);
    setA1F('all');
    setA2F('all');
    setA3F('all');
    setNoRespF('all');
    setCallF('all');
    setRespF('');
    setDueFrom('');
    setDueTo('');
    setImpFrom('');
    setImpTo('');
    setParams({});
  };

  const copyMsg = async (a: any) => {
    const msg = buildWhatsappMessage(a);
    setMsgDialog({ text: msg });
    const ok = await copyToClipboard(msg);
    if (ok) {
      toast.success('Mensagem copiada para a área de transferência.');
    } else {
      toast.error('Não foi possível copiar automaticamente. O texto foi gerado abaixo para copiar manualmente.');
    }
  };

  const markAviso = async (a: any, n: 1 | 2 | 3) => {
    const op = ensure() || 'desconhecido';
    const now = new Date().toISOString();
    const patch: any = {};
    patch[`aviso${n}_at`] = now;
    patch[`aviso${n}_by`] = op;
    await updateAviso(a.id, patch);
    await addAttempt(a.id, { attempt_type: `aviso${n}`, marked_by: op });
    toast.success(`Aviso ${n} registrado.`);
  };

  const markNoResponse = async (a: any) => {
    const op = ensure() || 'desconhecido';
    const patch: any = { no_response_at: new Date().toISOString(), no_response_by: op };
    if (a.status !== 'concluido') patch.status = 'sem_retorno';
    await updateAviso(a.id, patch);
    await addAttempt(a.id, { attempt_type: 'no_response', marked_by: op });
    toast.success('Marcado: cliente sem retorno.');
  };

  const changeStatus = async (a: any, status: string) => {
    const op = ensure() || 'desconhecido';
    await updateAviso(a.id, { status });
    await addAttempt(a.id, { attempt_type: 'status_change', marked_by: op, notes: `Status → ${statusLabel(status)}` });
  };

  const saveResponsavel = async (a: any) => {
    const novo = (respEdit[a.id] ?? a.responsavel ?? '').trim();
    if (novo === (a.responsavel || '')) {
      setRespEdit((s) => { const n = { ...s }; delete n[a.id]; return n; });
      return;
    }
    await updateAviso(a.id, { responsavel: novo });
    await setEmpresaDefaultResponsavel(a.empresa_code, novo);
    setRespEdit((s) => { const n = { ...s }; delete n[a.id]; return n; });
    toast.success(novo ? `Responsável definido: ${novo}` : 'Responsável removido.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Avisos</h1>
          <p className="text-sm text-muted-foreground">Gestão e tratamento dos avisos extraídos dos PDFs.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/avisos/empresas"><Button variant="outline">Empresas</Button></Link>
          <Link to="/avisos/import"><Button>Importar PDF</Button></Link>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Empresa</span>
          <Select value={empresaF} onValueChange={setEmpresaF}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.code}>{e.code} — {e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Motivo</span>
          <Select value={motivoF} onValueChange={setMotivoF}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              {MOTIVO_CATEGORIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Status</span>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Aviso 1</span>
          <Select value={a1F} onValueChange={setA1F}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              {TRI_STATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Aviso 2</span>
          <Select value={a2F} onValueChange={setA2F}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              {TRI_STATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Aviso 3</span>
          <Select value={a3F} onValueChange={setA3F}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              {TRI_STATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Sem retorno</span>
          <Select value={noRespF} onValueChange={setNoRespF}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              {TRI_STATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Ligação</span>
          <Select value={callF} onValueChange={setCallF}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              {TRI_STATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">Responsável</span>
          <Input placeholder="Digite o nome" value={respF} onChange={(e) => setRespF(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-muted-foreground font-medium">Vencimento</span>
          <div className="flex gap-3 items-center">
            <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">até</span>
            <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-muted-foreground font-medium">Importação</span>
          <div className="flex gap-3 items-center">
            <Input type="date" value={impFrom} onChange={(e) => setImpFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">até</span>
            <Input type="date" value={impTo} onChange={(e) => setImpTo(e.target.value)} />
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} avisos</span>
          <Button variant="outline" size="sm" onClick={clearFilters}>Limpar</Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum aviso encontrado. Importe um PDF para começar.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={STATUS_COLOR[a.status] || ''}>{statusLabel(a.status)}</Badge>
                    <span className="font-semibold">{a.employee_name}</span>
                    <span className="text-xs text-muted-foreground">#{a.employee_code}</span>
                  </div>
                  <div className="text-sm mt-0.5">
                    <span className="font-medium">{a.motivo}</span>
                    {' • '}
                    <span>Vencimento: <b>{formatBR(a.due_date)}</b></span>
                    {a.limit_date && <> {' • '}<span className="text-amber-700">Limite: <b>{formatBR(a.limit_date)}</b></span></>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.empresa_code} — {a.empresa_name} • CNPJ {formatCnpj(a.empresa_cnpj)}
                    {a.source_emission_date && <> • Emissão PDF: {formatBR(a.source_emission_date)}</>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Responsável:</span>
                    <Input
                      className="h-7 text-xs max-w-[240px]"
                      placeholder="Atribuir responsável"
                      value={respEdit[a.id] ?? a.responsavel ?? ''}
                      onChange={(ev) => setRespEdit((s) => ({ ...s, [a.id]: ev.target.value }))}
                      onBlur={() => saveResponsavel(a)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                    {[1, 2, 3].map((n) => {
                      const at = (a as any)[`aviso${n}_at`];
                      const by = (a as any)[`aviso${n}_by`];
                      return (
                        <Badge key={n} variant={at ? 'default' : 'outline'} className={at ? 'bg-primary/15 text-primary border-primary/30' : ''}>
                          Aviso {n}{at ? `: ${new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}${by ? ` (${by})` : ''}` : ''}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 items-stretch min-w-[200px]">
                  <Button size="sm" variant="outline" onClick={() => copyMsg(a)}><Copy className="w-3 h-3 mr-1" />Copiar mensagem</Button>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markAviso(a, 1)}><CheckSquare className="w-3 h-3 mr-1" />A1</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markAviso(a, 2)}>A2</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markAviso(a, 3)}>A3</Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markNoResponse(a)}><X className="w-3 h-3 mr-1" />Sem retorno</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setCallDialog({ id: a.id })}><Phone className="w-3 h-3 mr-1" />Ligação</Button>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Select value={a.status} onValueChange={(v) => changeStatus(a, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Link to={`/avisos/${a.id}`}><Button size="sm" variant="ghost"><ExternalLink className="w-3 h-3" /></Button></Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CallDialog
        open={!!callDialog}
        onClose={() => setCallDialog(null)}
        avisoId={callDialog?.id || ''}
        onDone={() => { setCallDialog(null); refresh(); }}
      />

      <Dialog open={!!msgDialog} onOpenChange={(o) => !o && setMsgDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Copiar mensagem</DialogTitle>
            <DialogDescription>
              Texto gerado para WhatsApp. Se não colar automaticamente, selecione abaixo e pressione Ctrl+C (ou Cmd+C).
            </DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            value={msgDialog?.text || ''}
            className="w-full h-56 p-2 text-sm border rounded-md font-mono bg-muted/30"
            ref={(el) => { msgTextareaRef.current = el; if (el) { el.focus(); el.select(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={async () => {
              const ok = await copyToClipboard(msgDialog?.text || '', msgTextareaRef.current);
              if (ok) { toast.success('Mensagem copiada para a área de transferência.'); setMsgDialog(null); }
              else toast.error('Use Ctrl+C para copiar.');
            }}>Tentar copiar novamente</Button>
            <Button onClick={() => setMsgDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvisosListPage;
