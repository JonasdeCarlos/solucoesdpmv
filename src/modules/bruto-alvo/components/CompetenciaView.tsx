import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Calculator, ClipboardPaste } from 'lucide-react';
import { fbDb, type FbCompetencia, type FbConfig, type FbFeriado, type FbFuncionario, type FbModelo, type FbRubrica } from '../hooks/useBrutoAlvo';
import { calcular, reverso, sugerirDias, parseHoras, hhmm, unidadesParaMinutos, horasDe, type ItemCfg, type Modo, type Params, type Resultado } from '../utils/motor';
import { gerarTxt } from '../utils/exportTxt';
import { baixarTxt } from '@/modules/taxa-servico/utils/dominioLayout';
import { pdfPrevia, excelPrevia, linhasBloco, type BlocoPrevia } from '../utils/relatorio';
import { fmt, parseNum } from '@/modules/taxa-servico/utils/validacoes';

interface Linha {
  funcId: string; lancId?: string; alvo: number | null; salario: number; admissao: string | null; itens: ItemCfg[];
  unidades: Record<string, number>; res: Resultado | null; diferenca: number | null; erro?: string; status?: string; brutoDominio: number | null;
}
interface Props { empresaNome: string; comp: FbCompetencia; config: FbConfig; rubricas: FbRubrica[]; funcionarios: FbFuncionario[]; feriados: FbFeriado[]; modelos: FbModelo[]; onChanged: () => void }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const compLabel = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;

export default function CompetenciaView({ empresaNome, comp, config, rubricas, funcionarios, feriados, modelos, onChanged }: Props) {
  const [dias, setDias] = useState({ uteis: comp.dias_uteis, dsr: comp.dias_dsr });
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [aberta, setAberta] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const [importar, setImportar] = useState(false);
  const [ordem, setOrdem] = useState<'nome' | 'codigo'>('nome');
  const ativos = useMemo(() => funcionarios.filter((f) => f.ativo).sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome) : a.codigo.localeCompare(b.codigo, undefined, { numeric: true })), [funcionarios, ordem]);
  const variaveis = rubricas.filter((r) => r.ativo && r.tipo === 'variavel').sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const modeloPadrao = modelos.find((m) => m.padrao)?.itens || [];
  const tol = config.tolerancia;

  const params = (l: Linha): Params => ({ salario: l.salario, admissao: l.admissao, competencia: comp.competencia, diasUteis: dias.uteis, diasDsr: dias.dsr, divisor: config.divisor, formato: config.formato_horas, tetoQuinquenio: config.teto_quinquenio, rubricas });

  useEffect(() => {
    (async () => {
      const { data: lancs } = await fbDb.from('fb_lancamentos').select('*, fb_lancamento_itens(*)').eq('competencia_id', comp.id);
      // Bases das competências anteriores (mais recente primeiro) para quem ainda não tem lançamento neste mês
      const { data: antComps } = await fbDb.from('fb_competencias').select('id, competencia').eq('empresa_id', comp.empresa_id).lt('competencia', comp.competencia).order('competencia', { ascending: false }).limit(12);
      const ordemAnt = (antComps || []).map((c: any) => c.id);
      let anteriores: any[] = [];
      if (ordemAnt.length) {
        const { data } = await fbDb.from('fb_lancamentos').select('funcionario_id, competencia_id, bruto_alvo, fb_lancamento_itens(*)').in('competencia_id', ordemAnt);
        anteriores = (data || []).sort((a: any, b: any) => ordemAnt.indexOf(a.competencia_id) - ordemAnt.indexOf(b.competencia_id));
      }
      const map: Record<string, Linha> = {};
      for (const f of funcionarios) {
        const l = (lancs || []).find((x: any) => x.funcionario_id === f.id);
        const ant = l ? null : anteriores.find((x: any) => x.funcionario_id === f.id && x.bruto_alvo != null);
        const itensDb: any[] = l?.fb_lancamento_itens || [];
        const itensAnt: any[] = ant?.fb_lancamento_itens || [];
        const toItem = (i: any, comPonto: boolean): ItemCfg => ({ verba: i.verba, modo: i.modo, percentual: i.percentual != null ? Number(i.percentual) : null, unidades: i.modo === 'horas_fixas' ? Number(i.minutos || 0) : null, horas_ponto: comPonto && i.horas_ponto != null ? Number(i.horas_ponto) : null });
        const itens: ItemCfg[] = itensDb.length
          ? [...itensDb].sort((a, b) => a.ordem - b.ordem).map((i) => toItem(i, true))
          : itensAnt.length ? [...itensAnt].sort((a, b) => a.ordem - b.ordem).map((i) => toItem(i, false))
          : modeloPadrao.map((i) => ({ ...i }));
        const unidades: Record<string, number> = {}; itensDb.forEach((i) => { unidades[i.verba] = Number(i.minutos || 0); });
        const linha: Linha = { funcId: f.id, lancId: l?.id, alvo: l?.bruto_alvo != null ? Number(l.bruto_alvo) : (ant?.bruto_alvo != null ? Number(ant.bruto_alvo) : (f.bruto_alvo_ref ?? null)), salario: l?.salario_base != null ? Number(l.salario_base) : f.salario_base, admissao: l?.data_admissao ?? f.data_admissao, itens, unidades, res: null, diferenca: l?.diferenca != null ? Number(l.diferenca) : null, status: l?.status, brutoDominio: l?.bruto_dominio != null ? Number(l.bruto_dominio) : null };
        if (itensDb.length && linha.admissao) linha.res = calcular(params(linha), unidades, Object.fromEntries(itens.map((i) => [i.verba, i.horas_ponto])));
        map[f.id] = linha;
      }
      setLinhas(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.id, funcionarios.length, rubricas.length]);

  const setL = (id: string, patch: Partial<Linha>) => setLinhas((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const calcLinha = (l: Linha): Linha => {
    if (!l.admissao) return { ...l, erro: 'Sem data de admissão', res: null, status: 'erro' };
    if (l.alvo == null || !(l.alvo > 0)) return { ...l, erro: undefined, res: null, status: undefined };
    if (l.itens.filter((i) => i.modo === 'ajuste').length !== 1) return { ...l, erro: 'Defina exatamente uma verba de ajuste', res: null, status: 'erro' };
    const r = reverso(params(l), l.itens, l.alvo, config.criterio_ajuste);
    if (r.erro) return { ...l, erro: r.erro, res: r.resultado, unidades: {}, diferenca: r.diferenca, status: 'erro' };
    return { ...l, erro: undefined, res: r.resultado, unidades: r.unidades, diferenca: r.diferenca, status: Math.abs(r.diferenca) <= tol ? 'ok' : 'alerta' };
  };

  const persistir = async (l: Linha) => {
    const res = l.res;
    const row = {
      competencia_id: comp.id, funcionario_id: l.funcId, salario_base: l.salario, data_admissao: l.admissao, anos_completos: res?.anos ?? null, perc_quinquenio: res?.percQuinq ?? null,
      valor_quinquenio: res?.valorQuinq ?? null, hora_base: res?.horaBase ?? null, bruto_alvo: l.alvo, bruto_previsto: res?.bruto ?? null, diferenca: l.diferenca,
      bruto_dominio: l.brutoDominio, diferenca_dominio: l.brutoDominio != null && res ? Math.round((l.brutoDominio - res.bruto) * 100) / 100 : null, status: l.status ?? null,
      detalhe: res ? { dsr_noturno: res.dsrNoturno, dsr_extras: res.dsrExtras } : null,
    };
    const { data, error } = await fbDb.from('fb_lancamentos').upsert(row, { onConflict: 'competencia_id,funcionario_id' }).select('id').single();
    if (error) throw error;
    await fbDb.from('fb_lancamento_itens').delete().eq('lancamento_id', data.id);
    const itens = l.itens.map((i, idx) => {
      const u = l.unidades[i.verba] ?? (i.modo === 'horas_fixas' ? i.unidades || 0 : 0);
      const v = res?.variaveis.find((x) => x.verba === i.verba);
      return { lancamento_id: data.id, verba: i.verba, modo: i.modo, percentual: i.percentual ?? null, minutos: u, horas_decimal: horasDe(u, config.formato_horas), horas_hhmm: hhmm(unidadesParaMinutos(u, config.formato_horas)), horas_ponto: i.horas_ponto ?? null, valor: v?.valor ?? null, ordem: idx };
    });
    if (itens.length) await fbDb.from('fb_lancamento_itens').insert(itens);
    return data.id as string;
  };

  const salvarDias = async () => { await fbDb.from('fb_competencias').update({ dias_uteis: dias.uteis, dias_dsr: dias.dsr }).eq('id', comp.id); };

  const calcularTodos = async () => {
    await salvarDias();
    const novos: Record<string, Linha> = { ...linhas };
    try {
      for (const f of ativos) { const l = linhas[f.id]; if (!l) continue; const c = calcLinha(l); if (c.res || c.erro || l.lancId) { c.lancId = await persistir(c); } novos[f.id] = c; }
      setLinhas(novos);
      if (comp.status === 'rascunho') await fbDb.from('fb_competencias').update({ status: 'calculado' }).eq('id', comp.id);
      toast.success('Cálculo concluído'); onChanged();
    } catch (e: any) { toast.error(e.message); }
  };
  const recalcularLinha = async (id: string) => { const c = calcLinha(linhas[id]); try { c.lancId = await persistir(c); setL(id, c); } catch (e: any) { toast.error(e.message); } };
  const aplicarModelo = (m: FbModelo) => { setLinhas((all) => Object.fromEntries(Object.entries(all).map(([k, l]) => [k, { ...l, itens: m.itens.map((i) => ({ ...i, unidades: l.itens.find((x) => x.verba === i.verba)?.unidades, horas_ponto: l.itens.find((x) => x.verba === i.verba)?.horas_ponto })) }]))); toast.success(`Modelo "${m.nome}" aplicado — clique em Calcular todos`); };

  const alertasLinha = (l: Linha) => {
    const a: string[] = [];
    if (!l.res) return a;
    const he = l.res.variaveis.filter((v) => v.verba !== 'AD_NOT').reduce((s, v) => s + v.horas, 0);
    if (he > config.limite_he_diario * dias.uteis) a.push(`HE ${he.toFixed(2)} h acima do limite de ${(config.limite_he_diario * dias.uteis).toFixed(0)} h`);
    l.res.variaveis.forEach((v) => { if (v.horas_ponto != null && v.horas_ponto > 0 && v.horas > v.horas_ponto + 1e-9) a.push(`${v.descricao}: ${v.hhmm} acima do ponto (${v.horas_ponto} h)`); });
    return a;
  };

  const blocos: BlocoPrevia[] = ativos.map((f) => ({ f, l: linhas[f.id] })).filter(({ l }) => l?.res && l.alvo).map(({ f, l }) => ({ codigo: f.codigo, nome: f.nome, salario: l.salario, alvo: l.alvo!, res: l.res!, diferenca: l.diferenca ?? 0 }));
  const cab = { empresa: empresaNome, competencia: compLabel(comp.competencia), diasUteis: dias.uteis, diasDsr: dias.dsr, divisor: config.divisor, tolerancia: tol };

  const exportar = async () => {
    const comRes = ativos.filter((f) => linhas[f.id]?.res && !linhas[f.id]?.erro);
    if (!comRes.length) return toast.error('Calcule os funcionários antes de exportar.');
    const t = gerarTxt(comRes.map((f) => ({ codigo: f.codigo, unidades: linhas[f.id].unidades })), rubricas, config.formato_horas, comp.competencia.replace('-', ''), config.tipo_processo, config.codigo_empresa_dominio || null);
    if (t.erros.length) return toast.error(t.erros.slice(0, 3).join(' '));
    if (!t.conteudo) return toast.error('Nenhuma referência de horas para exportar.');
    const nome = `FOLHA${comp.competencia.slice(5, 7)}${comp.competencia.slice(0, 4)}-${config.codigo_empresa_dominio || '0'}-BRUTOALVO.txt`;
    const { data: u } = await fbDb.auth.getUser();
    await fbDb.from('fb_exportacoes').insert({ competencia_id: comp.id, arquivo_nome: nome, conteudo: t.conteudo, gerado_por: u?.user?.id ?? null });
    await fbDb.from('fb_competencias').update({ status: 'exportado' }).eq('id', comp.id);
    baixarTxt(nome, t.conteudo); toast.success(`${t.linhas.length} lançamento(s) exportados (sem DSR, salário ou quinquênio)`); onChanged();
  };

  const conciliar = async (id: string, v: number | null) => {
    const l = { ...linhas[id], brutoDominio: v }; setL(id, { brutoDominio: v });
    if (l.res) { try { await persistir(l); const todos = ativos.every((f) => !linhas[f.id]?.res || (f.id === id ? v : linhas[f.id].brutoDominio) != null); if (todos && comp.status === 'exportado') { await fbDb.from('fb_competencias').update({ status: 'conciliado' }).eq('id', comp.id); onChanged(); } } catch (e: any) { toast.error(e.message); } }
  };

  const H = (v?: { horas: number; hhmm: string; valor: number }) => v && v.horas > 0 ? <div className="leading-tight"><div>{v.hhmm}</div><div className="text-[10px] text-muted-foreground">{fmt(v.valor)}</div></div> : <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Dias úteis</Label><Input className="h-8 w-20" type="number" value={dias.uteis} onChange={(e) => setDias({ ...dias, uteis: Number(e.target.value) })} onBlur={salvarDias} /></div>
          <div><Label className="text-xs">Dias DSR</Label><Input className="h-8 w-20" type="number" value={dias.dsr} onChange={(e) => setDias({ ...dias, dsr: Number(e.target.value) })} onBlur={salvarDias} /></div>
          <Button size="sm" variant="outline" onClick={() => { const s = sugerirDias(comp.competencia, feriados.map((f) => f.data)); setDias({ uteis: s.diasUteis, dsr: s.diasDsr }); }}>Sugerir pelo calendário</Button>
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Conferir com o calendário do Domínio.</p>
          <div className="ml-auto text-xs text-muted-foreground">Divisor {config.divisor} · Tolerância {fmt(tol)} · Horas {config.formato_horas === 'hhmm' ? 'hhh:mm' : 'centesimal'}</div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={calcularTodos}><Calculator className="w-4 h-4 mr-1" />Calcular todos</Button>
        <Button variant="outline" onClick={() => setImportar(true)}><ClipboardPaste className="w-4 h-4 mr-1" />Importar alvos</Button>
        <Select onValueChange={(id) => { const m = modelos.find((x) => x.id === id); if (m) aplicarModelo(m); }}><SelectTrigger className="w-44"><SelectValue placeholder="Aplicar modelo" /></SelectTrigger>
          <SelectContent>{modelos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => setPrevia(true)} disabled={!blocos.length}><FileText className="w-4 h-4 mr-1" />Prévia</Button>
        <Button variant="outline" onClick={exportar}><Download className="w-4 h-4 mr-1" />Exportar TXT</Button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={ordem === 'codigo' ? 'default' : 'outline'} onClick={() => setOrdem('codigo')}>Código</Button>
          <Button size="sm" variant={ordem === 'nome' ? 'default' : 'outline'} onClick={() => setOrdem('nome')}>Ordem alfabética</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {!ativos.length ? <p className="text-sm text-muted-foreground">Cadastre funcionários na aba Funcionários.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground border-b">
                <th /><th className="p-1">Nome</th><th className="p-1 text-right">Salário</th><th className="p-1">Anos</th><th className="p-1">% Q.</th><th className="p-1 text-right">Quinq.</th><th className="p-1 text-right">Hora-base</th>
                <th className="p-1 text-right">Bruto alvo (ref.)</th><th className="p-1">A atingir no mês</th>{variaveis.filter((v) => v.verba === 'AD_NOT').map((v) => <th key={v.verba} className="p-1">{v.descricao}</th>)}<th className="p-1">DSR Not.</th>
                {variaveis.filter((v) => v.verba !== 'AD_NOT').map((v) => <th key={v.verba} className="p-1">{v.descricao}</th>)}<th className="p-1">DSR HE</th>
                <th className="p-1 text-right">Previsto</th><th className="p-1 text-right">Dif.</th><th className="p-1">Status</th><th className="p-1">Bruto Domínio</th><th className="p-1 text-right">Prévia × folha</th>
              </tr></thead>
              <tbody>{ativos.map((f) => {
                const l = linhas[f.id]; if (!l) return null;
                const r = l.res; const al = alertasLinha(l);
                const difDom = l.brutoDominio != null && r ? Math.round((l.brutoDominio - r.bruto) * 100) / 100 : null;
                return (
                  <Fragment key={f.id}>
                    <tr className="border-t align-top">
                      <td className="p-1"><button onClick={() => setAberta(aberta === f.id ? null : f.id)}>{aberta === f.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button></td>
                      <td className="p-1 min-w-40"><div className="font-medium">{f.nome}</div><div className="text-muted-foreground">{f.codigo}</div></td>
                      <td className="p-1 text-right">{fmt(l.salario)}</td>
                      <td className="p-1">{l.admissao ? (r?.anos ?? '') : <span className="text-destructive">sem admissão</span>}</td>
                      <td className="p-1">{r ? `${r.percQuinq}%` : ''}</td>
                      <td className="p-1 text-right">{r ? fmt(r.valorQuinq) : ''}</td>
                      <td className="p-1 text-right">{r ? r.horaBase.toFixed(4).replace('.', ',') : ''}</td>
                      <td className="p-1 text-right text-muted-foreground">{f.bruto_alvo_ref ? fmt(f.bruto_alvo_ref) : '—'}</td>
                      <td className="p-1"><Input className="h-7 w-24 text-xs" defaultValue={l.alvo != null ? l.alvo.toFixed(2).replace('.', ',') : ''} key={`${f.id}-${l.alvo}`} onBlur={(e) => setL(f.id, { alvo: e.target.value ? parseNum(e.target.value) : null })} />
                        {f.bruto_alvo_ref && l.alvo != null && Math.abs(l.alvo - f.bruto_alvo_ref) >= 0.01 && (
                          <div className={l.alvo > f.bruto_alvo_ref ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>{l.alvo > f.bruto_alvo_ref ? '+' : ''}{fmt(l.alvo - f.bruto_alvo_ref)} ({((l.alvo / f.bruto_alvo_ref - 1) * 100).toFixed(1).replace('.', ',')}%)</div>
                        )}
                      </td>
                      {variaveis.filter((v) => v.verba === 'AD_NOT').map((v) => <td key={v.verba} className="p-1">{H(r?.variaveis.find((x) => x.verba === v.verba))}</td>)}
                      <td className="p-1">{r?.dsrNoturno ? fmt(r.dsrNoturno) : '—'}</td>
                      {variaveis.filter((v) => v.verba !== 'AD_NOT').map((v) => <td key={v.verba} className="p-1">{H(r?.variaveis.find((x) => x.verba === v.verba))}</td>)}
                      <td className="p-1">{r?.dsrExtras ? fmt(r.dsrExtras) : '—'}</td>
                      <td className="p-1 text-right font-medium">{r ? fmt(r.bruto) : ''}</td>
                      <td className={`p-1 text-right ${l.diferenca != null && Math.abs(l.diferenca) > tol ? 'text-destructive' : 'text-green-700 dark:text-green-400'}`}>{l.diferenca != null && r ? fmt(l.diferenca) : ''}</td>
                      <td className="p-1">
                        {l.erro ? <Badge variant="destructive">{l.erro}</Badge> : l.status === 'ok' ? <Badge variant="secondary">OK</Badge> : l.status === 'alerta' ? <Badge variant="destructive">ALERTA</Badge> : null}
                        {al.map((a) => <div key={a} className="text-destructive mt-0.5">{a}</div>)}
                      </td>
                      <td className="p-1"><Input className="h-7 w-24 text-xs" disabled={!r} defaultValue={l.brutoDominio != null ? l.brutoDominio.toFixed(2).replace('.', ',') : ''} onBlur={(e) => { const v = e.target.value ? parseNum(e.target.value) : null; if (v !== l.brutoDominio) conciliar(f.id, v); }} /></td>
                      <td className={`p-1 text-right ${difDom ? 'text-destructive font-bold bg-destructive/10' : ''}`}>{difDom != null ? fmt(difDom) : ''}</td>
                    </tr>
                    {aberta === f.id && (
                      <tr className="bg-muted/40"><td /><td colSpan={30} className="p-2">
                        <div className="flex flex-wrap gap-3 mb-2">
                          <div><Label className="text-xs">Salário neste mês</Label><Input className="h-7 w-28 text-xs" defaultValue={l.salario.toFixed(2).replace('.', ',')} onBlur={(e) => setL(f.id, { salario: parseNum(e.target.value) })} /></div>
                          <div><Label className="text-xs">Admissão</Label><Input type="date" className="h-7 w-36 text-xs" defaultValue={l.admissao || ''} onBlur={(e) => setL(f.id, { admissao: e.target.value || null })} /></div>
                        </div>
                        {variaveis.map((v) => {
                          const it = l.itens.find((i) => i.verba === v.verba) || { verba: v.verba, modo: 'percentual' as Modo, percentual: 0 };
                          const upd = (p: Partial<ItemCfg>) => setL(f.id, { itens: [...l.itens.filter((i) => i.verba !== v.verba), { ...it, ...p }].sort((a, b) => variaveis.findIndex((x) => x.verba === a.verba) - variaveis.findIndex((x) => x.verba === b.verba)) });
                          return (
                            <div key={v.verba} className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="w-44">{v.descricao}</span>
                              <Select value={it.modo} onValueChange={(m: Modo) => upd({ modo: m })}><SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="percentual">% do saldo</SelectItem><SelectItem value="horas_fixas">Horas fixas</SelectItem><SelectItem value="ajuste">Ajuste (resto)</SelectItem></SelectContent></Select>
                              {it.modo === 'percentual' && <><Input className="h-7 w-16 text-xs" defaultValue={it.percentual ?? 0} onBlur={(e) => upd({ percentual: parseNum(e.target.value) })} /><span>%</span></>}
                              {it.modo === 'horas_fixas' && <><Input className="h-7 w-20 text-xs" placeholder="HH:MM" defaultValue={it.unidades ? hhmm(unidadesParaMinutos(it.unidades, config.formato_horas)) : ''} onBlur={(e) => upd({ unidades: parseHoras(e.target.value, config.formato_horas) })} /><span>h</span></>}
                              <span className="ml-3 text-muted-foreground">Horas no ponto</span>
                              <Input className="h-7 w-20 text-xs" placeholder="opcional" defaultValue={it.horas_ponto ?? ''} onBlur={(e) => { const u = e.target.value ? parseHoras(e.target.value, 'centesimal') / 100 : null; upd({ horas_ponto: u }); }} />
                            </div>
                          );
                        })}
                        <Button size="sm" className="mt-2" onClick={() => recalcularLinha(f.id)}>Recalcular linha</Button>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={previa} onOpenChange={setPrevia}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prévia / conferência — {cab.competencia}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Dias úteis {cab.diasUteis} · Dias DSR {cab.diasDsr} · Divisor {cab.divisor}</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => pdfPrevia(cab, blocos)}><FileText className="w-4 h-4 mr-1" />PDF</Button><Button size="sm" variant="outline" onClick={() => excelPrevia(cab, blocos)}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button></div>
          {blocos.map((b) => (
            <div key={b.codigo} className="border rounded-md p-3 text-sm">
              <div className="flex justify-between font-semibold mb-1"><span>{b.nome}</span><span>Alvo {fmt(b.alvo)}</span></div>
              {linhasBloco(b).map((x, i) => (
                <div key={i} className={`flex gap-2 ${x[0].includes('não exportado') ? 'text-muted-foreground' : ''}`}>
                  <span className="flex-1">{x[0].replace(/ \(calculado.*\)/, '')}{x[0].includes('não exportado') && <Badge variant="outline" className="ml-1 text-[10px]">calculado pelo Domínio – não exportado</Badge>}</span>
                  <span className="w-20 text-right">{x[1]}</span><span className="w-14 text-right">{x[2]}</span><span className="w-24 text-right">{x[3]}</span>
                </div>
              ))}
              <div className="flex border-t mt-1 pt-1 font-semibold"><span className="flex-1">TOTAL PREVISTO</span><span>{fmt(b.res.bruto)}</span></div>
              <div className={`flex ${Math.abs(b.diferenca) <= tol ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}><span className="flex-1">Diferença p/ alvo</span><span>{fmt(b.diferenca)}</span></div>
            </div>
          ))}
        </DialogContent>
      </Dialog>

      <ImportarAlvos open={importar} onOpenChange={setImportar} funcionarios={ativos} onConfirm={(m) => { setLinhas((all) => { const n = { ...all }; Object.entries(m).forEach(([id, v]) => { if (n[id]) n[id] = { ...n[id], alvo: v }; }); return n; }); toast.success(`${Object.keys(m).length} alvo(s) importados — clique em Calcular todos`); }} />
    </div>
  );
}

function ImportarAlvos({ open, onOpenChange, funcionarios, onConfirm }: { open: boolean; onOpenChange: (b: boolean) => void; funcionarios: FbFuncionario[]; onConfirm: (m: Record<string, number>) => void }) {
  const [texto, setTexto] = useState('');
  const [prev, setPrev] = useState<{ linha: string; valor: number; func?: FbFuncionario; ok: boolean }[] | null>(null);
  const analisar = () => {
    const out = texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((linha) => {
      const m = linha.match(/^(.*?)[\s;,\t]+R?\$?\s*([\d.]+,\d{2}|[\d]+(?:\.\d{1,2})?)\s*$/);
      if (!m) return { linha, valor: 0, ok: false };
      const chave = m[1].replace(/[;,\t]+$/, '').trim(); const valor = parseNum(m[2]);
      const dig = chave.replace(/\D/g, '');
      const func = funcionarios.find((f) => (dig.length === 11 && f.cpf?.replace(/\D/g, '') === dig) || norm(f.nome) === norm(chave) || f.codigo === chave)
        || funcionarios.find((f) => norm(f.nome).startsWith(norm(chave)) && norm(chave).length > 5);
      return { linha, valor, func, ok: !!func && valor > 0 };
    });
    setPrev(out);
  };
  return (
    <Dialog open={open} onOpenChange={(b) => { onOpenChange(b); if (!b) { setPrev(null); setTexto(''); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar bruto alvo</DialogTitle></DialogHeader>
        {!prev ? (<>
          <p className="text-xs text-muted-foreground">Cole uma linha por funcionário: NOME (ou CPF, ou código) e VALOR. Aceita CSV com ";".</p>
          <Textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'MARIA SILVA 2.500,00\n123.456.789-00;3100,00'} />
          <Button onClick={analisar} disabled={!texto.trim()}>Conferir</Button>
        </>) : (<>
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-1">Linha</th><th className="p-1">Funcionário</th><th className="p-1 text-right">Alvo</th></tr></thead>
            <tbody>{prev.map((p, i) => <tr key={i} className={`border-t ${p.ok ? '' : 'text-destructive'}`}><td className="p-1">{p.linha}</td><td className="p-1">{p.func?.nome || 'não encontrado'}</td><td className="p-1 text-right">{fmt(p.valor)}</td></tr>)}</tbody></table>
          <div className="flex justify-between"><Button variant="outline" onClick={() => setPrev(null)}>Voltar</Button>
            <Button disabled={!prev.some((p) => p.ok)} onClick={() => { onConfirm(Object.fromEntries(prev.filter((p) => p.ok).map((p) => [p.func!.id, p.valor]))); onOpenChange(false); setPrev(null); setTexto(''); }}>Confirmar {prev.filter((p) => p.ok).length}</Button></div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
