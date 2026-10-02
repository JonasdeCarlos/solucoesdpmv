import { useEffect, useMemo, useState } from 'react';
import { lerPdf, textoConfiavel } from '../utils/pdfTexto';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, Plus, Download, Trash2, ArrowLeft, Save, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEmpresas } from '@/modules/taxa-servico/hooks/useTaxaServico';
import { baixarTxt } from '@/modules/taxa-servico/utils/dominioLayout';
import { gerarConteudo, normNome, sugerirTipo, type Lancamento, type Mapa, type TipoValor } from '../utils/conversor';

const db = supabase as any;
const hoje = new Date();
const compPadrao = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const fmtComp = (c: string) => `${c.slice(4, 6)}/${c.slice(0, 4)}`;

interface Conversao { id: string; competencia: string; arquivo_origem: string | null; linhas: Lancamento[]; conteudo_txt: string | null; qtd_lancamentos: number; status: string; created_at: string }

const toDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

export default function ConversorDominioPage() {
  const empresas = useEmpresas();
  const [busca, setBusca] = useState('');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [codEmpresa, setCodEmpresa] = useState('');
  const [tipoProc, setTipoProc] = useState('11');
  const [conversoes, setConversoes] = useState<Conversao[]>([]);
  const [mapas, setMapas] = useState<Record<string, Mapa>>({});
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Partial<Conversao> | null>(null);

  const empresa = empresas.find((e) => e.id === empresaId);
  const filtradas = empresas.filter((e) => normNome(e.nome).includes(normNome(busca)) || (e.cnpj || '').includes(busca)).slice(0, 30);

  const reload = async () => {
    if (!empresaId) return;
    const [c, m, f, k] = await Promise.all([
      db.from('cl_config').select('*').eq('empresa_id', empresaId).maybeSingle(),
      db.from('cl_mapeamentos').select('*').eq('empresa_id', empresaId).not('evento', 'like', '[Ponto]%'),
      db.from('cl_funcionarios').select('*').eq('empresa_id', empresaId),
      db.from('cl_conversoes').select('*').eq('empresa_id', empresaId).order('competencia', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    setCodEmpresa(c.data?.codigo_empresa_dominio || '');
    setTipoProc(c.data?.tipo_processo || '11');
    setMapas(Object.fromEntries((m.data || []).map((x: any) => [x.evento, { evento: x.evento, rubrica: x.rubrica || '', tipo: x.tipo, ignorar: x.ignorar }])));
    setCodigos(Object.fromEntries((f.data || []).map((x: any) => [x.nome_norm, x.codigo])));
    setConversoes(k.data || []);
  };
  useEffect(() => { setEditando(null); reload(); }, [empresaId]);

  const salvarConfig = async () => {
    const { error } = await db.from('cl_config').upsert({ empresa_id: empresaId, codigo_empresa_dominio: codEmpresa || null, tipo_processo: tipoProc || '11' }, { onConflict: 'empresa_id' });
    error ? toast.error(error.message) : toast.success('Configuração salva.');
  };

  if (!empresaId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-primary" /> Conversor de lançamentos Domínio</h2>
          <p className="text-sm text-muted-foreground">Envie a tabela da empresa (Excel, CSV, PDF ou foto) e gere o arquivo de importação da folha por competência.</p>
        </div>
        <Input placeholder="Pesquisar empresa por nome ou CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          {filtradas.map((e) => (
            <button key={e.id} onClick={() => setEmpresaId(e.id)} className="text-left rounded-md border p-3 hover:border-primary hover:bg-primary/5">
              <div className="font-medium">{e.nome}</div>
              <div className="text-xs text-muted-foreground">{e.cnpj || '—'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (editando) {
    return <Editor key={editando.id || 'novo'} empresaId={empresaId} conv={editando} mapasIni={mapas} codigosIni={codigos}
      codEmpresa={codEmpresa} tipoProc={tipoProc} onClose={() => { setEditando(null); reload(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEmpresaId(null)}><ArrowLeft className="w-4 h-4 mr-1" />Empresas</Button>
        <h2 className="text-xl font-bold flex-1 truncate">{empresa?.nome}</h2>
        <Button onClick={() => setEditando({ competencia: compPadrao, linhas: [] })}><Plus className="w-4 h-4 mr-1" />Nova conversão</Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Dados para o Domínio</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Código da empresa no Domínio<Input className="w-40" value={codEmpresa} onChange={(e) => setCodEmpresa(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="text-sm">Tipo de processo<Input className="w-24" value={tipoProc} onChange={(e) => setTipoProc(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          <Button variant="outline" onClick={salvarConfig}><Save className="w-4 h-4 mr-1" />Salvar</Button>
          <span className="text-xs text-muted-foreground">Rubricas memorizadas: {Object.keys(mapas).length} · Funcionários memorizados: {Object.keys(codigos).length}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Conversões por competência</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!conversoes.length && <p className="text-sm text-muted-foreground">Nenhuma conversão ainda.</p>}
          {conversoes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="font-semibold w-20">{fmtComp(c.competencia)}</div>
              <div className="flex-1 text-sm truncate">{c.arquivo_origem || '—'} <span className="text-muted-foreground">· {c.qtd_lancamentos} lançamentos</span></div>
              <Badge variant={c.status === 'gerado' ? 'default' : 'secondary'}>{c.status === 'gerado' ? 'Gerado' : 'Rascunho'}</Badge>
              {c.conteudo_txt && <Button size="sm" variant="outline" onClick={() => baixarTxt(`FOLHA${c.competencia.slice(4)}${c.competencia.slice(0, 4)}-${codEmpresa || '0'}-LANC.txt`, c.conteudo_txt!)}><Download className="w-4 h-4" /></Button>}
              <Button size="sm" variant="outline" onClick={() => setEditando(c)}>Abrir</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm('Excluir esta conversão?')) { await db.from('cl_conversoes').delete().eq('id', c.id); reload(); } }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Editor({ empresaId, conv, mapasIni, codigosIni, codEmpresa, tipoProc, onClose }: {
  empresaId: string; conv: Partial<Conversao>; mapasIni: Record<string, Mapa>; codigosIni: Record<string, string>;
  codEmpresa: string; tipoProc: string; onClose: () => void;
}) {
  const [competencia, setCompetencia] = useState(conv.competencia || compPadrao);
  const [linhas, setLinhas] = useState<Lancamento[]>(conv.linhas || []);
  const [origem, setOrigem] = useState(conv.arquivo_origem || '');
  const [mapas, setMapas] = useState<Record<string, Mapa>>(mapasIni);
  const [codigos, setCodigos] = useState<Record<string, string>>(codigosIni);
  const [lendo, setLendo] = useState(false);
  const [planilha, setPlanilha] = useState<{ aoa: string[][]; cod: number; nome: number; evento: number; valor: number; cols: number[] } | null>(null);

  const eventos = useMemo(() => Array.from(new Set(linhas.map((l) => l.evento))), [linhas]);
  const nomesSemCodigo = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) if (!l.codigo && l.nome) m.set(normNome(l.nome), l.nome);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [linhas]);

  // completa mapas para eventos novos
  useEffect(() => {
    setMapas((prev) => {
      const n = { ...prev }; let mud = false;
      for (const ev of eventos) if (!n[ev]) { n[ev] = { evento: ev, rubrica: '', tipo: sugerirTipo(linhas.filter((l) => l.evento === ev).map((l) => l.valor)), ignorar: false }; mud = true; }
      return mud ? n : prev;
    });
  }, [eventos]);

  const receberLancamentos = (novos: Lancamento[], nome: string) => {
    if (!novos.length) return toast.error('Nenhum lançamento encontrado no arquivo.');
    setLinhas((p) => [...p, ...novos]);
    setOrigem((o) => (o ? `${o}, ${nome}` : nome));
    toast.success(`${novos.length} lançamentos lidos de ${nome}.`);
  };

  const onArquivo = async (files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    const ext = f.name.toLowerCase().split('.').pop() || '';
    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const aoa = (XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as any[][])
        .map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
      if (aoa.length < 2) return toast.error('Planilha vazia.');
      const h = aoa[0].map(normNome);
      const cod = h.findIndex((x) => /^(cod|codigo|matricula|cod\.)/.test(x));
      const nome = h.findIndex((x) => /nome|funcionario|empregado|colaborador/.test(x));
      const cols = aoa[0].map((_, i) => i).filter((i) => i !== cod && i !== nome && aoa.slice(1).some((r) => /^[\d.,:hH\sR$-]+$/.test(r[i] || '') && /\d/.test(r[i] || '')));
      setPlanilha({ aoa, cod, nome, evento: -1, valor: -1, cols });
      setOrigem((o) => (o ? `${o}, ${f.name}` : f.name));
      return;
    }
    if (f.size > 15 * 1024 * 1024) return toast.error('Arquivo acima de 15 MB.');
    setLendo(true);
    try {
      const arquivos: { dataUrl: string }[] = []; const textos: string[] = []; let girados = 0;
      for (const x of Array.from(files).slice(0, 8)) {
        arquivos.push({ dataUrl: await toDataUrl(x) });
        if (x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf')) {
          try {
            const pags = await lerPdf(x, 30, false);
            for (const p of pags) { if (textoConfiavel(p.texto)) textos.push(p.texto); if (p.giro) girados++; }
          } catch (err) { console.warn('pdf texto', err); }
        }
      }
      if (girados && textos.length) toast.info(`${girados} página(s) em paisagem detectadas — leitura feita pelo texto do PDF.`);
      const [a, b, c] = await Promise.all([
        db.from('cl_funcionarios').select('nome,codigo').eq('empresa_id', empresaId),
        db.from('fb_funcionarios').select('nome,codigo').eq('empresa_id', empresaId),
        db.from('ts_funcionarios').select('nome,codigo').eq('empresa_id', empresaId),
      ]);
      const vistos = new Set<string>();
      const conhecidos = [...(a.data || []), ...(b.data || []), ...(c.data || [])]
        .filter((x: any) => x?.nome && !vistos.has(normNome(x.nome)) && vistos.add(normNome(x.nome)))
        .map((x: any) => ({ nome: String(x.nome), codigo: String(x.codigo || '') })).slice(0, 600);
      const { data, error } = await supabase.functions.invoke('conversor-extrair-tabela', { body: { arquivos, conhecidos, textos } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data?.suspeitos) toast.warning(`${data.suspeitos} lançamento(s) com nome que não aparece no PDF — confira na lista.`);
      receberLancamentos(data.lancamentos || [], Array.from(files).map((x) => x.name).join(', '));
    } catch (e: any) { toast.error(e.message || 'Falha na leitura'); } finally { setLendo(false); }
  };

  const aplicarPlanilha = () => {
    if (!planilha) return;
    const { aoa, cod, nome, evento, valor, cols } = planilha;
    const head = aoa[0]; const out: Lancamento[] = [];
    for (const r of aoa.slice(1)) {
      const c = cod >= 0 ? String(r[cod] || '').replace(/\D/g, '') : '';
      const n = nome >= 0 ? r[nome] || '' : '';
      if (!c && !n) continue;
      if (/^total/i.test(n)) continue;
      if (evento >= 0 && valor >= 0) { if (r[evento] && r[valor]) out.push({ codigo: c, nome: n, evento: r[evento], valor: r[valor] }); }
      else for (const i of cols) { const v = r[i]; if (v && /\d/.test(v) && !/^0+([.,]0+)?$|^0+:00$/.test(v)) out.push({ codigo: c, nome: n, evento: head[i] || `Coluna ${i + 1}`, valor: v }); }
    }
    setPlanilha(null);
    setLinhas((p) => [...p, ...out]);
    toast.success(`${out.length} lançamentos importados.`);
  };

  const setMapa = (ev: string, patch: Partial<Mapa>) => setMapas((p) => ({ ...p, [ev]: { ...p[ev], ...patch } }));
  const setLinha = (i: number, patch: Partial<Lancamento>) => setLinhas((p) => p.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const persistirMemoria = async () => {
    const mapRows = eventos.filter((e) => mapas[e]).map((e) => ({ empresa_id: empresaId, evento: e, rubrica: mapas[e].rubrica || null, tipo: mapas[e].tipo, ignorar: mapas[e].ignorar }));
    if (mapRows.length) await db.from('cl_mapeamentos').upsert(mapRows, { onConflict: 'empresa_id,evento' });
    const funcRows = new Map<string, any>();
    for (const l of linhas) if (l.nome) {
      const k = normNome(l.nome); const c = l.codigo || codigos[k];
      if (c) funcRows.set(k, { empresa_id: empresaId, nome_norm: k, nome: l.nome, codigo: c });
    }
    if (funcRows.size) await db.from('cl_funcionarios').upsert(Array.from(funcRows.values()), { onConflict: 'empresa_id,nome_norm' });
  };

  const salvar = async (extra: any = {}) => {
    if (!/^\d{6}$/.test(competencia)) { toast.error('Competência inválida.'); return false; }
    await persistirMemoria();
    const payload = { empresa_id: empresaId, competencia, arquivo_origem: origem || null, linhas, qtd_lancamentos: linhas.length, ...extra };
    const { error } = conv.id ? await db.from('cl_conversoes').update(payload).eq('id', conv.id) : await db.from('cl_conversoes').insert(payload).select('id').single().then((r: any) => { if (r.data) conv.id = r.data.id; return r; });
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const gerar = async () => {
    const faltaCod = nomesSemCodigo.filter(([k]) => !codigos[k]);
    if (faltaCod.length) return toast.error(`Informe o código Domínio de ${faltaCod.length} funcionário(s) antes de gerar.`);
    const faltaRub = eventos.filter((e) => !mapas[e]?.ignorar && !/^\d{1,4}$/.test(mapas[e]?.rubrica || ''));
    if (faltaRub.length) return toast.error(`Informe a rubrica de: ${faltaRub.join(', ')} (ou marque Ignorar).`);
    const r = gerarConteudo(linhas, mapas, codigos, competencia, tipoProc, codEmpresa || null);
    if (r.erros.length) { toast.error(r.erros.slice(0, 3).join('\n')); return; }
    if (await salvar({ conteudo_txt: r.conteudo, status: 'gerado', qtd_lancamentos: r.linhas.length })) {
      baixarTxt(`FOLHA${competencia.slice(4)}${competencia.slice(0, 4)}-${codEmpresa || '0'}-LANC.txt`, r.conteudo);
      toast.success(`Arquivo gerado com ${r.linhas.length} lançamentos.`);
    }
  };

  const mes = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        <h2 className="text-xl font-bold flex-1">Conversão de lançamentos</h2>
        <label className="text-sm flex items-center gap-2">Competência
          <Input type="month" className="w-40" value={mes} onChange={(e) => setCompetencia(e.target.value.replace('-', ''))} /></label>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">1. Enviar arquivo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input type="file" multiple accept=".xlsx,.xls,.csv,.ods,application/pdf,image/*" disabled={lendo} onChange={(e) => { onArquivo(e.target.files); e.target.value = ''; }} />
          <p className="text-xs text-muted-foreground">Excel/CSV: você indica as colunas. PDF ou foto: a leitura automática (mesma do cartão de ponto) extrai os lançamentos — confira na lista abaixo. Pode enviar mais de um arquivo; os lançamentos se somam.</p>
          {lendo && <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Lendo o arquivo… pode levar até 1 minuto.</p>}
          {planilha && (
            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <div className="flex flex-wrap gap-3 text-sm">
                {(['cod', 'nome', 'evento', 'valor'] as const).map((k) => (
                  <label key={k}>{{ cod: 'Coluna código (opcional)', nome: 'Coluna nome', evento: 'Coluna evento (se 1 linha por lançamento)', valor: 'Coluna valor (idem)' }[k]}
                    <select className="block border rounded h-9 px-2 bg-background" value={planilha[k]} onChange={(e) => setPlanilha({ ...planilha, [k]: Number(e.target.value) })}>
                      <option value={-1}>—</option>
                      {planilha.aoa[0].map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                    </select></label>
                ))}
              </div>
              {(planilha.evento < 0 || planilha.valor < 0) && (
                <div className="text-sm"><div className="font-medium mb-1">Colunas de eventos (uma coluna por evento):</div>
                  <div className="flex flex-wrap gap-3">
                    {planilha.aoa[0].map((h, i) => i === planilha.cod || i === planilha.nome ? null : (
                      <label key={i} className="flex items-center gap-1"><input type="checkbox" checked={planilha.cols.includes(i)}
                        onChange={(e) => setPlanilha({ ...planilha, cols: e.target.checked ? [...planilha.cols, i] : planilha.cols.filter((x) => x !== i) })} />{h || `Coluna ${i + 1}`}</label>
                    ))}
                  </div></div>
              )}
              <div className="flex gap-2"><Button size="sm" onClick={aplicarPlanilha}>Importar lançamentos</Button><Button size="sm" variant="ghost" onClick={() => setPlanilha(null)}>Cancelar</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      {eventos.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">2. Rubricas Domínio por evento</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Fica memorizado para esta empresa; nas próximas vezes já vem preenchido e pode ser alterado.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th>Evento na tabela</th><th className="w-28">Rubrica</th><th className="w-36">Tipo</th><th className="w-20">Ignorar</th></tr></thead>
              <tbody>{eventos.map((ev) => { const m = mapas[ev]; if (!m) return null; return (
                <tr key={ev} className="border-t">
                  <td className="py-1">{ev}</td>
                  <td><Input className={`h-8 ${!m.ignorar && !m.rubrica ? 'border-destructive' : ''}`} value={m.rubrica} disabled={m.ignorar} onChange={(e) => setMapa(ev, { rubrica: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></td>
                  <td><select className="border rounded h-8 px-2 bg-background w-full" value={m.tipo} onChange={(e) => setMapa(ev, { tipo: e.target.value as TipoValor })}>
                    <option value="valor">Valor (R$)</option><option value="horas">Horas (hh:mm)</option><option value="quantidade">Quantidade/dias</option></select></td>
                  <td className="text-center"><input type="checkbox" checked={m.ignorar} onChange={(e) => setMapa(ev, { ignorar: e.target.checked })} /></td>
                </tr>); })}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {nomesSemCodigo.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">3. Código Domínio dos funcionários</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">A tabela não trouxe o código destes funcionários. Confira sempre antes de gerar; os códigos ficam memorizados pelo nome.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {nomesSemCodigo.map(([k, n]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{n}</span>
                  <Input className={`h-8 w-28 ${!codigos[k] ? 'border-destructive' : ''}`} value={codigos[k] || ''} onChange={(e) => setCodigos((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {linhas.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-base">4. Conferência ({linhas.length} lançamentos)</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => confirm('Limpar todos os lançamentos?') && setLinhas([])}>Limpar</Button></CardHeader>
          <CardContent className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card"><tr className="text-left text-muted-foreground"><th className="w-24">Código</th><th>Nome</th><th>Evento</th><th className="w-28">Valor</th><th className="w-10" /></tr></thead>
              <tbody>{linhas.map((l, i) => (
                <tr key={i} className={`border-t ${mapas[l.evento]?.ignorar ? 'opacity-40' : ''}`}>
                  <td><Input className="h-7" value={l.codigo || codigos[normNome(l.nome)] || ''} placeholder="?" onChange={(e) => setLinha(i, { codigo: e.target.value.replace(/\D/g, '') })} /></td>
                  <td className="px-1">{l.nome}</td>
                  <td className="px-1">{l.evento}</td>
                  <td><Input className="h-7" value={l.valor} onChange={(e) => setLinha(i, { valor: e.target.value })} /></td>
                  <td><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLinhas((p) => p.filter((_, k) => k !== i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={async () => { if (await salvar()) toast.success('Rascunho salvo.'); }}><Save className="w-4 h-4 mr-1" />Salvar rascunho</Button>
        <Button onClick={gerar} disabled={!linhas.length}><Wand2 className="w-4 h-4 mr-1" />Gerar arquivo Domínio</Button>
      </div>
    </div>
  );
}
