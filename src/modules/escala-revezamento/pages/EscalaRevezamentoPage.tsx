import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientes } from '@/hooks/useClientes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Copy, FileDown, FileSpreadsheet, Link2, Loader2, Plus, RefreshCw, Save, Send, ShieldOff, Trash2, CheckCircle2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import EscalaEditor from '../components/EscalaEditor';
import { carregarEscala, paramsDe, salvarEscala, PARAM_KEYS, STATUS_LABEL, fmtBRAno, type EscalaFuncionario, type EscalaParams } from '../motor';
import { gerarPdf, gerarXlsx } from '../exportar';
import { buildExternalAppLink } from '@/utils/publicLinks';
import { copyToClipboard } from '@/utils/clipboard';

const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const sha256 = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, '0')).join('');
const novoToken = () => { const a = new Uint8Array(32); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); };
const linkUrl = (t: string) => buildExternalAppLink(`/escala-publica/${t}`);

export default function EscalaRevezamentoPage() {
  const { clientes } = useClientes();
  const [clienteId, setClienteIdRaw] = useState(() => localStorage.getItem('escala-cliente') || '');
  const setClienteId = (v: string) => { setClienteIdRaw(v); localStorage.setItem('escala-cliente', v); };
  const [busca, setBusca] = useState('');
  const [aberta, setAbertaRaw] = useState<string | null>(() => sessionStorage.getItem('escala-aberta'));
  const setAberta = (v: string | null) => { setAbertaRaw(v); if (v) sessionStorage.setItem('escala-aberta', v); else sessionStorage.removeItem('escala-aberta'); };
  const [tab, setTab] = useState('escalas');
  const [novas, setNovas] = useState(0);

  const contarNovas = useCallback(async () => {
    const { count } = await supabase.from('escalas_revezamento' as any).select('id', { count: 'exact', head: true }).eq('status', 'enviada').eq('visto_escritorio', false);
    setNovas(count || 0);
  }, []);

  useEffect(() => {
    contarNovas();
    const ch = supabase.channel('escalas-recebidas')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'escalas_revezamento' }, (pl: any) => {
        if (pl.new?.status === 'enviada' && pl.old?.status !== 'enviada') toast.info(`Nova escala recebida: ${pl.new.preenchido_por_nome || 'cliente'}`);
        contarNovas();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contarNovas]);

  const filtrados = useMemo(() => clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())), [clientes, busca]);

  if (aberta) return <EscalaView id={aberta} onVoltar={() => { setAberta(null); contarNovas(); }} />;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Escala de Revezamento de Folgas</h1>
        <p className="text-sm text-muted-foreground">Gera e valida escalas 6x1, 5x2 e similares (art. 67 CLT, Lei 10.101/2000, Portaria MTP 671/2021).</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="escalas">Escalas</TabsTrigger>
          <TabsTrigger value="recebidas">Recebidas de clientes {novas > 0 && <Badge className="ml-2" variant="destructive">{novas}</Badge>}</TabsTrigger>
          <TabsTrigger value="links">Links públicos</TabsTrigger>
        </TabsList>
        {tab !== 'recebidas' && (
          <Card className="p-3 mt-3 flex flex-wrap gap-2 items-end">
            <div><Label>Buscar empresa</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" /></div>
            <div><Label>Empresa</Label>
              <select className={sel + ' w-80'} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecione…</option>
                {filtrados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select></div>
          </Card>
        )}
        <TabsContent value="escalas">{clienteId ? <ListaEscalas clienteId={clienteId} onAbrir={setAberta} /> : <p className="text-sm text-muted-foreground p-4">Escolha uma empresa.</p>}</TabsContent>
        <TabsContent value="recebidas"><Recebidas clientes={clientes} onAbrir={setAberta} /></TabsContent>
        <TabsContent value="links">{clienteId ? <LinksPublicos clienteId={clienteId} clienteNome={clientes.find((c) => c.id === clienteId)?.nome || ''} /> : <p className="text-sm text-muted-foreground p-4">Escolha uma empresa.</p>}</TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const v = s === 'aprovada' ? 'default' : s === 'enviada' ? 'destructive' : s === 'devolvida' ? 'outline' : 'secondary';
  return <Badge variant={v as any}>{STATUS_LABEL[s] || s}</Badge>;
}

function ListaEscalas({ clienteId, onAbrir }: { clienteId: string; onAbrir: (id: string) => void }) {
  const [itens, setItens] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('escalas_revezamento' as any).select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false });
    setItens((data as any[]) || []);
  }, [clienteId]);
  useEffect(() => { load(); }, [load]);
  const nova = async () => {
    const h = new Date();
    const ini = new Date(Date.UTC(h.getFullYear(), h.getMonth() + 1, 1)).toISOString().slice(0, 10);
    const fim = new Date(Date.UTC(h.getFullYear(), h.getMonth() + 2, 0)).toISOString().slice(0, 10);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('escalas_revezamento' as any).insert({ cliente_id: clienteId, data_inicio: ini, data_fim: fim, titulo: 'Escala de revezamento', created_by: u.user?.id } as any).select('id').single();
    if (error) return toast.error(error.message);
    onAbrir((data as any).id);
  };
  const excluir = async (id: string) => {
    if (!confirm('Excluir esta escala?')) return;
    await supabase.from('escalas_revezamento' as any).delete().eq('id', id); load();
  };
  const linkGestor = async (e: any) => {
    const tokSalvo = e.link_id ? localStorage.getItem(`escala-link-${e.link_id}`) : null;
    if (tokSalvo && confirm('Esta escala já tem link. Copiar o link existente? (Cancelar gera um novo link e o anterior deixa de funcionar)')) {
      await copyToClipboard(linkUrl(tokSalvo)); return toast.success('Link copiado.');
    }
    const token = novoToken(); const th = await sha256(token);
    let linkId = e.link_id as string | null;
    if (linkId) {
      const { error } = await supabase.from('escala_links_publicos' as any).update({ token_hash: th, pin_hash: null, revogado_em: null, expira_em: new Date(Date.now() + 90 * 86400000).toISOString() } as any).eq('id', linkId);
      if (error) return toast.error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('escala_links_publicos' as any).insert({
        cliente_id: clienteId, token_hash: th, expira_em: new Date(Date.now() + 90 * 86400000).toISOString(), created_by: u.user?.id,
      } as any).select('id').single();
      if (error) return toast.error(error.message);
      linkId = (data as any).id;
      const { error: e2 } = await supabase.from('escalas_revezamento' as any).update({ link_id: linkId, ...(e.status === 'enviada' || e.status === 'aprovada' ? {} : { status: 'rascunho' }) } as any).eq('id', e.id);
      if (e2) return toast.error(e2.message);
    }
    localStorage.setItem(`escala-link-${linkId}`, token);
    await copyToClipboard(linkUrl(token));
    toast.success('Link do gestor copiado. Ele poderá editar e gerar esta escala (válido por 90 dias).');
    load();
  };
  return (
    <Card className="p-4 mt-3 space-y-2">
      <div className="flex justify-between"><h3 className="font-semibold">Escalas da empresa</h3><Button size="sm" onClick={nova}><Plus className="w-4 h-4 mr-1" />Nova escala</Button></div>
      {!itens.length && <p className="text-sm text-muted-foreground">Nenhuma escala ainda.</p>}
      {itens.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
          <button className="font-medium hover:underline text-left" onClick={() => onAbrir(e.id)}>{e.titulo} {e.setor && `— ${e.setor}`}</button>
          <span className="text-muted-foreground">{fmtBRAno(e.data_inicio)} a {fmtBRAno(e.data_fim)}</span>
          <StatusBadge s={e.status} />{e.origem === 'publica' && <Badge variant="outline">Cliente</Badge>}
          {e.link_id && <Badge variant="outline">Com link</Badge>}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => linkGestor(e)}><Link2 className="w-4 h-4 mr-1" />Link para o gestor</Button>
          <Button variant="ghost" size="icon" onClick={() => excluir(e.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>))}
    </Card>
  );
}

function Recebidas({ clientes, onAbrir }: { clientes: { id: string; nome: string }[]; onAbrir: (id: string) => void }) {
  const [status, setStatus] = useState('');
  const [cli, setCli] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      let q = supabase.from('escalas_revezamento' as any).select('*').eq('origem', 'publica').order('enviado_em', { ascending: false, nullsFirst: false });
      if (status) q = q.eq('status', status);
      if (cli) q = q.eq('cliente_id', cli);
      const { data } = await q; setItens((data as any[]) || []);
    })();
  }, [status, cli]);
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome || '—';
  return (
    <Card className="p-4 mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={sel} value={cli} onChange={(e) => setCli(e.target.value)}>
          <option value="">Todos os clientes</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      {!itens.length && <p className="text-sm text-muted-foreground">Nenhuma escala recebida.</p>}
      {itens.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
          <button className="font-medium hover:underline" onClick={() => onAbrir(e.id)}>{nome(e.cliente_id)}</button>
          <span>{e.setor || e.titulo}</span>
          <span className="text-muted-foreground">por {e.preenchido_por_nome || '—'} ({e.preenchido_por_contato || '—'})</span>
          {e.enviado_em && <span className="text-muted-foreground">enviada {new Date(e.enviado_em).toLocaleString('pt-BR')}</span>}
          <StatusBadge s={e.status} />{e.status === 'enviada' && !e.visto_escritorio && <Badge variant="destructive">Nova</Badge>}
        </div>))}
    </Card>
  );
}

function EscalaView({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [esc, setEsc] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [params, setParams] = useState<EscalaParams | null>(null);
  const [funcs, setFuncs] = useState<EscalaFuncionario[]>([]);
  const [titulo, setTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [devolver, setDevolver] = useState(false);
  const [obs, setObs] = useState('');
  const [estado, setEstado] = useState<'salvo' | 'salvando' | 'pendente'>('salvo');
  const pronto = useRef(false);
  const fila = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    const r = await carregarEscala(supabase, id);
    if (!r) { sessionStorage.removeItem('escala-aberta'); onVoltar(); return; }
    let e = r.escala;
    if (e.origem === 'publica' && e.status === 'enviada') {
      await supabase.from('escalas_revezamento' as any).update({ status: 'em_revisao', visto_escritorio: true } as any).eq('id', id);
      e = { ...e, status: 'em_revisao', visto_escritorio: true };
    }
    setEsc(e); setParams(paramsDe(e)); setFuncs(r.funcionarios); setTitulo(e.titulo); setObs(e.observacao_escritorio || '');
    const { data: c } = await supabase.from('clientes' as any).select('nome, cnpj, cnae').eq('id', e.cliente_id).maybeSingle();
    setCliente(c);
    pronto.current = false;
    setTimeout(() => { pronto.current = true; }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // salvamento automático do rascunho (parâmetros, funcionários importados, folgas)
  useEffect(() => {
    if (!pronto.current || !params || esc?.status === 'aprovada') return;
    setEstado('pendente');
    const t = setTimeout(() => {
      const patch: Record<string, unknown> = { titulo };
      PARAM_KEYS.forEach((k) => { patch[k] = params[k]; });
      const snap = funcs;
      fila.current = fila.current.then(async () => {
        setEstado('salvando');
        try { await salvarEscala(supabase, id, patch, snap); setEstado('salvo'); }
        catch (e: any) { setEstado('pendente'); toast.error('Falha ao salvar rascunho: ' + e.message); }
      });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, funcs, titulo]);
  useEffect(() => {
    const h = (ev: BeforeUnloadEvent) => { if (estado !== 'salvo') { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [estado]);

  const salvar = async (extra: Record<string, unknown> = {}) => {
    if (!params) return;
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = { titulo, ...extra };
      PARAM_KEYS.forEach((k) => { patch[k] = params[k]; });
      await fila.current;
      await salvarEscala(supabase, id, patch, funcs);
      setEstado('salvo');
      toast.success('Escala salva.');
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSalvando(false); }
  };

  if (!esc || !params) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const info = { cliente: cliente || {}, params, funcionarios: funcs, aprovadoEm: esc.status === 'aprovada' ? esc.aprovado_em : null };
  const aprovar = async () => {
    try { gerarPdf({ ...info, aprovadoEm: new Date().toISOString() }, true); }
    catch (e: any) { return toast.error(e.message); }
    const { data: u } = await supabase.auth.getUser();
    await salvar({ status: 'aprovada', aprovado_em: new Date().toISOString(), aprovado_por: u.user?.id });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onVoltar}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        <Input className="w-72" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <StatusBadge s={esc.status} />
        {esc.status !== 'aprovada' && <span className="text-xs text-muted-foreground">{estado === 'salvo' ? 'Rascunho salvo' : estado === 'salvando' ? 'Salvando…' : 'Alterações não salvas'}</span>}
        <span className="text-sm text-muted-foreground">{cliente?.nome}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { try { gerarPdf(info, false); } catch (e: any) { toast.error(e.message); } }}><FileDown className="w-4 h-4 mr-1" />PDF</Button>
          <Button variant="outline" onClick={() => { try { gerarPdf(info, true); } catch (e: any) { toast.error(e.message); } }}><FileDown className="w-4 h-4 mr-1" />PDF final</Button>
          <Button variant="outline" onClick={() => gerarXlsx(info)}><FileSpreadsheet className="w-4 h-4 mr-1" />XLSX</Button>
          <Button onClick={() => salvar()} disabled={salvando}><Save className="w-4 h-4 mr-1" />Salvar</Button>
        </div>
      </div>
      {esc.origem === 'publica' && (
        <Card className="p-3 flex flex-wrap items-center gap-3 text-sm">
          <span>Preenchida por <b>{esc.preenchido_por_nome || '—'}</b> ({esc.preenchido_por_contato || '—'}){esc.aceite_lgpd_em && ` · ciência LGPD em ${new Date(esc.aceite_lgpd_em).toLocaleString('pt-BR')}`}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={aprovar} disabled={salvando || esc.status === 'aprovada'}><CheckCircle2 className="w-4 h-4 mr-1" />Aprovar</Button>
            <Button size="sm" variant="outline" onClick={() => setDevolver(true)} disabled={salvando}><Undo2 className="w-4 h-4 mr-1" />Devolver com observação</Button>
          </div>
        </Card>
      )}
      {esc.origem !== 'publica' && esc.status !== 'aprovada' && (
        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={aprovar}><CheckCircle2 className="w-4 h-4 mr-1" />Marcar como aprovada</Button></div>
      )}
      <EscalaEditor params={params} onParams={setParams} funcionarios={funcs} onFuncionarios={setFuncs} cliente={cliente || undefined} />
      <Dialog open={devolver} onOpenChange={setDevolver}>
        <DialogContent>
          <DialogHeader><DialogTitle>Devolver ao cliente</DialogTitle></DialogHeader>
          <Textarea rows={5} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="O que o cliente precisa ajustar?" />
          <DialogFooter><Button disabled={!obs.trim()} onClick={async () => { setDevolver(false); await salvar({ status: 'devolvida', observacao_escritorio: obs.trim() }); }}><Send className="w-4 h-4 mr-1" />Devolver</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinksPublicos({ clienteId, clienteNome }: { clienteId: string; clienteNome: string }) {
  const [itens, setItens] = useState<any[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [validade, setValidade] = useState('30');
  const [pin, setPin] = useState('');
  const [limite, setLimite] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('escala_links_publicos' as any).select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false });
    setItens((data as any[]) || []);
    const { data: es } = await supabase.from('escalas_revezamento' as any).select('link_id').eq('cliente_id', clienteId).not('link_id', 'is', null);
    const c: Record<string, number> = {}; ((es as any[]) || []).forEach((e) => { c[e.link_id] = (c[e.link_id] || 0) + 1; }); setContagem(c);
  }, [clienteId]);
  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    if (pin && !/^\d{4,6}$/.test(pin)) return toast.error('O PIN deve ter de 4 a 6 dígitos.');
    const token = novoToken(); const th = await sha256(token);
    const { data: u } = await supabase.auth.getUser();
    const expira = validade === '0' ? null : new Date(Date.now() + Number(validade) * 86400000).toISOString();
    const { data, error } = await supabase.from('escala_links_publicos' as any).insert({
      cliente_id: clienteId, token_hash: th, pin_hash: pin ? await sha256(`${pin}:${th}`) : null, expira_em: expira,
      limite_escalas: limite ? Number(limite) : null, created_by: u.user?.id,
    } as any).select('id').single();
    if (error) return toast.error(error.message);
    localStorage.setItem(`escala-link-${(data as any).id}`, token);
    await copyToClipboard(linkUrl(token));
    toast.success('Link criado e copiado.');
    setOpen(false); setPin(''); setLimite(''); load();
  };
  const regenerar = async (l: any) => {
    const novoPin = l.pin_hash ? prompt('Novo PIN (4 a 6 dígitos) — deixe vazio para remover o PIN:') ?? '' : '';
    if (novoPin && !/^\d{4,6}$/.test(novoPin)) return toast.error('PIN inválido.');
    const token = novoToken(); const th = await sha256(token);
    await supabase.from('escala_links_publicos' as any).update({ token_hash: th, pin_hash: novoPin ? await sha256(`${novoPin}:${th}`) : null, revogado_em: null } as any).eq('id', l.id);
    localStorage.setItem(`escala-link-${l.id}`, token);
    await copyToClipboard(linkUrl(token)); toast.success('Novo link gerado e copiado. O anterior deixou de funcionar.'); load();
  };
  const revogar = async (l: any) => { if (!confirm('Revogar este link?')) return; await supabase.from('escala_links_publicos' as any).update({ revogado_em: new Date().toISOString() } as any).eq('id', l.id); load(); };
  const status = (l: any) => (l.revogado_em ? 'revogado' : l.expira_em && new Date(l.expira_em) < new Date() ? 'expirado' : 'ativo');

  return (
    <Card className="p-4 mt-3 space-y-3">
      <div className="flex justify-between"><h3 className="font-semibold">Links públicos</h3><Button size="sm" onClick={() => setOpen(true)}><Link2 className="w-4 h-4 mr-1" />Gerar link público</Button></div>
      <p className="text-xs text-muted-foreground">Por segurança só o código embaralhado do link fica guardado. "Copiar" funciona no navegador em que o link foi gerado; em outro, use "Regenerar".</p>
      {itens.map((l) => {
        const tok = localStorage.getItem(`escala-link-${l.id}`); const st = status(l);
        const url = tok ? linkUrl(tok) : '';
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
            <Badge variant={st === 'ativo' ? 'default' : 'secondary'}>{st}</Badge>
            <span>Criado {new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
            <span className="text-muted-foreground">Último acesso: {l.ultimo_acesso_em ? new Date(l.ultimo_acesso_em).toLocaleString('pt-BR') : '—'}</span>
            <span className="text-muted-foreground">Escalas: {contagem[l.id] || 0}{l.limite_escalas ? `/${l.limite_escalas}` : ''}</span>
            {l.pin_hash && <Badge variant="outline">PIN</Badge>}
            {l.expira_em && <span className="text-muted-foreground">expira {new Date(l.expira_em).toLocaleDateString('pt-BR')}</span>}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" disabled={!tok || st !== 'ativo'} onClick={async () => { await copyToClipboard(url); toast.success('Link copiado.'); }}><Copy className="w-4 h-4 mr-1" />Copiar link</Button>
              <Button size="sm" variant="outline" disabled={!tok || st !== 'ativo'} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link para elaborar a escala de revezamento de folgas da ${clienteNome}: ${url}`)}`, '_blank')}>Enviar por WhatsApp</Button>
              <Button size="sm" variant="outline" onClick={() => regenerar(l)}><RefreshCw className="w-4 h-4 mr-1" />Regenerar</Button>
              {st === 'ativo' && <Button size="sm" variant="outline" onClick={() => revogar(l)}><ShieldOff className="w-4 h-4 mr-1" />Revogar</Button>}
            </div>
          </div>);
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar link público — {clienteNome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Validade</Label>
              <select className={sel + ' w-full'} value={validade} onChange={(e) => setValidade(e.target.value)}>
                <option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="0">Sem expiração</option>
              </select></div>
            <div><Label>PIN (opcional, 4 a 6 dígitos)</Label><Input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
            <div><Label>Limite de escalas (opcional)</Label><Input type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={criar}>Gerar e copiar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
