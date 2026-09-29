import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Loader2, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const callManage = async (politicaId: string, op: string, extra: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke('premiacao-public', {
    body: { action: 'manage_link', politica_id: politicaId, op, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function LinkGestorDialog({ politicaId, open, onOpenChange }: { politicaId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [editSenhaId, setEditSenhaId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState('');

  const load = async () => {
    try {
      const r = await callManage(politicaId, 'list');
      setItems(r.items || []);
    } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { if (open) load(); }, [open, politicaId]);

  const criar = async () => {
    setBusy(true);
    try {
      await callManage(politicaId, 'create', { senha: senha || undefined });
      toast.success('Link criado');
      setSenha('');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const url = (t: string) => `${window.location.origin}/premiacao-gestor/${t}`;
  const copiar = (t: string) => { navigator.clipboard.writeText(url(t)); toast.success('Link copiado'); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Link externo do gestor</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Quem receber o link pode lançar ocorrências, cadastrar colaboradores, emitir extratos, a apuração e o regulamento — sem login. Proteja com senha se quiser.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Label className="text-xs">Senha do link (opcional)</Label>
            <Input type="text" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Deixe vazio para acesso direto" /></div>
          <Button onClick={criar} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}Gerar link</Button>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link gerado ainda.</p>}
          {items.map(l => (
            <div key={l.id} className="rounded border p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs break-all flex-1">{url(l.token)}</code>
                <Badge variant={l.ativo ? 'default' : 'outline'}>{l.ativo ? 'Ativo' : 'Desativado'}</Badge>
                {l.protegido && <Badge variant="secondary"><KeyRound className="w-3 h-3 mr-1" />Com senha</Badge>}
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => copiar(l.token)}><Copy className="w-3 h-3 mr-1" />Copiar</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await callManage(politicaId, 'toggle', { link_id: l.id, ativo: !l.ativo }); load(); }}>{l.ativo ? 'Desativar' : 'Reativar'}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditSenhaId(editSenhaId === l.id ? null : l.id); setNovaSenha(''); }}>Senha</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await callManage(politicaId, 'delete', { link_id: l.id }); load(); }}><Trash2 className="w-3 h-3" /></Button>
              </div>
              {editSenhaId === l.id && (
                <div className="flex gap-2">
                  <Input type="text" placeholder="Nova senha (vazio = remover)" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={async () => { await callManage(politicaId, 'set_password', { link_id: l.id, senha: novaSenha || undefined }); setEditSenhaId(null); load(); toast.success('Senha atualizada'); }}>Salvar</Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">O link só funciona no endereço publicado do sistema. Se estiver testando na prévia, publique o app antes de enviar ao gestor.</p>
      </DialogContent>
    </Dialog>
  );
}
