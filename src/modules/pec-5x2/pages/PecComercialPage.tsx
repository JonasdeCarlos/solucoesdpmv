import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Loader2 } from 'lucide-react';
import { commercialLeadSchema } from '../commercialSchema';
import { commercialApi, commercialCall } from '../commercialApi';
import NecessidadeContratacao from '../components/NecessidadeContratacao';
import CommercialEscala from '../components/CommercialEscala';

const key = 'pec-commercial-access';
export default function PecComercialPage() {
  const [token, setToken] = useState(() => localStorage.getItem(key) || '');
  const [empresa, setEmpresa] = useState<{ nome: string } | null>(null);
  const [busy, setBusy] = useState(!!token);
  const [error, setError] = useState('');
  const [nome, setNome] = useState(''), [email, setEmail] = useState(''), [whatsapp, setWhatsapp] = useState(''), [company, setCompany] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const api = useMemo(() => commercialApi(token), [token]);
  useEffect(() => {
    if (!token) return;
    commercialCall('load', token).then(d => setEmpresa(d.empresa)).catch(e => {
      setError(e.message); localStorage.removeItem(key); setToken('');
    }).finally(() => setBusy(false));
  }, [token]);
  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const parsed = commercialLeadSchema.safeParse({ nome, email, whatsapp, empresa: company, consentimento });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Confira os dados.'); return; }
    setBusy(true);
    try {
      const d = await commercialCall('register', '', { dados: parsed.data });
      localStorage.setItem(key, d.token); setToken(d.token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cadastrar.'); setBusy(false); }
  };
  return <div className="min-h-screen bg-background text-foreground">
    <header className="bg-primary text-primary-foreground"><div className="max-w-7xl mx-auto px-5 py-5"><p className="text-sm">Monte Verde Contabilidade</p><h1 className="text-2xl font-bold mt-1">PEC 5x2</h1></div></header>
    <main className={empresa ? 'max-w-7xl mx-auto px-3 py-6 md:px-6' : 'max-w-lg mx-auto px-5 py-10'}>
      {empresa ? <><h2 className="text-lg font-semibold mb-4">{empresa.nome}</h2><Tabs defaultValue="necessidade"><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="necessidade">Necessidade de Contratação</TabsTrigger><TabsTrigger value="escala">Escala de Revezamento</TabsTrigger></TabsList><TabsContent value="necessidade" forceMount className="data-[state=inactive]:hidden"><NecessidadeContratacao empresaId="comercial" empresa={empresa} api={api} /></TabsContent><TabsContent value="escala" forceMount className="data-[state=inactive]:hidden"><CommercialEscala token={token} empresa={empresa} /></TabsContent></Tabs></>
        : busy && token ? <p className="flex gap-2"><Loader2 className="h-5 w-5 animate-spin" />Abrindo sua simulação…</p>
        : <><h2 className="text-xl font-semibold mb-6">Cadastro para acesso</h2><form onSubmit={register} className="space-y-5">
          <div><Label htmlFor="lead-nome">Nome do contato</Label><Input id="lead-nome" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} required maxLength={120} /></div>
          <div><Label htmlFor="lead-email">E-mail</Label><Input id="lead-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></div>
          <div><Label htmlFor="lead-whatsapp">WhatsApp com DDD</Label><Input id="lead-whatsapp" type="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required maxLength={30} /></div>
          <div><Label htmlFor="lead-empresa">Empresa (opcional)</Label><Input id="lead-empresa" autoComplete="organization" value={company} onChange={e => setCompany(e.target.value)} maxLength={160} /></div>
          <label className="flex items-start gap-3 text-sm leading-relaxed"><Checkbox checked={consentimento} onCheckedChange={v => setConsentimento(v === true)} className="mt-1 shrink-0" />Autorizo a Monte Verde Contabilidade a guardar meu cadastro e entrar em contato por e-mail e WhatsApp para apresentar seus serviços; posso solicitar a remoção dos meus dados.</label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}Acessar ferramenta</Button>
        </form></>}
      <p className="text-xs text-muted-foreground mt-8">Simulação estimativa para planejamento; não substitui análise da legislação e da CCT aplicáveis.</p>
    </main>
  </div>;
}