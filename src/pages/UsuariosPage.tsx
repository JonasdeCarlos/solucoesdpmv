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
import { Loader2, Trash2, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Invited {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string;
  created_at: string;
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [list, setList] = useState<Invited[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('user');

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
    setBusy(false);
    if (error) {
      toast.error(error.code === '23505' ? 'Este e-mail já está convidado.' : error.message);
      return;
    }
    toast.success('Convite registrado. Peça ao usuário para fazer cadastro com este e-mail.');
    setEmail(''); setRole('user');
    load();
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
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(it.id, it.email)} title="Remover convite">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
