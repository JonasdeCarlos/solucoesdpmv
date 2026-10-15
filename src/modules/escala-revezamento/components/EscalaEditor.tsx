import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, Plus, Trash2, Wand2, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ATIVIDADES_ANEXO_IV, CATEGORIA_LABEL, listarDias, diaSemana, fmtBR, gerarEscala, validarEscala, is12x36,
  nMaxCategoria, novoFuncionario, type EscalaFuncionario, type EscalaParams, type TipoDia, type Categoria,
} from '../motor';
import ImportarFuncionarios from './ImportarFuncionarios';

const SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CICLO: TipoDia[] = ['T', 'F', 'FC', 'A'];
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const corTipo: Record<TipoDia, string> = {
  T: 'bg-background text-foreground',
  F: 'bg-secondary text-secondary-foreground font-semibold',
  FC: 'bg-accent text-accent-foreground font-semibold',
  A: 'bg-muted text-muted-foreground',
};

interface Props {
  params: EscalaParams;
  onParams: (p: EscalaParams) => void;
  funcionarios: EscalaFuncionario[];
  onFuncionarios: (f: EscalaFuncionario[]) => void;
  readOnly?: boolean;
  cliente?: { nome?: string; cnpj?: string; cnae?: string | null };
}

export default function EscalaEditor({ params: p, onParams, funcionarios: fs, onFuncionarios, readOnly, cliente }: Props) {
  const [conflitos, setConflitos] = useState<string[]>([]);
  const dias = useMemo(() => listarDias(p.data_inicio, p.data_fim), [p.data_inicio, p.data_fim]);
  const fer = useMemo(() => new Set(p.feriados.map((f) => f.data)), [p.feriados]);
  const res = useMemo(() => validarEscala(p, fs, { cliente }), [p, fs, cliente]);
  const set = <K extends keyof EscalaParams>(k: K, val: EscalaParams[K]) => onParams({ ...p, [k]: val });
  const setF = (i: number, patch: Partial<EscalaFuncionario>) => onFuncionarios(fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const cobertura = (d: string) => fs.filter((f) => (f.dias[d] || 'T') === 'T').length;
  const nMax = nMaxCategoria(p);
  const [cnae, setCnae] = useState('');
  const [dadosCct, setDadosCct] = useState('');
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestao, setSugestao] = useState<any>(null);
  const cnaeVal = cnae || cliente?.cnae || '';

  const sugerir = async () => {
    if (!cnaeVal.trim()) { toast.error('Informe o CNAE.'); return; }
    setSugerindo(true); setSugestao(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escala-sugerir-parametros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, Authorization: `Bearer ${sess?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ cnae: cnaeVal, setor: p.setor, empresa: cliente?.nome, dados_cct: dadosCct }),
      });
      if (!res.ok || !res.body) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Falha (${res.status})`); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let acc = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue;
          try { const ev = JSON.parse(d); if (ev.type === 'response.output_text.delta') acc += ev.delta || ''; if (ev.type === 'error' || ev.type === 'response.failed') throw new Error(ev.error?.message || ev.response?.error?.message || 'Falha na IA'); } catch (er: any) { if (er?.message && !(er instanceof SyntaxError)) throw er; }
        }
      }
      setSugestao(JSON.parse(acc));
    } catch (e: any) { toast.error(e?.message || 'Falha ao sugerir'); } finally { setSugerindo(false); }
  };

  const aplicar = () => {
    const s = sugestao; if (!s) return;
    onParams({
      ...p, categoria_atividade: s.categoria_atividade, atividade_anexo_iv: s.atividade_anexo_iv, regime: s.regime,
      n_domingos: s.n_domingos, prazo_folga_compensatoria_feriado: s.prazo_folga_compensatoria_feriado,
      fundamento_trabalho_domingo: s.fundamento_trabalho_domingo,
      ...(dadosCct.trim() ? { cct_vigente: true, regras_cct: { ...p.regras_cct,
        clausula_feriados: s.cct_clausula_feriados ?? p.regras_cct.clausula_feriados,
        n_domingos_max: s.cct_n_domingos_max ?? p.regras_cct.n_domingos_max,
        max_consecutivos: s.cct_max_consecutivos ?? p.regras_cct.max_consecutivos,
        prazo_folga_feriado: s.cct_prazo_folga_feriado ?? p.regras_cct.prazo_folga_feriado } } : {}),
    });
    toast.success('Parâmetros aplicados. Confira antes de gerar.');
  };

  const gerar = () => {
    const g = gerarEscala(p, fs);
    if (!is12x36(p)) onFuncionarios(g.funcionarios);
    setConflitos(g.conflitos);
    toast[g.conflitos.length ? 'warning' : 'success'](g.conflitos.length ? 'Escala gerada com pendências — veja a lista.' : 'Escala gerada sem bloqueios.');
  };

  return (
    <div className="space-y-4">
      {!readOnly && <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4" />Sugerir parâmetros pelo CNAE (IA)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>CNAE</Label><Input value={cnaeVal} placeholder="Ex.: 5510-8/01 Hotéis" onChange={(e) => setCnae(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Dados específicos / cláusulas da CCT (opcional)</Label>
            <Textarea rows={3} value={dadosCct} placeholder="Cole aqui as cláusulas da CCT sobre domingos, feriados, folgas, dias seguidos..." onChange={(e) => setDadosCct(e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={sugerir} disabled={sugerindo}>{sugerindo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Sugerir parâmetros</Button>
        {sugestao && <div className="rounded-md border p-3 text-sm space-y-1">
          <p><b>Atividade:</b> {sugestao.atividade_descricao}</p>
          <p><b>Categoria:</b> {CATEGORIA_LABEL[sugestao.categoria_atividade as Categoria] || sugestao.categoria_atividade} · <b>Anexo IV:</b> {sugestao.atividade_anexo_iv} · <b>Regime:</b> {sugestao.regime} · <b>N domingos:</b> {sugestao.n_domingos} · <b>Prazo FC:</b> {sugestao.prazo_folga_compensatoria_feriado} dias</p>
          <p><b>Fundamento:</b> {sugestao.fundamento_trabalho_domingo}</p>
          {(sugestao.cct_n_domingos_max != null || sugestao.cct_max_consecutivos != null || sugestao.cct_prazo_folga_feriado != null || sugestao.cct_clausula_feriados != null) && <p><b>Da CCT:</b> {[sugestao.cct_clausula_feriados != null && `cláusula de feriados: ${sugestao.cct_clausula_feriados ? 'sim' : 'não'}`, sugestao.cct_n_domingos_max != null && `N máx. ${sugestao.cct_n_domingos_max}`, sugestao.cct_max_consecutivos != null && `máx. ${sugestao.cct_max_consecutivos} dias seguidos`, sugestao.cct_prazo_folga_feriado != null && `prazo FC ${sugestao.cct_prazo_folga_feriado} dias`].filter(Boolean).join(' · ')}</p>}
          <p className="text-muted-foreground">{sugestao.justificativa}</p>
          {sugestao.alertas?.map((a: string, i: number) => <p key={i} className="flex gap-1 text-muted-foreground"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{a}</p>)}
          <Button size="sm" variant="outline" onClick={aplicar}>Aplicar à escala</Button>
        </div>}
      </Card>}

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Parâmetros</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Setor</Label><Input disabled={readOnly} value={p.setor} onChange={(e) => set('setor', e.target.value)} /></div>
          <div><Label>Regime</Label>
            <select disabled={readOnly} className={sel} value={p.regime} onChange={(e) => set('regime', e.target.value)}>
              {['6x1', '5x2', '5x1', '4x2', '12x36'].map((r) => <option key={r}>{r}</option>)}
            </select></div>
          <div><Label>Início</Label><Input disabled={readOnly} type="date" value={p.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} /></div>
          <div><Label>Fim</Label><Input disabled={readOnly} type="date" value={p.data_fim} onChange={(e) => set('data_fim', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Categoria da atividade</Label>
            <select disabled={readOnly} className={sel} value={p.categoria_atividade} onChange={(e) => set('categoria_atividade', e.target.value as Categoria)}>
              {Object.entries(CATEGORIA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          <div className="sm:col-span-2"><Label>Atividade do Anexo IV (feriados)</Label>
            <select disabled={readOnly} className={sel} value={p.atividade_anexo_iv} onChange={(e) => set('atividade_anexo_iv', e.target.value)}>
              {ATIVIDADES_ANEXO_IV.map((a) => <option key={a} value={a}>{a === 'nenhuma' ? 'Nenhuma' : a}</option>)}
            </select></div>
          <div className="sm:col-span-2 lg:col-span-4"><Label>Fundamento para trabalho aos domingos (e feriados)</Label>
            <Input disabled={readOnly} value={p.fundamento_trabalho_domingo} placeholder="Ex.: Lei 10.101/2000, art. 6º; CCT nº ..." onChange={(e) => set('fundamento_trabalho_domingo', e.target.value)} /></div>
          <div><Label>N de domingos (máx. {nMax})</Label><Input disabled={readOnly} type="number" min={1} value={p.n_domingos} onChange={(e) => set('n_domingos', Number(e.target.value))} /></div>
          <div><Label>Mínimo de pessoas por dia</Label><Input disabled={readOnly} type="number" min={0} value={p.minimo_diario} onChange={(e) => set('minimo_diario', Number(e.target.value))} /></div>
          <div><Label>Prazo folga compensatória (dias)</Label><Input disabled={readOnly} type="number" min={1} value={p.prazo_folga_compensatoria_feriado} onChange={(e) => set('prazo_folga_compensatoria_feriado', Number(e.target.value))} /></div>
          <div><Label>Responsável (assinatura)</Label><Input disabled={readOnly} value={p.responsavel_nome} onChange={(e) => set('responsavel_nome', e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm"><Checkbox disabled={readOnly} checked={p.cct_vigente} onCheckedChange={(c) => set('cct_vigente', !!c)} /> CCT vigente</label>
          {p.cct_vigente && (<>
            <Input disabled={readOnly} className="w-44" placeholder="Registro Mediador" value={p.cct_registro} onChange={(e) => set('cct_registro', e.target.value)} />
            <Input disabled={readOnly} className="w-44" placeholder="Vigência" value={p.cct_vigencia} onChange={(e) => set('cct_vigencia', e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><Checkbox disabled={readOnly} checked={!!p.regras_cct.clausula_feriados} onCheckedChange={(c) => set('regras_cct', { ...p.regras_cct, clausula_feriados: !!c })} /> Cláusula de feriados</label>
            <Input disabled={readOnly} className="w-36" type="number" placeholder="N máx. CCT" value={p.regras_cct.n_domingos_max ?? ''} onChange={(e) => set('regras_cct', { ...p.regras_cct, n_domingos_max: e.target.value ? Number(e.target.value) : null })} />
            <Input disabled={readOnly} className="w-40" type="number" placeholder="Máx. dias seguidos" value={p.regras_cct.max_consecutivos ?? ''} onChange={(e) => set('regras_cct', { ...p.regras_cct, max_consecutivos: e.target.value ? Number(e.target.value) : null })} />
            <Input disabled={readOnly} className="w-44" type="number" placeholder="Prazo FC (CCT)" value={p.regras_cct.prazo_folga_feriado ?? ''} onChange={(e) => set('regras_cct', { ...p.regras_cct, prazo_folga_feriado: e.target.value ? Number(e.target.value) : null })} />
          </>)}
        </div>
        <div className="space-y-2">
          <Label>Feriados no período</Label>
          {p.feriados.map((f, i) => (
            <div key={i} className="flex gap-2">
              <Input disabled={readOnly} type="date" className="w-44" value={f.data} onChange={(e) => set('feriados', p.feriados.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))} />
              <Input disabled={readOnly} value={f.nome} placeholder="Nome" onChange={(e) => set('feriados', p.feriados.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
              {!readOnly && <Button variant="ghost" size="icon" onClick={() => set('feriados', p.feriados.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>}
            </div>
          ))}
          {!readOnly && <Button variant="outline" size="sm" onClick={() => set('feriados', [...p.feriados, { data: p.data_inicio, nome: '' }])}><Plus className="w-4 h-4 mr-1" />Feriado</Button>}
        </div>
        {is12x36(p) && <p className="text-sm text-destructive">Escalas 12x36 ficam fora do motor (art. 59-A, p.u., CLT): DSR e feriados já são compensados. Nada será gerado.</p>}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Funcionários ({fs.length})</h3>
          {!readOnly && <div className="flex gap-2"><ImportarFuncionarios atuais={fs} onImportar={onFuncionarios} /><Button size="sm" variant="outline" onClick={() => onFuncionarios([...fs, novoFuncionario()])}><Plus className="w-4 h-4 mr-1" />Funcionário</Button></div>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Código</th><th className="p-1">Nome</th><th className="p-1">Cargo</th><th className="p-1">Sexo</th><th className="p-1">Art. 386</th>
              <th className="p-1">Última folga antes</th><th className="p-1">Último domingo de folga</th><th className="p-1">Entrada</th><th className="p-1">Saída</th><th />
            </tr></thead>
            <tbody>{fs.map((f, i) => (
              <tr key={f.id} className="align-top border-t">
                <td className="p-1 w-20"><Input disabled={readOnly} value={f.codigo} onChange={(e) => setF(i, { codigo: e.target.value })} /></td>
                <td className="p-1"><Input disabled={readOnly} value={f.nome} onChange={(e) => setF(i, { nome: e.target.value })} /></td>
                <td className="p-1"><Input disabled={readOnly} value={f.cargo} onChange={(e) => setF(i, { cargo: e.target.value })} /></td>
                <td className="p-1 w-20"><select disabled={readOnly} className={sel} value={f.sexo} onChange={(e) => { const s = e.target.value as 'M' | 'F'; setF(i, { sexo: s, art386_ativo: s === 'F' }); }}><option value="M">M</option><option value="F">F</option></select></td>
                <td className="p-1 w-48">{f.sexo === 'F' ? (<div className="space-y-1">
                  <label className="flex items-center gap-2"><Checkbox disabled={readOnly} checked={f.art386_ativo} onCheckedChange={(c) => setF(i, { art386_ativo: !!c })} /> Ativo</label>
                  {!f.art386_ativo && <Textarea disabled={readOnly} rows={2} placeholder="Justificativa (obrigatória)" value={f.art386_justificativa_desativacao} onChange={(e) => setF(i, { art386_justificativa_desativacao: e.target.value })} />}
                </div>) : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-1 w-40"><Input disabled={readOnly} type="date" value={f.ultima_folga_anterior || ''} onChange={(e) => setF(i, { ultima_folga_anterior: e.target.value || null })} /></td>
                <td className="p-1 w-40"><Input disabled={readOnly} type="date" value={f.ultimo_domingo_folga_anterior || ''} onChange={(e) => setF(i, { ultimo_domingo_folga_anterior: e.target.value || null })} /></td>
                <td className="p-1 w-24"><Input disabled={readOnly} placeholder="08:00" value={f.hora_entrada} onChange={(e) => setF(i, { hora_entrada: e.target.value })} /></td>
                <td className="p-1 w-24"><Input disabled={readOnly} placeholder="17:00" value={f.hora_saida} onChange={(e) => setF(i, { hora_saida: e.target.value })} /></td>
                <td className="p-1">{!readOnly && <Button variant="ghost" size="icon" onClick={() => onFuncionarios(fs.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Grade</h3>
          <div className="flex flex-wrap gap-2 text-xs items-center">
            {(['T', 'F', 'FC', 'A'] as TipoDia[]).map((t) => <span key={t} className={`px-2 py-0.5 rounded border ${corTipo[t]}`}>{t} = {t === 'T' ? 'trabalho' : t === 'F' ? 'folga' : t === 'FC' ? 'folga compensatória' : 'afastado'}</span>)}
            {!readOnly && <Button size="sm" onClick={gerar} disabled={!fs.length || is12x36(p)}><Wand2 className="w-4 h-4 mr-1" />Gerar escala automática</Button>}
          </div>
        </div>
        {!readOnly && <p className="text-xs text-muted-foreground">Clique numa célula para alternar T → F → FC → A.</p>}
        <div className="overflow-x-auto border rounded-md">
          <table className="text-xs border-collapse">
            <thead><tr>
              <th className="sticky left-0 z-10 bg-card p-1 text-left min-w-[150px] border-r">Funcionário</th>
              {dias.map((d) => <th key={d} className={`p-1 min-w-[30px] text-center ${diaSemana(d) === 0 || fer.has(d) ? 'bg-primary text-primary-foreground' : ''}`}>{d.slice(8)}<br />{SEM[diaSemana(d)]}</th>)}
            </tr></thead>
            <tbody>
              {fs.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-card p-1 border-r truncate max-w-[150px]">{f.nome || '(sem nome)'}</td>
                  {dias.map((d) => {
                    const t = f.dias[d] || 'T';
                    const erros = res.porCelula[`${f.id}|${d}`];
                    return (
                      <td key={d} title={erros?.join(', ')} className={`p-0 border text-center ${erros ? 'ring-2 ring-inset ring-destructive' : ''}`}>
                        <button type="button" disabled={readOnly} className={`w-full h-7 ${corTipo[t]}`}
                          onClick={() => { const nx = CICLO[(CICLO.indexOf(t) + 1) % CICLO.length]; onFuncionarios(fs.map((x) => (x.id === f.id ? { ...x, dias: { ...x.dias, [d]: nx } } : x))); }}>{t}</button>
                      </td>);
                  })}
                </tr>))}
              <tr className="border-t font-semibold">
                <td className="sticky left-0 z-10 bg-card p-1 border-r">Cobertura</td>
                {dias.map((d) => { const c = cobertura(d); return <td key={d} className={`text-center ${p.minimo_diario && c < p.minimo_diario ? 'text-destructive' : ''}`}>{c}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <PainelViolacoes res={res} conflitos={conflitos} funcionarios={fs} />
    </div>
  );
}

export function PainelViolacoes({ res, conflitos = [], funcionarios }: { res: ReturnType<typeof validarEscala>; conflitos?: string[]; funcionarios: EscalaFuncionario[] }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Validação</h3>
        <Badge variant={res.bloqueios.length ? 'destructive' : 'secondary'}>{res.bloqueios.length} bloqueio(s)</Badge>
        <Badge variant="outline">{res.alertas.length} alerta(s)</Badge>
      </div>
      {!res.bloqueios.length && <p className="text-sm flex items-center gap-1 text-primary"><CheckCircle2 className="w-4 h-4" />Nenhum bloqueio.</p>}
      {conflitos.length > 0 && <div className="text-sm space-y-1"><p className="font-medium">Resultado do gerador:</p>{conflitos.map((c, i) => <p key={i}>• {c}</p>)}</div>}
      <ul className="text-sm space-y-1 max-h-72 overflow-auto">
        {res.bloqueios.map((b, i) => <li key={'b' + i} className="flex gap-2 text-destructive"><Ban className="w-4 h-4 shrink-0 mt-0.5" />{b.mensagem}</li>)}
        {res.alertas.map((a, i) => <li key={'a' + i} className="flex gap-2 text-muted-foreground"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{a.mensagem}</li>)}
      </ul>
      {funcionarios.length > 0 && <p className="text-xs text-muted-foreground">Domingos trabalhados: {funcionarios.map((f) => `${f.nome || '—'}: ${res.domingosTrabalhados[f.id] ?? 0}`).join(' · ')}</p>}
    </Card>
  );
}

export function fmtPeriodo(a: string, b: string) { return `${fmtBR(a)} a ${fmtBR(b)}`; }
