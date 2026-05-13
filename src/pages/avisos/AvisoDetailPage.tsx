import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAviso, useAvisos } from '@/hooks/useAvisos';
import { STATUS_OPTIONS, formatBR, formatCnpj, statusLabel } from '@/utils/avisos/normalize';
import { buildWhatsappMessage } from '@/utils/avisos/whatsappMessage';
import { useOperatorName } from '@/hooks/useOperatorName';
import CallDialog from '@/components/avisos/CallDialog';

const AvisoDetailPage = () => {
  const { id } = useParams();
  const { aviso, attempts, loading, refresh } = useAviso(id);
  const { updateAviso, addAttempt } = useAvisos();
  const { ensure } = useOperatorName();
  const [obs, setObs] = useState('');
  const [callOpen, setCallOpen] = useState(false);

  if (loading || !aviso) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const msg = buildWhatsappMessage(aviso);
  const op = () => ensure() || 'desconhecido';

  const mark = async (n: 1 | 2 | 3) => {
    const o = op(); const now = new Date().toISOString();
    await updateAviso(aviso.id, { [`aviso${n}_at`]: now, [`aviso${n}_by`]: o } as any);
    await addAttempt(aviso.id, { attempt_type: `aviso${n}`, marked_by: o });
    toast.success(`Aviso ${n} registrado.`); refresh();
  };
  const noResp = async () => {
    const o = op();
    await updateAviso(aviso.id, { no_response_at: new Date().toISOString(), no_response_by: o, status: aviso.status === 'concluido' ? aviso.status : 'sem_retorno' } as any);
    await addAttempt(aviso.id, { attempt_type: 'no_response', marked_by: o });
    toast.success('Marcado.'); refresh();
  };
  const saveObs = async () => {
    const o = op();
    await updateAviso(aviso.id, { observacoes: (aviso.observacoes ? aviso.observacoes + '\n' : '') + `[${new Date().toLocaleString('pt-BR')} ${o}] ${obs}` });
    await addAttempt(aviso.id, { attempt_type: 'observation', marked_by: o, notes: obs });
    setObs(''); toast.success('Observação salva.'); refresh();
  };
  const changeStatus = async (s: string) => {
    const o = op();
    await updateAviso(aviso.id, { status: s });
    await addAttempt(aviso.id, { attempt_type: 'status_change', marked_by: o, notes: `Status → ${statusLabel(s)}` });
    refresh();
  };

  return (
    <div className="space-y-4">
      <Link to="/avisos" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Avisos</Link>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>{statusLabel(aviso.status)}</Badge>
          <h2 className="text-xl font-bold">{aviso.employee_name}</h2>
          <span className="text-xs text-muted-foreground">#{aviso.employee_code}</span>
        </div>
        <p className="text-sm">
          <b>{aviso.motivo}</b> • Vencimento <b>{formatBR(aviso.due_date)}</b>
          {aviso.limit_date && <> • Limite <b>{formatBR(aviso.limit_date)}</b></>}
        </p>
        <p className="text-xs text-muted-foreground">{aviso.empresa_code} — {aviso.empresa_name} • {formatCnpj(aviso.empresa_cnpj)}</p>
        {aviso.source_emission_date && <p className="text-xs text-muted-foreground">Emissão do PDF: {formatBR(aviso.source_emission_date)}</p>}
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Mensagem WhatsApp</h3>
        <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">{msg}</pre>
        <Button size="sm" onClick={() => { navigator.clipboard.writeText(msg); toast.success('Copiada.'); }}>
          <Copy className="w-3 h-3 mr-1" /> Copiar
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Ações</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => mark(n as 1|2|3)}>
              Aviso {n}{(aviso as any)[`aviso${n}_at`] ? ` ✓` : ''}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={noResp}>Cliente sem retorno</Button>
          <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>Ligação realizada</Button>
          <Select value={aviso.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Observações internas</h3>
        {aviso.observacoes && <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">{aviso.observacoes}</pre>}
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Adicionar observação..." rows={3} />
        <Button size="sm" onClick={saveObs} disabled={!obs.trim()}>Salvar observação</Button>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Histórico</h3>
        {attempts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> :
          <div className="space-y-1 text-xs">
            {attempts.map((h) => (
              <div key={h.id} className="border-l-2 border-primary/30 pl-2">
                <span className="font-medium">{h.attempt_type}</span> • {new Date(h.marked_at).toLocaleString('pt-BR')} • {h.marked_by || '—'}
                {h.call_channel && <> • {h.call_channel}{h.call_date ? ` (${formatBR(h.call_date)})` : ''}</>}
                {h.notes && <div className="text-muted-foreground">{h.notes}</div>}
              </div>
            ))}
          </div>}
      </Card>

      <CallDialog open={callOpen} onClose={() => setCallOpen(false)} avisoId={aviso.id} onDone={() => { setCallOpen(false); refresh(); }} />
    </div>
  );
};
export default AvisoDetailPage;
