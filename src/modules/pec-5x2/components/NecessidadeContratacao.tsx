import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarRange, FileDown, FileSpreadsheet, Plus, Save, Settings2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcular, DIAS, DIA_LABEL, PARAMS_PADRAO, REGIME_LABEL, horas, modoB, fmtH,
  type Faixa, type Marco, type Nivel, type Parametros, type Regime, type Setor,
} from '../calculo';
import { exportarPdf, exportarXlsx } from '../exportar';

const sel = 'h-8 rounded-md border border-input bg-background px-2 text-sm';
const n2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const NIVEIS: Nivel[] = ['baixo', 'normal', 'alto', 'pico'];
type SetorDb = Setor & { id: string };

interface Props { empresaId: string; empresa?: { nome: string; cnpj?: string }; onAbrirEscala: (id: string) => void }

export default function NecessidadeContratacao({ empresaId, empresa, onAbrirEscala }: Props) {
  const [params, setParams] = useState<Parametros>(PARAMS_PADRAO);
  const [setores, setSetores] = useState<SetorDb[]>([]);
  const [verParams, setVerParams] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [cenarios, setCenarios] = useState<any[]>([]);
  const [comparar, setComparar] = useState<string[]>([]);
  const timers = useRef<Record<string, any>>({});

  const load = useCallback(async () => {
    const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('transicao_parametros' as any).select('*').eq('empresa_id', empresaId).maybeSingle(),
      supabase.from('transicao_setores' as any).select('*').eq('empresa_id', empresaId).order('ordem'),
      supabase.from('transicao_cenarios' as any).select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
    ]);
    const pp = p as any;
    setParams(pp ? {
      marcos: pp.marcos?.length ? pp.marcos : PARAMS_PADRAO.marcos, regime_compensacao_padrao: pp.regime_compensacao_padrao,
      limite_diario_padrao: Number(pp.limite_diario_padrao), multiplicadores_intensidade: pp.multiplicadores_intensidade, indices_reposicao: pp.indices_reposicao,
    } : PARAMS_PADRAO);
    const lista = ((s as any[]) || []);
    const ids = lista.map((x) => x.id);
    const { data: ds } = ids.length ? await supabase.from('transicao_datas_especiais' as any).select('*').in('setor_id', ids) : { data: [] as any[] };
    setSetores(lista.map((x) => ({ ...x, datas_especiais: ((ds as any[]) || []).filter((d) => d.setor_id === x.id) })));
    setCenarios((c as any[]) || []);
  }, [empresaId]);
  useEffect(() => { load(); }, [load]);

  const salvarParams = async (np: Parametros) => {
    setParams(np);
    clearTimeout(timers.current.params);
    timers.current.params = setTimeout(async () => {
      const { error } = await supabase.from('transicao_parametros' as any).upsert({ empresa_id: empresaId, ...np } as any, { onConflict: 'empresa_id' });
      if (error) toast.error(error.message);
    }, 800);
  };

  const atualizar = (id: string, patch: Partial<SetorDb>) => {
    setSetores((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { datas_especiais, ...rest } = patch as any;
      if (Object.keys(rest).length) {
        const { error } = await supabase.from('transicao_setores' as any).update(rest).eq('id', id);
        if (error) toast.error(error.message);
      }
      if (datas_especiais) {
        await supabase.from('transicao_datas_especiais' as any).delete().eq('setor_id', id);
        const rows = datas_especiais.filter((d: any) => d.data).map((d: any) => ({ setor_id: id, data: d.data, nivel: d.nivel, observacao: d.observacao || null }));
        if (rows.length) await supabase.from('transicao_datas_especiais' as any).insert(rows);
      }
    }, 700);
  };

  const novoSetor = async () => {
    const { data, error } = await supabase.from('transicao_setores' as any).insert({ empresa_id: empresaId, nome: `Setor ${setores.length + 1}`, ordem: setores.length }).select('*').single();
    if (error) return toast.error(error.message);
    setSetores((l) => [...l, { ...(data as any), datas_especiais: [] }]);
  };
  const excluir = async (id: string) => {
    if (!confirm('Excluir este setor?')) return;
    await supabase.from('transicao_setores' as any).delete().eq('id', id);
    setSetores((l) => l.filter((s) => s.id !== id));
  };

  const totais = useMemo(() => params.marcos.map((m) => {
    const a = setores.map((s) => calcular(s, params, m, false)), b = setores.map((s) => calcular(s, params, m, true));
    const sum = (x: typeof a, k: 'arredondada' | 'necessidade' | 'atual') => x.reduce((t, r) => t + r[k], 0);
    return { marco: m, atual: sum(a, 'atual'), sem: sum(a, 'arredondada'), com: sum(b, 'arredondada'), fteSem: sum(a, 'necessidade'), fteCom: sum(b, 'necessidade') };
  }), [setores, params]);

  const grafico = setores.map((s) => ({ setor: s.nome, Atual: calcular(s, params, params.marcos[0], true).atual,
    ...Object.fromEntries(params.marcos.slice(1).map((m) => [m.nome, calcular(s, params, m, true).arredondada])) }));
  const cores = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))', 'hsl(var(--secondary-foreground))'];

  const salvarCenario = async () => {
    const nome = prompt('Nome do cenário:'); if (!nome) return;
    const resumo = totais.map((t) => ({ marco: t.marco.nome, atual: t.atual, sem: t.sem, com: t.com }));
    const { error } = await supabase.from('transicao_cenarios' as any).insert({ empresa_id: empresaId, nome, snapshot: { params, setores, resumo } });
    if (error) return toast.error(error.message);
    toast.success('Cenário salvo'); load();
  };

  const enviarEscala = async (s: SetorDb, m: Marco) => {
    const r = calcular(s, params, m, true);
    const total = r.arredondada; if (!total) return toast.error('Sem funcionários calculados para este setor.');
    const h = new Date();
    const ini = new Date(Date.UTC(h.getFullYear(), h.getMonth() + 1, 1)).toISOString().slice(0, 10);
    const fim = new Date(Date.UTC(h.getFullYear(), h.getMonth() + 2, 0)).toISOString().slice(0, 10);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('escalas_revezamento' as any).insert({
      cliente_id: empresaId, data_inicio: ini, data_fim: fim, setor: s.nome, regime: m.dias === 5 ? '5x2' : '6x1',
      titulo: `PEC 5x2 · ${s.nome} · ${m.nome}`, created_by: u.user?.id,
      regras_cct: { pec_origem: { setor_id: s.id, setor: s.nome, marco: m.nome, jornada: m.jornada, necessidade: r.necessidade } },
    } as any).select('id').single();
    if (error) return toast.error(error.message);
    const f = s.funcionarios_por_sexo?.F || 0;
    const funcs = Array.from({ length: total }, (_, i) => ({ escala_id: (data as any).id, ordem: i, codigo: String(i + 1), nome: `Colaborador ${i + 1}`, setor: s.nome, sexo: i < f ? 'F' : 'M', art386_ativo: i < f }));
    const { error: e2 } = await supabase.from('escala_funcionarios' as any).insert(funcs as any);
    if (e2) return toast.error(e2.message);
    toast.success(`Escala criada com ${total} colaboradores`);
    onAbrirEscala((data as any).id);
  };

  const det = setores.find((s) => s.id === detalhe);
  const marcosFut = params.marcos.slice(1);

  return (
    <div className="space-y-4 mt-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setVerParams((v) => !v)}><Settings2 className="h-4 w-4 mr-1" />Parâmetros</Button>
        <Button size="sm" onClick={novoSetor}><Plus className="h-4 w-4 mr-1" />Setor</Button>
        <Button variant="outline" size="sm" onClick={salvarCenario}><Save className="h-4 w-4 mr-1" />Salvar cenário</Button>
        <Button variant="outline" size="sm" onClick={() => exportarPdf(empresa || {}, setores, params)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
        <Button variant="outline" size="sm" onClick={() => exportarXlsx(empresa || {}, setores, params)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
      </div>

      {verParams && <ParamsCard p={params} onChange={salvarParams} />}

      <div className="grid gap-3 md:grid-cols-3">
        {totais.map((t) => (
          <Card key={t.marco.id} className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground">{t.marco.nome} · {t.marco.jornada}h/{t.marco.dias} dias</div>
            <div className="text-sm">Quadro atual: <b>{t.atual}</b></div>
            <div className="text-sm">Sem compensação: <b>{t.sem}</b> ({n2(t.fteSem)} FTE) <Gap v={t.sem - t.atual} /></div>
            <div className="text-sm">Com compensação: <b>{t.com}</b> ({n2(t.fteCom)} FTE) <Gap v={t.com - t.atual} /></div>
            {t.sem > t.com && <div className="text-xs text-primary">Compensação evita {t.sem - t.com} contratação(ões)</div>}
          </Card>
        ))}
      </div>

      {setores.length > 0 && (
        <Card className="p-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="setor" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend />
              {['Atual', ...marcosFut.map((m) => m.nome)].map((k, i) => <Bar key={k} dataKey={k} fill={cores[i % 3]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr><th className="p-2 text-left">Setor</th><th>Atuais</th><th>Mulheres</th><th>Parciais (qtd × h)</th><th>Regime</th><th>Limite/dia</th><th>Insalubre</th>
              {marcosFut.map((m) => <th key={m.id} className="px-2">{m.nome}<div className="font-normal">sem / com</div></th>)}<th></th></tr>
          </thead>
          <tbody>
            {setores.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-1"><Input className="h-8 min-w-[140px]" value={s.nome} onChange={(e) => atualizar(s.id, { nome: e.target.value })} /></td>
                <td className="p-1"><Input type="number" className="h-8 w-16" value={s.funcionarios_atuais} onChange={(e) => atualizar(s.id, { funcionarios_atuais: Number(e.target.value) || 0 })} /></td>
                <td className="p-1"><Input type="number" className="h-8 w-16" value={s.funcionarios_por_sexo?.F ?? ''} onChange={(e) => atualizar(s.id, { funcionarios_por_sexo: { F: Number(e.target.value) || 0, M: Math.max(0, s.funcionarios_atuais - (Number(e.target.value) || 0)) } })} /></td>
                <td className="p-1 whitespace-nowrap"><Input type="number" className="h-8 w-14 inline-block" value={s.parciais?.qtd ?? 0} onChange={(e) => atualizar(s.id, { parciais: { qtd: Number(e.target.value) || 0, horas: s.parciais?.horas || 0 } })} /> × <Input type="number" className="h-8 w-14 inline-block" value={s.parciais?.horas ?? 0} onChange={(e) => atualizar(s.id, { parciais: { qtd: s.parciais?.qtd || 0, horas: Number(e.target.value) || 0 } })} /></td>
                <td className="p-1"><select className={sel} value={s.regime_compensacao || ''} onChange={(e) => atualizar(s.id, { regime_compensacao: (e.target.value || null) as any })}>
                  <option value="">Padrão</option>{(Object.keys(REGIME_LABEL) as Regime[]).map((r) => <option key={r} value={r}>{REGIME_LABEL[r]}</option>)}</select></td>
                <td className="p-1"><Input type="number" step="0.5" max={10} className="h-8 w-16" placeholder={String(params.limite_diario_padrao)} value={s.limite_diario ?? ''} onChange={(e) => atualizar(s.id, { limite_diario: e.target.value === '' ? null : Math.min(10, Number(e.target.value)) })} /></td>
                <td className="p-1 text-center"><Checkbox checked={!!s.insalubre} onCheckedChange={(v) => atualizar(s.id, { insalubre: !!v })} /></td>
                {marcosFut.map((m) => { const a = calcular(s, params, m, false), b = calcular(s, params, m, true); return (
                  <td key={m.id} className="px-2 text-center whitespace-nowrap">{a.arredondada} <Gap v={a.gap} /> / {b.arredondada} <Gap v={b.gap} />
                    {(a.alertas.length + b.alertas.length) > 0 && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-destructive" />}</td>); })}
                <td className="p-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setDetalhe(s.id)}><Search className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => excluir(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {!setores.length && <tr><td colSpan={10} className="p-4 text-muted-foreground">Nenhum setor. Clique em “Setor” para começar.</td></tr>}
          </tbody>
        </table>
      </Card>

      {cenarios.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="font-medium">Cenários salvos <span className="text-xs text-muted-foreground">(marque para comparar)</span></div>
          <div className="flex flex-wrap gap-3">
            {cenarios.map((c) => (
              <label key={c.id} className="flex items-center gap-1 text-sm">
                <Checkbox checked={comparar.includes(c.id)} onCheckedChange={(v) => setComparar((l) => (v ? [...l, c.id] : l.filter((x) => x !== c.id)))} />{c.nome}
                <button className="text-xs text-muted-foreground underline ml-1" onClick={async () => { if (confirm('Excluir cenário?')) { await supabase.from('transicao_cenarios' as any).delete().eq('id', c.id); load(); } }}>excluir</button>
              </label>))}
          </div>
          {comparar.length > 0 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${comparar.length}, minmax(0,1fr))` }}>
              {cenarios.filter((c) => comparar.includes(c.id)).map((c) => (
                <div key={c.id} className="border rounded p-2 text-sm">
                  <div className="font-medium">{c.nome}</div>
                  {(c.snapshot?.resumo || []).map((r: any) => <div key={r.marco}>{r.marco}: atual {r.atual} · sem {r.sem} · com {r.com}</div>)}
                </div>))}
            </div>)}
        </Card>
      )}

      <Dialog open={!!det} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{det?.nome}</DialogTitle></DialogHeader>
          {det && <DetalheSetor s={det} p={params} onChange={(patch) => atualizar(det.id, patch)} onEnviar={(m) => enviarEscala(det, m)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Gap({ v }: { v: number }) {
  if (!v) return null;
  return <span className={v > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>({v > 0 ? '+' : ''}{v})</span>;
}

function ParamsCard({ p, onChange }: { p: Parametros; onChange: (p: Parametros) => void }) {
  const setMarco = (i: number, patch: Partial<Marco>) => onChange({ ...p, marcos: p.marcos.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <Card className="p-4 space-y-3">
      <div className="font-medium">Marcos</div>
      {p.marcos.map((m, i) => (
        <div key={m.id} className="flex flex-wrap gap-2 items-center">
          <Input className="h-8 w-44" value={m.nome} onChange={(e) => setMarco(i, { nome: e.target.value })} />
          <Input type="date" className="h-8 w-40" value={m.data} onChange={(e) => setMarco(i, { data: e.target.value })} />
          <Input type="number" className="h-8 w-20" value={m.jornada} onChange={(e) => setMarco(i, { jornada: Number(e.target.value) || 0 })} /><span className="text-xs">h/sem</span>
          <Input type="number" className="h-8 w-16" value={m.dias} onChange={(e) => setMarco(i, { dias: Number(e.target.value) || 1 })} /><span className="text-xs">dias</span>
          {i > 0 && <Button size="sm" variant="ghost" onClick={() => onChange({ ...p, marcos: p.marcos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>}
        </div>))}
      <Button size="sm" variant="outline" onClick={() => onChange({ ...p, marcos: [...p.marcos, { id: crypto.randomUUID(), nome: 'Novo marco', data: '', jornada: 40, dias: 5 }] })}><Plus className="h-4 w-4 mr-1" />Marco</Button>
      <div className="grid md:grid-cols-3 gap-3">
        <div><Label>Regime padrão</Label><select className={sel + ' w-full'} value={p.regime_compensacao_padrao} onChange={(e) => onChange({ ...p, regime_compensacao_padrao: e.target.value as Regime })}>
          {(Object.keys(REGIME_LABEL) as Regime[]).map((r) => <option key={r} value={r}>{REGIME_LABEL[r]}</option>)}</select></div>
        <div><Label>Limite diário com compensação (máx. 10h)</Label><Input type="number" step="0.5" value={p.limite_diario_padrao} onChange={(e) => onChange({ ...p, limite_diario_padrao: Math.min(10, Number(e.target.value) || 8) })} /></div>
        <div>
          <Label>Intensidade dos dias (multiplicador dos postos)</Label>
          <div className="flex gap-2 items-end mt-1">
            {NIVEIS.map((n) => <div key={n}><Label className="capitalize">{n} (×{p.multiplicadores_intensidade[n]})</Label><Input type="number" step="0.05" className="w-20" value={p.multiplicadores_intensidade[n]} onChange={(e) => onChange({ ...p, multiplicadores_intensidade: { ...p.multiplicadores_intensidade, [n]: Number(e.target.value) || 0 } })} /></div>)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Cada dia aberto do setor é classificado como baixo, normal, alto ou pico, conforme o movimento. O multiplicador aumenta ou reduz quantos postos precisam estar ocupados naquele dia: 6 postos em dia “alto” (×1,25) exigem 7,5 → 8 postos (arredonda para cima). Em dia “baixo” (×0,75), 6 postos exigem 4,5 → 5. Dias sem classificação valem “normal” (×1). Só é usado quando o setor tem faixas de postos cadastradas (Modo B); nos setores sem postos, a intensidade não interfere.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={p.indices_reposicao.ativo} onCheckedChange={(v) => onChange({ ...p, indices_reposicao: { ...p.indices_reposicao, ativo: !!v } })} />Aplicar reposição de ausências</label>
        <div><Label>Férias %</Label><Input type="number" step="0.01" className="w-24" value={p.indices_reposicao.ferias} onChange={(e) => onChange({ ...p, indices_reposicao: { ...p.indices_reposicao, ferias: Number(e.target.value) || 0 } })} /></div>
        <div><Label>Absenteísmo %</Label><Input type="number" step="0.01" className="w-24" value={p.indices_reposicao.absenteismo} onChange={(e) => onChange({ ...p, indices_reposicao: { ...p.indices_reposicao, absenteismo: Number(e.target.value) || 0 } })} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Regras de domingo (periodicidade e domingo da mulher) continuam sendo definidas em cada escala, na sub-aba Escala de Revezamento.</p>
    </Card>
  );
}

function DetalheSetor({ s, p, onChange, onEnviar }: { s: Setor; p: Parametros; onChange: (patch: Partial<Setor>) => void; onEnviar: (m: Marco) => void }) {
  const [pico, setPico] = useState(false);
  const func = s.funcionamento || {};
  const setDia = (d: string, patch: any) => onChange({ funcionamento: { ...func, [d]: { aberto: false, turnos: [{ ini: '08:00', fim: '18:00' }], ...func[d], ...patch } } });
  const postos = s.postos || [];
  const setPostos = (l: Faixa[]) => onChange({ postos: l });
  const datas = s.datas_especiais || [];
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="font-medium mb-1">Horário de funcionamento e intensidade (opcional)</div>
        <table className="text-xs"><tbody>
          {DIAS.map((d) => { const f = func[d]; return (
            <tr key={d}><td className="pr-2 w-10">{DIA_LABEL[d]}</td>
              <td><Checkbox checked={!!f?.aberto} onCheckedChange={(v) => setDia(d, { aberto: !!v })} /></td>
              <td className="px-2 whitespace-nowrap">{f?.aberto && (f.turnos || []).map((t, i) => (
                <span key={i} className="mr-2"><Input type="time" className="h-7 w-24 inline-block" value={t.ini} onChange={(e) => setDia(d, { turnos: f.turnos.map((x, j) => (j === i ? { ...x, ini: e.target.value } : x)) })} />–<Input type="time" className="h-7 w-24 inline-block" value={t.fim} onChange={(e) => setDia(d, { turnos: f.turnos.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)) })} /></span>))}
                {f?.aberto && <Button size="sm" variant="ghost" className="h-7" onClick={() => setDia(d, { turnos: [...f.turnos, { ini: '18:00', fim: '22:00' }] })}>+ turno</Button>}</td>
              <td>{f?.aberto && <select className={sel + ' h-7'} value={s.intensidade_dias?.[d] || 'normal'} onChange={(e) => onChange({ intensidade_dias: { ...(s.intensidade_dias || {}), [d]: e.target.value as Nivel } })}>{NIVEIS.map((n) => <option key={n}>{n}</option>)}</select>}</td>
              <td className="pl-2">{f?.aberto && <Input type="number" placeholder="postos diretos" className="h-7 w-28" value={f.postos_diretos ?? ''} onChange={(e) => setDia(d, { postos_diretos: e.target.value === '' ? null : Number(e.target.value) })} />}</td>
            </tr>); })}
        </tbody></table>
      </div>
      <div>
        <div className="font-medium mb-1">Postos simultâneos mínimos por faixa</div>
        {postos.map((fx, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <Input type="time" className="h-7 w-24" value={fx.ini} onChange={(e) => setPostos(postos.map((x, j) => (j === i ? { ...x, ini: e.target.value } : x)))} />–
            <Input type="time" className="h-7 w-24" value={fx.fim} onChange={(e) => setPostos(postos.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} />
            <Input type="number" className="h-7 w-20" value={fx.postos} onChange={(e) => setPostos(postos.map((x, j) => (j === i ? { ...x, postos: Number(e.target.value) || 0 } : x)))} /> postos
            <Button size="sm" variant="ghost" onClick={() => setPostos(postos.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>))}
        <Button size="sm" variant="outline" onClick={() => setPostos([...postos, { ini: '08:00', fim: '12:00', postos: 1 }])}><Plus className="h-3.5 w-3.5 mr-1" />Faixa</Button>
      </div>
      <div>
        <div className="font-medium mb-1">Datas especiais</div>
        {datas.map((d, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <Input type="date" className="h-7 w-40" value={d.data} onChange={(e) => onChange({ datas_especiais: datas.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)) })} />
            <select className={sel + ' h-7'} value={d.nivel} onChange={(e) => onChange({ datas_especiais: datas.map((x, j) => (j === i ? { ...x, nivel: e.target.value as Nivel } : x)) })}>{NIVEIS.map((n) => <option key={n}>{n}</option>)}</select>
            <Input className="h-7" placeholder="Observação (feriado, temporada…)" value={d.observacao || ''} onChange={(e) => onChange({ datas_especiais: datas.map((x, j) => (j === i ? { ...x, observacao: e.target.value } : x)) })} />
            <Button size="sm" variant="ghost" onClick={() => onChange({ datas_especiais: datas.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>))}
        <Button size="sm" variant="outline" onClick={() => onChange({ datas_especiais: [...datas, { data: '', nivel: 'alto' }] })}><Plus className="h-3.5 w-3.5 mr-1" />Data</Button>
      </div>
      {modoB(s) && <label className="flex items-center gap-2"><Checkbox checked={pico} onCheckedChange={(v) => setPico(!!v)} />Calcular semana de pico (usa o maior nível das datas especiais)</label>}

      {p.marcos.map((m) => {
        const a = calcular(s, p, m, false, pico), b = calcular(s, p, m, true, pico);
        return (
          <Card key={m.id} className="p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="font-medium">{m.nome} · {m.jornada}h/{m.dias} dias · Modo {a.modo}</div>
              {m.id !== p.marcos[0].id && <Button size="sm" onClick={() => onEnviar(m)}><CalendarRange className="h-4 w-4 mr-1" />Enviar para Escala de Revezamento</Button>}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {[a, b].map((r, i) => (
                <div key={i} className="border rounded p-2">
                  <div className="font-medium">{i ? 'Com compensação' : 'Sem compensação'}</div>
                  <div>Necessidade: {n2(r.necessidade)} FTE → <b>{r.arredondada}</b> <Gap v={r.gap} /></div>
                  <div>Horas disponíveis {n2(r.horasDisponiveis)}h × demandadas {n2(r.horasDemandadas)}h · saldo <span className={r.saldo < 0 ? 'text-destructive' : ''}>{n2(r.saldo)}h</span></div>
                  {r.parcialSugerido && <div className="text-xs">Fração: considerar 1 contratação parcial de ~{r.parcialSugerido}h/semana (art. 58-A CLT).</div>}
                  <ol className="list-decimal ml-4 text-xs text-muted-foreground mt-1">{r.memoria.map((x, k) => <li key={k}>{x}</li>)}</ol>
                  {r.alertas.map((x, k) => <div key={k} className="text-xs text-destructive mt-1 flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{x}</div>)}
                </div>))}
            </div>
            {a.arredondada > b.arredondada && <div className="text-xs text-primary">A compensação evita {a.arredondada - b.arredondada} contratação(ões).</div>}
            {modoB(s) && <MapaCalor s={s} p={p} m={m} total={b.arredondada} pico={pico} />}
          </Card>);
      })}
    </div>
  );
}

/** Mapa dias × faixas: postos exigidos vs. pessoas disponíveis por dia (quadro do marco distribuído nos dias abertos). */
function MapaCalor({ s, p, m, total, pico }: { s: Setor; p: Parametros; m: Marco; total: number; pico: boolean }) {
  const r = calcular(s, p, m, true, pico);
  const abertos = DIAS.filter((d) => s.funcionamento?.[d]?.aberto);
  const porDia = abertos.length ? (total * m.dias) / abertos.length : 0;
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-muted-foreground mb-1">Postos exigidos × pessoas por dia (~{n2(porDia)} com {total} funcionários)</div>
      <table className="text-xs"><thead><tr><th className="pr-2 text-left">Faixa</th>{abertos.map((d) => <th key={d} className="px-2">{DIA_LABEL[d]}</th>)}</tr></thead>
        <tbody>{(s.postos || []).map((fx, i) => (
          <tr key={i}><td className="pr-2">{fx.ini}–{fx.fim} ({fmtH(horas(fx.ini, fx.fim))})</td>
            {abertos.map((d) => { const f = s.funcionamento![d]; const nv = s.intensidade_dias?.[d] || 'normal';
              const req = f.postos_diretos ? f.postos_diretos : Math.ceil(fx.postos * (p.multiplicadores_intensidade[nv] ?? 1));
              const ok = porDia >= (r.postosDia[d] || req);
              return <td key={d} className={`px-2 text-center ${ok ? 'bg-primary/15' : 'bg-destructive/20'}`}>{req}</td>; })}
          </tr>))}</tbody></table>
    </div>
  );
}
