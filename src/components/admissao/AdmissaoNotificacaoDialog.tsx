import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const AdmissaoNotificacaoDialog = ({ open, onOpenChange }: Props) => {
  const [id, setId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [numeros, setNumeros] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('admissao_notify_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      const row = data as any;
      if (row) {
        setId(row.id);
        setEnabled(row.enabled !== false);
        setNumeros(row.whatsapp_numeros?.length ? row.whatsapp_numeros : ['']);
      }
      setLoading(false);
    })();
  }, [open]);

  const save = async () => {
    const clean = numeros.map((n) => n.replace(/\D/g, '')).filter(Boolean);
    setSaving(true);
    const payload = { enabled, whatsapp_numeros: clean };
    const { error } = id
      ? await supabase.from('admissao_notify_settings' as any).update(payload as any).eq('id', id)
      : await supabase.from('admissao_notify_settings' as any).insert(payload as any);
    setSaving(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    toast.success('Notificações salvas');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alerta de nova admissão (WhatsApp)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ao receber uma nova admissão, o sistema envia um alerta via Digisac para os números abaixo.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Switch id="notif-on" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="notif-on" className="font-normal">Notificações ativas</Label>
            </div>
            <div className="space-y-2">
              <Label>Números (com DDD, ex.: 35988395876)</Label>
              {numeros.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={n}
                    onChange={(e) => setNumeros(numeros.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="35988395876"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNumeros(numeros.length > 1 ? numeros.filter((_, j) => j !== i) : [''])}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setNumeros([...numeros, ''])}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar número
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdmissaoNotificacaoDialog;
