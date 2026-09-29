import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Medal, Trophy, MinusCircle, FileDown, Copy, RefreshCw, Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toBlob } from 'html-to-image';
import { brl, fmtComp, shiftComp } from '@/modules/premiacao/hooks/usePremiacao';
import { pdfExtrato, pdfApuracao, pdfRegulamento } from '@/modules/premiacao/utils/pdfs';

const callEdge = async (token: string, senha: string, action: string, extra: Record<string, unknown> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/premiacao-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, senha, action, ...extra }),
  });
  return res.json();
};

const compAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function PremiacaoGestorPage() {
  const { token = '' } = useParams();
  const [senha, setSenha] = useState(sessionStorage.getItem(`prem-gestor-${token}`) || '');
  const [senhaInput, setSenhaInput] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<any>(null);
  const [competencia, setCompetencia] = useState(compAtual());

  const load = async (pwd: string) => {
    setLoading(true);
    const r = await callEdge(token, pwd, 'get_bundle');
    setLoading(false);
    if (r.requires_password) { setNeedPass(true); setWrong(!!r.wrong); return; }
    if (r.error) { setBundle(null); setNeedPass(false); toast.error(r.error); return; }
    setNeedPass(false); setBundle(r);
    sessionStorage.setItem(`prem-gestor-${token}`, pwd);
  };
  useEffect(() => { load(senha); }, [token]);

  const cat = useMemo(() => {
    if (!bundle) return null;
    const referencias = bundle.referencias || [];
    const versoes = bundle.versoes || [];
    return {
      medalhas: bundle.medalhas, servicos: bundle.servicos, metas: bundle.metas,
      metasServicos: bundle.metas_servicos, desabonos: bundle.desabonos,
      referencias, colaboradores: bundle.colaboradores, cargos: bundle.cargos,
      versoes, ciencias: [], versaoVigente: versoes[0] || null, reload: () => {},
      refDe: (c: any) => {
        const r = referencias.find((x: any) => x.cargo_id === c.cargo_id)
          || referencias.find((x: any) => x.funcao === c.funcao);
        return r?.pontuacao_referencia ?? 0;
      },
      funcaoDe: (c: any) => c.funcao || bundle.cargos.find((x: any) => x.id === c.cargo_id)?.nome || '—',
    };
  }, [bundle]);

  if (loading && !bundle) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (needPass) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm"><CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /><h1 className="font-bold text-lg">Acesso do gestor</h1></div>
        <p className="text-sm text-muted-foreground">Digite a senha deste link para continuar.</p>
        <Input type="password" placeholder="Senha" value={senhaInput} onChange={e => setSenhaInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setSenha(senhaInput), load(senhaInput))} />
        {wrong && <p className="text-sm text-destructive">Senha incorreta.</p>}
        <Button className="w-full" onClick={() => { setSenha(senhaInput); load(senhaInput); }}>Entrar</Button>
      </CardContent></Card>
    </div>
  );

  if (!bundle || !cat) return <div className="min-h-screen flex items-center justify-center p-4"><p className="text-muted-foreground">Link inválido ou desativado.</p></div>;

  const politica = bundle.politica;
  const empresa = bundle.cliente?.nome_fantasia || bundle.cliente?.nome || '';
  const logo = bundle.cliente?.logo_url || bundle.branding?.logo_url;
  const versoes = bundle.versoes || [];
  const versaoVigente = versoes.find((v: any) => v.vigencia_inicio <= competencia) || versoes[0];

  const call = (action: string, extra: Record<string, unknown> = {}) => callEdge(token, senha, action, extra);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {logo && <img src={logo} alt="" className="h-10 w-auto rounded bg-white/90 p-1" />}
          <div>
            <h1 className="font-bold text-lg leading-tight">{politica.nome}</h1>
            <p className="text-xs opacity-90">{empresa} · Área do gestor</p>
          </div>
          <div className="ml-auto">
            <Label className="text-[10px] opacity-80">Competência</Label>
            <Input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="h-8 w-36 bg-white text-foreground" />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="lancar">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="lancar">Lançar ocorrência</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            <TabsTrigger value="apuracao">Apuração</TabsTrigger>
            <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
          </TabsList>
          <TabsContent value="lancar"><LancarTab cat={cat} competencia={competencia} call={call} onDone={() => load(senha)} /></TabsContent>
          <TabsContent value="colaboradores"><ColaboradoresTab cat={cat} call={call} onDone={() => load(senha)} /></TabsContent>
          <TabsContent value="extrato"><ExtratoGestor politica={politica} cat={cat} competencia={competencia} empresa={empresa} call={call} /></TabsContent>
          <TabsContent value="apuracao"><ApuracaoGestor politica={politica} cat={cat} competencia={competencia} empresa={empresa} call={call} /></TabsContent>
          <TabsContent value="regulamento">
            <Card><CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Regulamento vigente{versaoVigente ? ` — versão ${versaoVigente.versao}, vigente desde ${versaoVigente.vigencia_inicio}` : ''}.</p>
              {versaoVigente
                ? <Button onClick={() => pdfRegulamento({ politica, cat, versao: versaoVigente, empresa }).save(`regulamento-${politica.nome.replace(/\s+/g, '_')}.pdf`)}><FileDown className="w-4 h-4 mr-1" />Gerar PDF do regulamento</Button>
                : <p className="text-sm">Nenhuma versão de regulamento gerada ainda.</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Lançar ocorrência ----------
function LancarTab({ cat, competencia, call, onDone }: any) {
  const [colabId, setColabId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [qtd, setQtd] = useState(1);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState('');
  const [os, setOs] = useState('');
  const [busy, setBusy] = useState(false);

  const serv = cat.servicos.find((s: any) => s.codigo === codigo);
  const des = cat.desabonos.find((d: any) => d.codigo === codigo);
  const item = serv || des;

  const lancar = async () => {
    if (!colabId || !codigo) { toast.error('Selecione o colaborador e o código'); return; }
    setBusy(true);
    const r = await call('lancar', { colaborador_id: colabId, competencia, codigo, quantidade: qtd, data_ocorrencia: data, observacao: obs, referencia_os: os });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success('Ocorrência lançada');
    setCodigo(''); setQtd(1); setObs(''); setOs('');
    onDone();
  };

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label className="text-xs">Colaborador</Label>
          <Select value={colabId} onValueChange={setColabId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Código</Label>
          <Select value={codigo} onValueChange={setCodigo}><SelectTrigger><SelectValue placeholder="Selecione o código" /></SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Serviços (medalhas)</div>
              {cat.servicos.filter((s: any) => s.ativo).map((s: any) => <SelectItem key={s.id} value={s.codigo}>{s.codigo} — {s.descricao}</SelectItem>)}
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Desabonos</div>
              {cat.desabonos.filter((d: any) => d.ativo).map((d: any) => <SelectItem key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</SelectItem>)}
            </SelectContent></Select></div>
      </div>
      {item && <div className="rounded bg-muted p-2 text-sm">{item.descricao}{serv ? (serv.gera_pontos ? ' · gera pontos' : ' · não gera pontos') : ` · −${item.pontos} pts`}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Quantidade</Label><Input type="number" min={1} value={qtd} onChange={e => setQtd(Number(e.target.value) || 1)} /></div>
        <div><Label className="text-xs">Data</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
        <div className="col-span-2"><Label className="text-xs">OS / referência (opcional)</Label><Input value={os} onChange={e => setOs(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Observação{des ? ' (obrigatória para desabono)' : ''}</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
      <Button onClick={lancar} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-1" />}Lançar</Button>
    </CardContent></Card>
  );
}

// ---------- Colaboradores ----------
function ColaboradoresTab({ cat, call, onDone }: any) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!nome.trim()) { toast.error('Informe o nome'); return; }
    setBusy(true);
    const funcao = cat.cargos.find((c: any) => c.id === cargoId)?.nome || null;
    const r = await call('add_colaborador', { nome, codigo, cargo_id: cargoId || null, funcao });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success('Colaborador cadastrado');
    setNome(''); setCodigo(''); setCargoId('');
    onDone();
  };

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="grid md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2"><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
        <div><Label className="text-xs">Código (opcional)</Label><Input value={codigo} onChange={e => setCodigo(e.target.value)} /></div>
        <div><Label className="text-xs">Função</Label>
          <Select value={cargoId} onValueChange={setCargoId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.cargos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <Button onClick={add} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-1" />}Cadastrar</Button>
      <table className="w-full text-sm">
        <thead><tr className="bg-primary text-primary-foreground"><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Função</th><th className="p-2 text-right">Referência</th></tr></thead>
        <tbody>{cat.colaboradores.map((c: any, i: number) => (
          <tr key={c.id} className={i % 2 ? 'bg-muted/40' : ''}>
            <td className="p-2">{c.codigo || '—'}</td><td className="p-2">{c.nome}</td>
            <td className="p-2">{cat.funcaoDe(c)}</td><td className="p-2 text-right">{cat.refDe(c)}</td>
          </tr>))}</tbody>
      </table>
    </CardContent></Card>
  );
}

// ---------- Extrato ----------
function ExtratoGestor({ politica, cat, competencia, empresa, call }: any) {
  const [colabId, setColabId] = useState('');
  const [lancs, setLancs] = useState<any[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [oficial, setOficial] = useState<any>(null);
  const [verRel, setVerRel] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = cat.colaboradores.find((x: any) => x.id === colabId);

  const load = async () => {
    if (!colabId) { setLancs([]); setOficial(null); return; }
    const [l, ant, ap] = await Promise.all([
      call('list_lancamentos', { competencia, colaborador_id: colabId }),
      call('saldo_anterior', { competencia }),
      call('list_apuracoes', { competencia }),
    ]);
    setLancs(l.items || []);
    setSaldoInicial(ant.saldos?.[colabId] ?? 0);
    setOficial((ap.items || []).find((x: any) => x.colaborador_id === colabId) || null);
  };
  useEffect(() => { load(); }, [colabId, competencia]);

  const a = useMemo(() => {
    if (!c || !colabId) return null;
    const medalhasContagem: Record<string, number> = {};
    let pontosMedalhas = 0, pontosDesabonos = 0;
    lancs.forEach(l => {
      if (l.tipo === 'desabono') { pontosDesabonos += l.pontos_total; return; }
      if (l.tipo === 'servico' && l.gera_pontos) {
        const s = cat.servicos.find((x: any) => x.id === l.servico_id);
        const md = cat.medalhas.find((m: any) => m.id === s?.medalha_id);
        if (md) medalhasContagem[md.nome] = (medalhasContagem[md.nome] || 0) + l.quantidade;
        pontosMedalhas += l.pontos_total;
      } else if (l.tipo === 'ajuste' && l.gera_pontos) pontosMedalhas += l.pontos_total;
    });
    const trofeus = cat.metas.filter((m: any) => m.ativo).map((m: any) => {
      let realizado: number | null = null;
      if (m.modo_apuracao === 'automatico') {
        const links = cat.metasServicos.filter((ms: any) => ms.meta_id === m.id);
        realizado = links.reduce((s: number, lk: any) => s + lancs.filter(l => l.servico_id === lk.servico_id).reduce((q, l) => q + l.quantidade, 0) * lk.peso_contagem, 0);
      }
      const atingida = m.modo_apuracao === 'manual' ? false : (realizado ?? 0) >= m.quantidade_alvo;
      return { meta_id: m.id, nome: m.nome, realizado, alvo: m.quantidade_alvo, unidade: m.unidade, atingida, pontos: atingida ? m.pontos_trofeu : 0 };
    });
    let pontosTrofeus = trofeus.reduce((s: number, t: any) => s + t.pontos, 0);
    if (politica.teto_mensal_pontos && pontosMedalhas + pontosTrofeus > politica.teto_mensal_pontos)
      pontosTrofeus = Math.max(0, politica.teto_mensal_pontos - pontosMedalhas);
    const saldo = saldoInicial + pontosMedalhas + pontosTrofeus - pontosDesabonos;
    const referencia = cat.refDe(c);
    const premiaveis = saldo > referencia ? saldo : 0;
    return {
      id: oficial?.id || '', colaborador_id: colabId, competencia, saldo_inicial: saldoInicial,
      pontos_medalhas: pontosMedalhas, medalhas_contagem: medalhasContagem, pontos_trofeus: pontosTrofeus,
      trofeus_conquistados: trofeus, pontos_desabonos: pontosDesabonos, saldo_apurado: saldo,
      pontuacao_referencia: referencia, pontos_premiaveis: premiaveis, valor_ponto: politica.valor_ponto,
      valor_bonificacao: Math.round(premiaveis * politica.valor_ponto * 100) / 100,
      saldo_transportado: saldo < 0 ? saldo : 0, status: oficial?.status || 'aberta',
    };
  }, [c, colabId, lancs, saldoInicial, oficial, cat, politica, competencia]);

  const linha = (l: string, v: string | number, cls = '') => <div className={`flex justify-between border-b border-dotted py-1 ${cls}`}><span>{l}</span><span className="font-semibold">{v}</span></div>;

  const copiar = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('falha');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Imagem copiada — cole no WhatsApp');
      } catch {
        const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `extrato-${competencia}.png`; a2.click();
        toast.info('Não foi possível copiar; a imagem foi baixada.');
      }
    } catch { toast.error('Não foi possível gerar a imagem.'); } finally { setBusy(false); }
  };

  const quadro = a && (
    <div className="rounded-lg border p-3 text-sm bg-background">
      {linha(`Saldo inicial (transportado de ${fmtComp(shiftComp(competencia, -1))})`, a.saldo_inicial)}
      {linha('(+) Medalhas', a.pontos_medalhas)}
      {linha('(+) Troféus', a.pontos_trofeus)}
      {linha('(−) Desabonos', a.pontos_desabonos)}
      {linha('(=) Saldo do mês', a.saldo_apurado)}
      {a.saldo_apurado >= 0 ? (<>
        {linha('Pontuação de referência (gatilho)', a.pontuacao_referencia)}
        {linha('Pontos premiados', a.pontos_premiaveis)}
        <div className="flex justify-between mt-2 rounded bg-primary text-primary-foreground px-2 py-1.5 font-bold"><span>Prêmio</span><span>{brl(a.valor_bonificacao)}</span></div>
      </>) : (
        <p className="text-destructive font-semibold mt-2">Saldo negativo de {a.saldo_apurado} pontos transportado para {fmtComp(shiftComp(competencia, 1))}. Não há desconto em folha.</p>
      )}
    </div>
  );

  const cards = a && (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {cat.medalhas.filter((m: any) => m.ativo).map((m: any) => (
        <div key={m.id} className="rounded-lg p-3 text-center text-white" style={{ background: m.cor_hex }}><Medal className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">{m.nome}</div><div className="text-2xl font-bold">{a.medalhas_contagem?.[m.nome] || 0}</div></div>
      ))}
      <div className="rounded-lg p-3 text-center bg-primary text-primary-foreground"><Trophy className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Troféus</div><div className="text-2xl font-bold">{a.trofeus_conquistados.filter((t: any) => t.atingida).length}</div></div>
      <div className="rounded-lg p-3 text-center bg-destructive text-destructive-foreground"><MinusCircle className="w-5 h-5 mx-auto" /><div className="text-xs font-semibold">Desabonos</div><div className="text-2xl font-bold">−{a.pontos_desabonos}</div></div>
    </div>
  );

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">Colaborador</Label>
          <Select value={colabId} onValueChange={setColabId}><SelectTrigger className="w-72 h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cat.colaboradores.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent></Select></div>
        {colabId && <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Atualizar</Button>}
        {a && c && <>
          <Button size="sm" variant="outline" onClick={() => setVerRel(true)}><Copy className="w-3 h-3 mr-1" />Relatório / imagem</Button>
          <Button size="sm" onClick={() => pdfExtrato({ politica, cat, apuracao: a, colaborador: c, empresa }).save(`extrato-${c.nome.replace(/\s+/g, '_')}-${competencia}.pdf`)}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
        </>}
      </div>
      {a && c && (
        <div className="max-w-2xl space-y-3">
          <Badge variant={oficial ? 'default' : 'outline'}>{oficial ? 'Apuração oficial + lançamentos' : 'Prévia em tempo real (apuração ainda não calculada)'}</Badge>
          <div className="rounded-lg bg-muted p-3 text-sm font-medium">Pontuação de referência da função ({cat.funcaoDe(c)}): {a.pontuacao_referencia} pontos. Ao ultrapassar esse valor, o colaborador recebe o prêmio sobre todos os pontos do mês.</div>
          {cards}
          {quadro}
        </div>
      )}
      <Dialog open={verRel} onOpenChange={setVerRel}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-auto">
          <DialogHeader><DialogTitle>Extrato do colaborador — {fmtComp(competencia)}</DialogTitle></DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={busy} onClick={copiar}><Copy className="w-4 h-4 mr-1" />Copiar imagem</Button>
            {a && c && <Button onClick={() => pdfExtrato({ politica, cat, apuracao: a, colaborador: c, empresa }).save(`extrato-${c.nome.replace(/\s+/g, '_')}-${competencia}.pdf`)}><FileDown className="w-4 h-4 mr-1" />Gerar PDF</Button>}
          </div>
          {a && c && (
            <div ref={ref} className="bg-background text-foreground p-5 rounded-md border space-y-3">
              <div className="h-1 bg-primary rounded" />
              <h3 className="font-bold text-lg">{politica.nome} — Extrato de {c.nome}</h3>
              <p className="text-sm text-muted-foreground">{empresa} · {fmtComp(competencia)}</p>
              <div className="rounded-lg bg-muted p-3 text-sm font-medium">Pontuação de referência da função ({cat.funcaoDe(c)}): {a.pontuacao_referencia} pontos.</div>
              {cards}
              {quadro}
              {lancs.length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="bg-primary text-primary-foreground"><th className="p-1.5 text-left">Data</th><th className="p-1.5 text-left">Código</th><th className="p-1.5 text-left">Descrição</th><th className="p-1.5 text-right">Qtd</th><th className="p-1.5 text-right">Pontos</th></tr></thead>
                  <tbody>{lancs.map((l, i) => (
                    <tr key={l.id} className={i % 2 ? 'bg-muted/40' : ''}>
                      <td className="p-1.5">{l.data_ocorrencia.split('-').reverse().join('/')}</td>
                      <td className="p-1.5 font-mono">{l.codigo}</td><td className="p-1.5">{l.descricao}</td>
                      <td className="p-1.5 text-right">{l.quantidade}</td>
                      <td className="p-1.5 text-right">{l.tipo === 'desabono' ? `−${l.pontos_total}` : l.gera_pontos ? l.pontos_total : '—'}</td>
                    </tr>))}</tbody>
                </table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

// ---------- Apuração ----------
function ApuracaoGestor({ politica, cat, competencia, empresa, call }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await call('list_apuracoes', { competencia });
    setItems(r.items || []);
  };
  useEffect(() => { load(); }, [competencia]);

  const apurar = async () => {
    setBusy(true);
    const r = await call('apurar', { competencia });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success('Apuração calculada');
    load();
  };

  const nomeDe = (id: string) => cat.colaboradores.find((c: any) => c.id === id)?.nome || '—';
  const total = items.reduce((s, x) => s + (x.valor_bonificacao || 0), 0);

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex gap-2">
        <Button onClick={apurar} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Calcular / recalcular apuração de {fmtComp(competencia)}</Button>
        {items.length > 0 && <Button variant="outline" onClick={() => pdfApuracao({ politica, cat, apuracoes: items, competencia, empresa }).save(`apuracao-${competencia}.pdf`)}><FileDown className="w-4 h-4 mr-1" />PDF da apuração</Button>}
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma apuração calculada para esta competência. Clique em calcular.</p> : (
        <>
          <table className="w-full text-sm">
            <thead><tr className="bg-primary text-primary-foreground"><th className="p-2 text-left">Colaborador</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Referência</th><th className="p-2 text-right">Pontos premiados</th><th className="p-2 text-right">Prêmio</th></tr></thead>
            <tbody>{items.map((x, i) => (
              <tr key={x.id} className={i % 2 ? 'bg-muted/40' : ''}>
                <td className="p-2">{nomeDe(x.colaborador_id)}</td>
                <td className="p-2 text-right">{x.saldo_apurado}</td>
                <td className="p-2 text-right">{x.pontuacao_referencia}</td>
                <td className="p-2 text-right">{x.pontos_premiaveis}</td>
                <td className="p-2 text-right font-semibold">{brl(x.valor_bonificacao)}</td>
              </tr>))}</tbody>
          </table>
          <div className="flex justify-end font-bold">Total: {brl(total)}</div>
        </>
      )}
    </CardContent></Card>
  );
}
