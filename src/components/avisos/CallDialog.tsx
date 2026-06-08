import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CALL_CHANNELS } from '@/utils/avisos/normalize';
import { supabase } from '@/integrations/supabase/client';
import { useOperatorName } from '@/hooks/useOperatorName';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { sendAvisoDigisac } from '@/utils/avisos/digisac';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  avisoId: string;
  onDone: () => void;
}

const CallDialog = ({ open, onClose, avisoId, onDone }: Props) => {
  const { ensure } = useOperatorName();
  const { empresas } = useAvisoEmpresas();
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState<string>(CALL_CHANNELS[0]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!avisoId) return;
    const op = ensure() || 'desconhecido';
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('aviso_contact_attempts' as any).insert({
      aviso_id: avisoId, attempt_type: 'call', marked_by: op,
      call_date: callDate, call_channel: channel, notes,
      marked_at: nowIso,
    } as any);
    if (error) { toast.error('Erro: ' + error.message); return; }

    // Buscar aviso + empresa para enviar Digisac
    const { data: aviso } = await supabase.from('avisos' as any).select('*').eq('id', avisoId).maybeSingle();
    if (aviso) {
      const emp = empresas.find((e) => e.code === (aviso as any).empresa_code || e.id === (aviso as any).empresa_id);
      const send = await sendAvisoDigisac({
        aviso: aviso as any,
        empresa: emp,
        prefix: { kind: 'call', whenISO: nowIso },
        tipo_aviso: 'ligacao',
      });
      if (!send.ok) toast.error(`Ligação registrada, mas Digisac falhou: ${send.error}`);
      else toast.success('Ligação registrada e mensagem enviada via Digisac.');
    } else {
      toast.success('Ligação registrada.');
    }
    setBusy(false);
    setNotes('');
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar ligação realizada</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Data da ligação</Label>
            <Input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} />
          </div>
          <div>
            <Label>Meio utilizado</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALL_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Anotações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="O que foi tratado na ligação..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallDialog;
