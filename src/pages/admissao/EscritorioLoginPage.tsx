import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { useOfficeAuth } from '@/hooks/useOfficeAuth';
import { toast } from 'sonner';

const EscritorioLoginPage = () => {
  const { login } = useOfficeAuth();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(pwd);
    setBusy(false);
    if (ok) {
      toast.success('Acesso liberado');
      nav('/admissao/escritorio');
    } else {
      toast.error('Senha incorreta');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Acesso do Escritório</h1>
          <p className="text-sm text-muted-foreground text-center">
            Área restrita aos membros do escritório.
          </p>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input
              id="pwd"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default EscritorioLoginPage;