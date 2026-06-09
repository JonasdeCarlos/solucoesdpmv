import { useParams, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAviso, useAvisos } from '@/hooks/useAvisos';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { STATUS_OPTIONS, formatBR, formatCnpj, statusLabel } from '@/utils/avisos/normalize';
import { buildWhatsappMessage } from '@/utils/avisos/whatsappMessage';
import { sendAvisoDigisac } from '@/utils/avisos/digisac';
import { useOperatorName } from '@/hooks/useOperatorName';
import CallDialog from '@/components/avisos/CallDialog';

const AvisoDetailPage = () => {
  const { id } = useParams();
  const { aviso, attempts, loading, refresh } = useAviso(id);
  const { updateAviso, addAttempt } = useAvisos();
  const { empresas } = useAvisoEmpresas();
  const { ensure } = useOperatorName();
  const [obs, setObs] = useState('');
  const [callOpen, setCallOpen] = useState(false);
  const [sending, setSending] = useState<0 | 1 | 2 | 3>(0);
  const sendingLockRef = useRef<Set<string>>(new Set());

  if (loading || !aviso) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const empresa = empresas.find((e) => e.code === aviso.empresa_code || e.id === aviso.empresa_id);
  const previewMsg = buildWhatsappMessage(aviso);
  const op = () => ensure() || 'desconhecido';

  const mark = async (n: 1 | 2 | 3) => {
    const lockKey = `${aviso.id}:${n}`;
    if (sendingLockRef.current.has(lockKey)) {
      console.warn('[mark] Bloqueado: envio em andamento para', lockKey);
      return;
    }
    sendingLockRef.current.add(lockKey);
    setSending(n);
    try {
      const o = op();
      const send = await sendAvisoDigisac({
        aviso, empresa,
        prefix: { kind: 'aviso', n },
        tipo_aviso: (`aviso${n}` as 'aviso1' | 'aviso2' | 'aviso3'),
      });
      if (!send.ok) {
        toast.error(`Aviso ${n} não enviado: ${send.error}`);
        return;
      }
      if ((send.data as any)?.duplicado) {
        toast.info(`Aviso ${n}: envio duplicado ignorado.`);
        return;
      }
      const now = new Date().toISOString();
      await updateAviso(aviso.id, { [`aviso${n}_at`]: now, [`aviso${n}_by`]: o } as any);
      await addAttempt(aviso.id, { attempt_type: `aviso${n}`, marked_by: o, notes: 'Enviado via Digisac' });
      toast.success(`Aviso ${n} enviado via Digisac e registrado.`);
      refresh();
    } finally {
      sendingLockRef.current.delete(lockKey);
      setSending(0);
    }
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
        <h3 className="font-semibold">Pré-visualização da mensagem (envio via Digisac)</h3>
        <p className="text-xs text-muted-foreground">
          Destino WhatsApp: <b>{empresa?.whatsapp || '— não cadastrado —'}</b>
          {!empresa?.whatsapp && <> · Cadastre em <Link className="underline" to="/avisos/empresas">Empresas</Link>.</>}
        </p>
        <Textarea readOnly value={previewMsg} className="min-h-48 font-mono text-sm" />
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Ações</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Button key={n} variant="outline" size="sm" disabled={sending !== 0} onClick={() => mark(n as 1|2|3)}>
              <Send className="w-3 h-3 mr-1" />A{n}{(aviso as any)[`aviso${n}_at`] ? ` ✓` : ''}
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
