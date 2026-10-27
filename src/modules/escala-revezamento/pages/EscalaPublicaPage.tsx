import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileDown, FileSpreadsheet, Loader2, Lock, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import EscalaEditor from '../components/EscalaEditor';
import { paramsDe, PARAM_KEYS, STATUS_LABEL, fmtBRAno, type EscalaFuncionario, type EscalaParams } from '../motor';
import { gerarPdf, gerarXlsx } from '../exportar';

export default function EscalaPublicaPage() {
  const { token = '' } = useParams();
  const [pin, setPin] = useState(() => sessionStorage.getItem(`escala-pin-${token}`) || '');
  const [precisaPin, setPrecisaPin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bundle, setBundle] = useState<any>(null);
  const [aberta, setAbertaRaw] = useState<string | null>(() => sessionStorage.getItem(`escala-aberta-${token}`));
  const setAberta = (v: string | null) => { setAbertaRaw(v); if (v) sessionStorage.setItem(`escala-aberta-${token}`, v); else sessionStorage.removeItem(`escala-aberta-${token}`); };

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('escala-publica', { body: { action, token, pin: pin || undefined, ...extra } });
    let d: any = data;
    if (error) { try { d = await (error as any).context?.json(); } catch { /* */ } }
    if (d?.precisa_pin) { setPrecisaPin(true); const e: any = new Error(d.error || 'Informe o PIN.'); e.pin = true; throw e; }
    if (d?.error) { const e: any = new Error(d.error); e.pendencias = d.pendencias; throw e; }
    if (error) throw error;
    return d;
  }, [token, pin]);

  const abrir = useCallback(async () => {
    try { const d = await call('open'); setBundle(d); setPrecisaPin(false); setErro(null); if (pin) sessionStorage.setItem(`escala-pin-${token}`, pin); }
    catch (e: any) { if (e.pin) { if (pin) toast.error(e.message); } else setErro(e.message); }
  }, [call, pin, token]);
  useEffect(() => { abrir(); /* eslint-disable-next-line */ }, []);

  if (erro) return <Centro><h1 className="text-xl font-bold">Indisponível</h1><p className="text-sm text-muted-foreground mt-2">{erro}</p></Centro>;
  if (precisaPin) return (
    <Centro>
      <Lock className="w-8 h-8 mx-auto text-primary" />
      <h1 className="text-lg font-bold mt-2">Informe o PIN de acesso</h1>
      <Input className="mt-3 text-center" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && abrir()} />
      <Button className="mt-3 w-full" onClick={abrir}>Entrar</Button>
    </Centro>);
  if (!bundle) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const cab = (
    <header className="bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        {bundle.branding?.logo_url && <img src={bundle.branding.logo_url} alt="" className="h-10 bg-background rounded p-1" />}
        <div><p className="text-xs opacity-80">{bundle.branding?.office_name || 'Monte Verde Contabilidade'}</p>
          <h1 className="font-bold">{bundle.cliente?.nome}</h1></div>
      </div>
    </header>);

  return (
    <div className="min-h-screen bg-background">
      {cab}
      <main className="max-w-6xl mx-auto p-3 md:p-6">
        {aberta
          ? <EscalaPublicaEditor id={aberta} call={call} cliente={bundle.cliente} onVoltar={() => { setAberta(null); abrir(); }} />
          : <Lista bundle={bundle} call={call} onAbrir={setAberta} />}
      </main>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-4"><Card className="p-6 max-w-sm w-full text-center">{children}</Card></div>;
}

function Lista({ bundle, call, onAbrir }: { bundle: any; call: any; onAbrir: (id: string) => void }) {
  const nova = async () => { try { const d = await call('create'); onAbrir(d.id); } catch (e: any) { toast.error(e.message); } };
  const lim = bundle.limite_escalas;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h2 className="font-semibold">Suas escalas de revezamento</h2>
        <Button size="sm" onClick={nova} disabled={lim && bundle.escalas.length >= lim}><Plus className="w-4 h-4 mr-1" />Nova escala</Button>
      </div>
      {!bundle.escalas.length && <p className="text-sm text-muted-foreground">Nenhuma escala ainda. Clique em "Nova escala" para começar.</p>}
      {bundle.escalas.map((e: any) => (
        <button key={e.id} onClick={() => onAbrir(e.id)} className="w-full text-left border rounded-md p-3 text-sm hover:bg-muted flex flex-wrap gap-2 items-center">
          <span className="font-medium">{e.setor || e.titulo}</span>
          <span className="text-muted-foreground">{fmtBRAno(e.data_inicio)} a {fmtBRAno(e.data_fim)}</span>
          <Badge variant={e.status === 'devolvida' ? 'destructive' : 'secondary'}>{STATUS_LABEL[e.status]}</Badge>
        </button>))}
    </Card>
  );
}

function EscalaPublicaEditor({ id, call, cliente, onVoltar }: { id: string; call: any; cliente: any; onVoltar: () => void }) {
  const [esc, setEsc] = useState<any>(null);
  const [params, setParams] = useState<EscalaParams | null>(null);
  const [funcs, setFuncs] = useState<EscalaFuncionario[]>([]);
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [lgpd, setLgpd] = useState(false);
  const [estado, setEstado] = useState<'salvo' | 'salvando' | 'pendente'>('salvo');
  const [pend, setPend] = useState<string[]>([]);
  const pronto = useRef(false);
  const versao = useRef<string | null>(null);
  const estadoRef = useRef(estado); estadoRef.current = estado;
  const bkKey = 'escala-rascunho-' + id;

  const aplicar = (d: any) => {
    pronto.current = false;
    setEsc(d.escala); setParams(paramsDe(d.escala)); setFuncs(d.funcionarios);
    setNome(d.escala.preenchido_por_nome || ''); setContato(d.escala.preenchido_por_contato || ''); setLgpd(!!d.escala.aceite_lgpd_em);
    versao.current = d.escala.updated_at || null;
    setTimeout(() => { pronto.current = true; }, 0);
  };

  useEffect(() => {
    (async () => {
      try {
        const d = await call('get', { escala_id: id });
        aplicar(d);
        // recupera digitação que não chegou a ser salva (queda de internet, página fechada)
        try {
          const bk = JSON.parse(localStorage.getItem(bkKey) || 'null');
          if (bk && bk.base === (d.escala.updated_at || null) && ['rascunho', 'devolvida'].includes(d.escala.status)) {
            setTimeout(() => { setParams(bk.params); setFuncs(bk.funcs); setNome(bk.nome); setContato(bk.contato); toast.info('Recuperamos alterações que ainda não tinham sido salvas.'); }, 10);
          } else localStorage.removeItem(bkKey);
        } catch { /* ignore */ }
      } catch (e: any) { toast.error(e.message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, call]);

  // espelhamento: traz alterações feitas pelo escritório
  useEffect(() => {
    const iv = setInterval(async () => {
      if (estadoRef.current !== 'salvo' || document.hidden) return;
      try {
        const v = await call('versao', { escala_id: id });
        if (v.versao && Date.parse(v.versao) !== Date.parse(versao.current || '') && estadoRef.current === 'salvo') {
          aplicar(await call('get', { escala_id: id }));
          toast.info('Escala atualizada com alterações do escritório.');
        }
      } catch { /* ignore */ }
    }, 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, call]);

  useEffect(() => {
    const h = (ev: BeforeUnloadEvent) => { if (estadoRef.current !== 'salvo') { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const editavel = esc && ['rascunho', 'devolvida'].includes(esc.status);
  const payload = () => {
    const p: Record<string, unknown> = {}; PARAM_KEYS.forEach((k) => { p[k] = (params as any)[k]; });
    return { escala_id: id, params: p, funcionarios: funcs, preenchido_por_nome: nome, preenchido_por_contato: contato, aceite_lgpd: lgpd };
  };

  // salvamento automático como rascunho
  useEffect(() => {
    if (!pronto.current || !editavel || !params) return;
    setEstado('pendente');
    try { localStorage.setItem(bkKey, JSON.stringify({ base: versao.current, params, funcs, nome, contato })); } catch { /* cheio */ }
    const t = setTimeout(async () => {
      setEstado('salvando');
      try { const r = await call('save', payload()); if (r?.versao) versao.current = r.versao; localStorage.removeItem(bkKey); setEstado('salvo'); } catch (e: any) { toast.error(e.message); setEstado('pendente'); }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, funcs, nome, contato, lgpd]);

  if (!esc || !params) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const info = { cliente: { nome: cliente?.nome, cnpj: cliente?.cnpj }, params, funcionarios: funcs, aprovadoEm: esc.status === 'aprovada' ? esc.aprovado_em : null };

  const enviar = async () => {
    setPend([]);
    try {
      await call('enviar', payload());
      toast.success('Escala enviada para análise do escritório.');
      setEsc({ ...esc, status: 'enviada' });
    } catch (e: any) { setPend(e.pendencias || [e.message]); toast.error('Há pendências que impedem o envio.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onVoltar}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        <Badge variant="secondary">{STATUS_LABEL[esc.status]}</Badge>
        {editavel && <span className="text-xs text-muted-foreground">{estado === 'salvo' ? 'Rascunho salvo' : estado === 'salvando' ? 'Salvando…' : 'Alterações não salvas'}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { try { gerarPdf(info, false); } catch (e: any) { toast.error(e.message); } }}><FileDown className="w-4 h-4 mr-1" />Baixar PDF</Button>
          <Button size="sm" variant="outline" onClick={() => gerarXlsx(info)}><FileSpreadsheet className="w-4 h-4 mr-1" />Baixar XLSX</Button>
          {editavel && <Button size="sm" onClick={enviar}><Send className="w-4 h-4 mr-1" />Enviar para análise do escritório</Button>}
        </div>
      </div>

      {esc.status === 'devolvida' && esc.observacao_escritorio && (
        <Card className="p-4 border-2 border-destructive"><p className="font-semibold text-destructive">Observação do escritório</p><p className="text-sm whitespace-pre-wrap mt-1">{esc.observacao_escritorio}</p></Card>)}
      {!editavel && <Card className="p-3 text-sm">Esta escala está com o escritório ({STATUS_LABEL[esc.status]}) e não pode mais ser editada.</Card>}
      {pend.length > 0 && (
        <Card className="p-4 border-destructive border"><p className="font-semibold text-destructive mb-1">Pendências para envio</p>
          <ul className="text-sm list-disc pl-5 space-y-0.5">{pend.map((p, i) => <li key={i}>{p}</li>)}</ul></Card>)}

      <Card className="p-4 grid gap-3 sm:grid-cols-2">
        <div><Label>Seu nome</Label><Input disabled={!editavel} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label>E-mail ou telefone</Label><Input disabled={!editavel} value={contato} onChange={(e) => setContato(e.target.value)} /></div>
        <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">
          <p><b>Aviso LGPD:</b> os dados dos funcionários informados aqui serão usados exclusivamente para a elaboração da escala de revezamento.</p>
          <label className="flex items-center gap-2 mt-2"><Checkbox disabled={!editavel || !!esc.aceite_lgpd_em} checked={lgpd} onCheckedChange={(c) => setLgpd(!!c)} /> Estou ciente e de acordo.</label>
        </div>
      </Card>

      {lgpd
        ? <EscalaEditor params={params} onParams={setParams} funcionarios={funcs} onFuncionarios={setFuncs} readOnly={!editavel} cliente={info.cliente} />
        : <p className="text-sm text-muted-foreground">Marque a ciência do aviso de LGPD para cadastrar os funcionários.</p>}
    </div>
  );
}
