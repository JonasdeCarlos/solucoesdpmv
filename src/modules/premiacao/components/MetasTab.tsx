import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { tbl, fmtComp, type Catalogo, type Lancamento, type Meta, type Politica } from '../hooks/usePremiacao';

export default function MetasTab({ politica, cat, competencia }: { politica: Politica; cat: Catalogo; competencia: string }) {
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [manuais, setManuais] = useState<any[]>([]);
  const [busca, setBusca] = useState<Record<string, string>>({});
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const load = async () => {
    const { data } = await tbl('premiacao_lancamentos').select('*').eq('politica_id', politica.id).eq('competencia', competencia).eq('tipo', 'servico');
    setLancs(data || []);
    const ids = cat.metas.map(m => m.id);
    if (ids.length) { const r = await tbl('premiacao_metas_manuais').select('*').in('meta_id', ids).eq('competencia', competencia); setManuais(r.data || []); }
  };
  useEffect(() => { load(); }, [politica.id, competencia, cat.metas]);

  const upd = async (id: string, patch: Partial<Meta>) => { const { error } = await tbl('premiacao_metas').update(patch).eq('id', id); if (error) toast.error(error.message); else cat.reload(); };
  const add = async () => { const { error } = await tbl('premiacao_metas').insert({ politica_id: politica.id, nome: 'Nova meta', quantidade_alvo: 10, unidade: 'serviços', pontos_trofeu: 100 }); if (error) toast.error(error.message); else cat.reload(); };
  const toggleCodigo = async (meta_id: string, servico_id: string, on: boolean) => {
    const r = on ? await tbl('premiacao_metas_servicos').insert({ meta_id, servico_id, peso_contagem: 1 })
      : await tbl('premiacao_metas_servicos').delete().eq('meta_id', meta_id).eq('servico_id', servico_id);
    if (r.error) toast.error(r.error.message); else cat.reload();
  };
  const setPeso = async (meta_id: string, servico_id: string, peso: number) => {
    await tbl('premiacao_metas_servicos').update({ peso_contagem: peso || 1 }).eq('meta_id', meta_id).eq('servico_id', servico_id); cat.reload();
  };
  const marcarManual = async (meta_id: string, colaborador_id: string, on: boolean) => {
    if (on) await tbl('premiacao_metas_manuais').upsert({ meta_id, colaborador_id, competencia, atingida: true }, { onConflict: 'meta_id,colaborador_id,competencia' });
    else await tbl('premiacao_metas_manuais').delete().eq('meta_id', meta_id).eq('colaborador_id', colaborador_id).eq('competencia', competencia);
    load();
  };

  const progresso = useMemo(() => cat.metas.filter(m => m.ativo).map(m => {
    const vinc = cat.metasServicos.filter(x => x.meta_id === m.id);
    const porColab = cat.colaboradores.filter(c => c.ativo).map(c => {
      const ls = lancs.filter(l => l.colaborador_id === c.id && vinc.some(v => v.servico_id === l.servico_id));
      const realizado = ls.reduce((s, l) => s + l.quantidade * (vinc.find(v => v.servico_id === l.servico_id)?.peso_contagem || 1), 0);
      const manual = manuais.some(x => x.meta_id === m.id && x.colaborador_id === c.id && x.atingida);
      return { c, ls, realizado, ok: m.modo_apuracao === 'manual' ? manual : realizado >= m.quantidade_alvo };
    });
    return { m, porColab };
  }), [cat, lancs, manuais]);

  return (
    <div className="space-y-4 pt-2">
      <p className="text-xs text-muted-foreground">Sessão apartada: as metas contam a QUANTIDADE de serviços dos códigos designados e concedem um troféu com pontos próprios (uma vez por meta, por competência). Um mesmo lançamento pode gerar medalha e contar para meta.</p>
      {cat.metas.map(m => {
        const vinc = cat.metasServicos.filter(x => x.meta_id === m.id);
        const q = (busca[m.id] || '').toLowerCase();
        return (
          <Card key={m.id}><CardContent className="p-3 space-y-3">
            <div className="grid md:grid-cols-6 gap-2 items-end">
              <div className="md:col-span-2"><Label className="text-xs">Nome</Label><Input className="h-8" defaultValue={m.nome} onBlur={e => upd(m.id, { nome: e.target.value })} /></div>
              <div><Label className="text-xs">Quantidade alvo</Label><Input type="number" className="h-8" defaultValue={m.quantidade_alvo} onBlur={e => upd(m.id, { quantidade_alvo: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Unidade</Label><Input className="h-8" defaultValue={m.unidade || ''} onBlur={e => upd(m.id, { unidade: e.target.value })} /></div>
              <div><Label className="text-xs">Pontos do troféu</Label><Input type="number" className="h-8" defaultValue={m.pontos_trofeu} onBlur={e => upd(m.id, { pontos_trofeu: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Apuração</Label>
                <Select value={m.modo_apuracao} onValueChange={v => upd(m.id, { modo_apuracao: v as any })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="automatico">Automática</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Switch checked={m.ativo} onCheckedChange={v => upd(m.id, { ativo: v })} /> Ativa
              <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { if (confirm('Excluir meta?')) { await tbl('premiacao_metas').delete().eq('id', m.id); cat.reload(); } }}><Trash2 className="w-4 h-4" /></Button>
            </div>
            {m.modo_apuracao === 'automatico' && (
              <div className="border rounded p-2 space-y-2">
                <div className="flex items-center gap-2"><span className="text-xs font-medium">Códigos que entram na contagem ({vinc.length})</span>
                  <Input className="h-7 max-w-56 ml-auto" placeholder="Buscar código ou descrição" value={busca[m.id] || ''} onChange={e => setBusca({ ...busca, [m.id]: e.target.value })} /></div>
                <div className="grid md:grid-cols-2 gap-1 max-h-48 overflow-auto">
                  {cat.servicos.filter(s => !q || s.codigo.includes(q) || s.descricao.toLowerCase().includes(q)).map(s => {
                    const v = vinc.find(x => x.servico_id === s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs">
                        <Checkbox checked={!!v} onCheckedChange={on => toggleCodigo(m.id, s.id, !!on)} />
                        <span className="font-mono">{s.codigo}</span><span className="flex-1 truncate">{s.descricao}</span>
                        {v && <Input type="number" title="Peso de contagem" className="h-6 w-14" defaultValue={v.peso_contagem} onBlur={e => setPeso(m.id, s.id, Number(e.target.value))} />}
                      </label>);
                  })}
                </div>
              </div>
            )}
          </CardContent></Card>
        );
      })}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Nova meta</Button>

      <h4 className="font-semibold text-sm pt-2">Acompanhamento — {fmtComp(competencia)}</h4>
      {progresso.map(({ m, porColab }) => (
        <Card key={m.id}><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm"><Trophy className="w-4 h-4 text-primary" />{m.nome} <span className="text-muted-foreground text-xs">— {m.quantidade_alvo} {m.unidade} • {m.pontos_trofeu} pts</span></div>
          {porColab.map(({ c, ls, realizado, ok }) => (
            <div key={c.id} className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-48 truncate">{c.nome}</span>
                {m.modo_apuracao === 'manual'
                  ? <label className="flex items-center gap-1"><Checkbox checked={ok} onCheckedChange={v => marcarManual(m.id, c.id, !!v)} /> Atingida (marcação do gestor)</label>
                  : <><Progress value={Math.min(100, (realizado / Math.max(1, m.quantidade_alvo)) * 100)} className="flex-1 h-2" />
                    <span className="w-32 text-right">{realizado} / {m.quantidade_alvo} {m.unidade}</span>
                    <button className="underline text-muted-foreground" onClick={() => setDetalhe(detalhe === m.id + c.id ? null : m.id + c.id)}>{ls.length} lanç.</button></>}
                <Badge variant={ok ? 'default' : 'outline'}>{ok ? 'Atingida' : 'Em andamento'}</Badge>
              </div>
              {detalhe === m.id + c.id && <ul className="pl-52 text-muted-foreground">{ls.map(l => <li key={l.id}>{l.data_ocorrencia.split('-').reverse().join('/')} — {l.codigo} {l.descricao} × {l.quantidade}{l.referencia_os ? ` (OS ${l.referencia_os})` : ''}</li>)}</ul>}
            </div>
          ))}
        </CardContent></Card>
      ))}
    </div>
  );
}
