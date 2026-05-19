import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, ShieldCheck, UserPlus, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface Invited {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string;
  created_at: string;
}

const STORAGE_KEY = 'usuarios_invite_draft_v1';

function loadPersistedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { email?: string; role?: AppRole; password?: string } : null;
  } catch {
    return null;
  }
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const persisted = loadPersistedDraft();
  const [list, setList] = useState<Invited[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(persisted?.email ?? '');
  const [role, setRole] = useState<AppRole>(persisted?.role ?? 'user');
  const [password, setPassword] = useState(persisted?.password ?? '');
  const [pwDialog, setPwDialog] = useState<{ email: string } | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invited_emails' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar lista: ' + error.message);
    setList((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, role, password }));
  }, [email, role, password]);

  if (roleLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setBusy(true);
    const { error } = await supabase.from('invited_emails' as any).insert({
      email: normalized,
      role,
      invited_by: user?.email || '',
    } as any);
    if (error) {
      setBusy(false);
      toast.error(error.code === '23505' ? 'Este e-mail já está convidado.' : error.message);
      return;
    }
    if (password.trim()) {
      const { error: pwErr } = await supabase.functions.invoke('admin-set-password', {
        body: { email: normalized, password: password.trim() },
      });
      if (pwErr) {
        toast.error('Convite registrado, mas falhou ao definir senha: ' + pwErr.message);
      } else {
        toast.success('Usuário criado com senha definida. Já pode fazer login.');
      }
    } else {
      toast.success('Convite registrado. Peça ao usuário para fazer cadastro com este e-mail.');
    }
    setBusy(false);
    setEmail(''); setRole('user'); setPassword('');
    load();
  };

  const handleSetPassword = async () => {
    if (!pwDialog) return;
    if (pwValue.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres.'); return; }
    setPwBusy(true);
    const { error } = await supabase.functions.invoke('admin-set-password', {
      body: { email: pwDialog.email, password: pwValue },
    });
    setPwBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Senha definida com sucesso.');
    setPwDialog(null); setPwValue('');
  };

  const handleRoleChange = async (id: string, newRole: AppRole) => {
    const { error } = await supabase.from('invited_emails' as any).update({ role: newRole } as any).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Papel atualizado. Vale para próximo cadastro.');
    load();
  };

  const handleRemove = async (id: string, mail: string) => {
    if (mail === 'jonas@contabilmv.com') {
      toast.error('O usuário master não pode ser removido.');
      return;
    }
    if (!confirm(`Remover convite de ${mail}? O usuário existente continua, remova-o em "Backend" se necessário.`)) return;
    const { error } = await supabase.from('invited_emails' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Convite removido.');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> Usuários autorizados</h1>
        <p className="text-sm text-muted-foreground">Apenas e-mails da lista abaixo conseguem criar conta e acessar o sistema.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> Convidar novo e-mail</CardTitle>
          <CardDescription>O usuário deverá se cadastrar usando exatamente este e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="md:w-48">
              <Label htmlFor="inv-pw">Senha (opcional)</Label>
              <Input id="inv-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6 caracteres" />
            </div>
            <div className="md:w-44">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convidar'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Informando a senha, o usuário é criado já confirmado e pode entrar imediatamente. Sem senha, ele precisará se cadastrar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de convidados ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum e-mail convidado ainda.</p>
          ) : (
            <div className="divide-y">
              {list.map((it) => (
                <div key={it.id} className="flex flex-col md:flex-row md:items-center gap-2 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Convidado por {it.invited_by || '—'} em {new Date(it.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <Select value={it.role} onValueChange={(v) => handleRoleChange(it.id, v as AppRole)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="master">Master</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => { setPwDialog({ email: it.email }); setPwValue(''); }} title="Definir/Redefinir senha">
                    <KeyRound className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Senha</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(it.id, it.email)} title="Remover convite">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pwDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPwDialog(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Definir senha</CardTitle>
              <CardDescription>{pwDialog.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="pw-new">Nova senha</Label>
                <Input id="pw-new" type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="mín. 6 caracteres" autoFocus />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPwDialog(null)}>Cancelar</Button>
                <Button onClick={handleSetPassword} disabled={pwBusy}>
                  {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar senha'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
