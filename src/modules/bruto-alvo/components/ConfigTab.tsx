import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { fbDb, saveConfig, saveRubrica, type FbConfig, type FbFeriado, type FbModelo, type FbRubrica } from '../hooks/useBrutoAlvo';
import type { ItemCfg, Modo } from '../utils/motor';
import { parseNum } from '@/modules/taxa-servico/utils/validacoes';

interface Props { empresaId: string; config: FbConfig; rubricas: FbRubrica[]; feriados: FbFeriado[]; modelos: FbModelo[]; reload: () => void }

export default function ConfigTab({ empresaId, config, rubricas, feriados, modelos, reload }: Props) {
  const [c, setC] = useState(config);
  const [fer, setFer] = useState({ data: '', descricao: '', abrangencia: 'municipal' });
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', perc: '', integra: true });
  useEffect(() => setC(config), [config]);
  const variaveis = rubricas.filter((r) => r.tipo === 'variavel');

  const salvarConfig = async () => { const e = await saveConfig(c); if (e) toast.error(e.message); else { toast.success('Configuração salva'); reload(); } };
  const salvarRub = async (r: FbRubrica, patch: Partial<FbRubrica>) => { const e = await saveRubrica({ ...r, ...patch }); if (e) toast.error(e.message); else reload(); };
  const addFixa = async () => {
    if (!novaFixa.descricao) return;
    await saveRubrica({ empresa_id: empresaId, verba: 'FIXA_' + Date.now(), descricao: novaFixa.descricao, tipo: 'fixa', fator: 0, valor_fixo: parseNum(novaFixa.valor) || null, percentual_salario: parseNum(novaFixa.perc) || null, gera_dsr: false, integra_base_hora: novaFixa.integra, exporta: false, ativo: true, ordem: 10 });
    setNovaFixa({ descricao: '', valor: '', perc: '', integra: true }); reload();
  };
  const addFeriado = async () => {
    if (!fer.data) return;
    const { error } = await fbDb.from('fb_feriados').upsert({ empresa_id: empresaId, ...fer }, { onConflict: 'empresa_id,data' });
    if (error) toast.error(error.message); else { setFer({ data: '', descricao: '', abrangencia: 'municipal' }); reload(); }
  };
  const salvarModelo = async (m: FbModelo, itens: ItemCfg[]) => {
    if (itens.filter((i) => i.modo === 'ajuste').length !== 1) return toast.error('O modelo precisa de exatamente UMA verba em "ajuste".');
    await fbDb.from('fb_modelos_distribuicao').update({ itens }).eq('id', m.id); toast.success('Modelo salvo'); reload();
  };
  const tornarPadrao = async (m: FbModelo) => {
    await fbDb.from('fb_modelos_distribuicao').update({ padrao: false }).eq('empresa_id', empresaId);
    await fbDb.from('fb_modelos_distribuicao').update({ padrao: true }).eq('id', m.id); reload();
  };
  const novoModelo = async () => {
    const nome = prompt('Nome do modelo'); if (!nome) return;
    await fbDb.from('fb_modelos_distribuicao').insert({ empresa_id: empresaId, nome, padrao: false, itens: modelos.find((m) => m.padrao)?.itens || [] }); reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros da empresa</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-3">
          <div><Label>Divisor</Label><Input value={c.divisor} onChange={(e) => setC({ ...c, divisor: parseNum(e.target.value) })} /></div>
          <div><Label>Tolerância (R$)</Label><Input value={c.tolerancia} onChange={(e) => setC({ ...c, tolerancia: parseNum(e.target.value) })} /></div>
          <div><Label>Teto quinquênio (%)</Label><Input value={c.teto_quinquenio ?? ''} placeholder="sem teto" onChange={(e) => setC({ ...c, teto_quinquenio: e.target.value ? parseNum(e.target.value) : null })} /></div>
          <div><Label>Limite HE por dia útil (h)</Label><Input value={c.limite_he_diario} onChange={(e) => setC({ ...c, limite_he_diario: parseNum(e.target.value) })} /></div>
          <div><Label>Formato das horas</Label>
            <Select value={c.formato_horas} onValueChange={(v: any) => setC({ ...c, formato_horas: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="hhmm">hhh:mm (38:02 → 3802)</SelectItem><SelectItem value="centesimal">Centesimal (38,03)</SelectItem></SelectContent></Select></div>
          <div><Label>Critério do ajuste</Label>
            <Select value={c.criterio_ajuste} onValueChange={(v: any) => setC({ ...c, criterio_ajuste: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="mais_proximo">Mais próximo do alvo</SelectItem><SelectItem value="nunca_ultrapassar">Nunca ultrapassar o alvo</SelectItem></SelectContent></Select></div>
          <div><Label>Código empresa Domínio</Label><Input value={c.codigo_empresa_dominio || ''} onChange={(e) => setC({ ...c, codigo_empresa_dominio: e.target.value })} /></div>
          <div><Label>Tipo de processo</Label><Input value={c.tipo_processo} onChange={(e) => setC({ ...c, tipo_processo: e.target.value })} /></div>
          <div className="sm:col-span-4"><Button onClick={salvarConfig}>Salvar parâmetros</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rubricas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="p-1">Verba</th><th className="p-1">Tipo</th><th className="p-1">Código Domínio</th><th className="p-1">Fator / Valor / %</th><th className="p-1">Gera DSR</th><th className="p-1">Integra hora-base</th><th className="p-1">Exporta</th><th className="p-1">Ativa</th><th /></tr></thead>
            <tbody>{rubricas.map((r) => (
              <tr key={r.verba} className="border-t">
                <td className="p-1">{r.descricao}</td>
                <td className="p-1 text-xs">{r.tipo === 'variavel' ? 'Horas' : r.tipo === 'quinquenio' ? 'Quinquênio' : 'Fixa'}</td>
                <td className="p-1">{r.tipo === 'variavel' ? <Input className={`h-8 w-24 ${!r.codigo_rubrica_dominio ? 'border-destructive' : ''}`} defaultValue={r.codigo_rubrica_dominio || ''} onBlur={(e) => e.target.value !== (r.codigo_rubrica_dominio || '') && salvarRub(r, { codigo_rubrica_dominio: e.target.value })} /> : <span className="text-xs text-muted-foreground">calculado pelo Domínio</span>}</td>
                <td className="p-1">
                  {r.tipo === 'variavel' && <Input className="h-8 w-24" defaultValue={r.fator} onBlur={(e) => parseNum(e.target.value) !== r.fator && salvarRub(r, { fator: parseNum(e.target.value) })} />}
                  {r.tipo === 'fixa' && <span className="text-xs">{r.valor_fixo ? `R$ ${r.valor_fixo}` : `${r.percentual_salario}% do salário`}</span>}
                  {r.tipo === 'quinquenio' && <span className="text-xs">5% a cada 5 anos</span>}
                </td>
                <td className="p-1">{r.tipo === 'variavel' && <input type="checkbox" checked={r.gera_dsr} onChange={(e) => salvarRub(r, { gera_dsr: e.target.checked })} />}</td>
                <td className="p-1">{r.tipo !== 'variavel' && <input type="checkbox" checked={r.integra_base_hora} onChange={(e) => salvarRub(r, { integra_base_hora: e.target.checked })} />}</td>
                <td className="p-1">{r.tipo === 'variavel' && <input type="checkbox" checked={r.exporta} onChange={(e) => salvarRub(r, { exporta: e.target.checked })} />}</td>
                <td className="p-1"><input type="checkbox" checked={r.ativo} onChange={(e) => salvarRub(r, { ativo: e.target.checked })} /></td>
                <td className="p-1">{r.tipo === 'fixa' && <Button size="icon" variant="ghost" onClick={async () => { await fbDb.from('fb_config_rubricas').delete().eq('empresa_id', empresaId).eq('verba', r.verba); reload(); }}><Trash2 className="w-4 h-4" /></Button>}</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="flex flex-wrap gap-2 items-end mt-3">
            <div><Label className="text-xs">Nova verba fixa</Label><Input className="h-8" value={novaFixa.descricao} onChange={(e) => setNovaFixa({ ...novaFixa, descricao: e.target.value })} /></div>
            <div><Label className="text-xs">Valor fixo</Label><Input className="h-8 w-24" value={novaFixa.valor} onChange={(e) => setNovaFixa({ ...novaFixa, valor: e.target.value })} /></div>
            <div><Label className="text-xs">ou % do salário</Label><Input className="h-8 w-24" value={novaFixa.perc} onChange={(e) => setNovaFixa({ ...novaFixa, perc: e.target.value })} /></div>
            <label className="text-xs flex items-center gap-1 h-8"><input type="checkbox" checked={novaFixa.integra} onChange={(e) => setNovaFixa({ ...novaFixa, integra: e.target.checked })} />Integra hora-base</label>
            <Button size="sm" variant="outline" onClick={addFixa}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Modelos de distribuição</CardTitle><Button size="sm" variant="outline" onClick={novoModelo}><Plus className="w-4 h-4 mr-1" />Novo modelo</Button></CardHeader>
        <CardContent className="space-y-4">
          {modelos.map((m) => <ModeloEditor key={m.id} m={m} variaveis={variaveis} onSave={(it) => salvarModelo(m, it)} onPadrao={() => tornarPadrao(m)} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Feriados da empresa</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            <Input type="date" className="h-8 w-40" value={fer.data} onChange={(e) => setFer({ ...fer, data: e.target.value })} />
            <Input className="h-8 w-56" placeholder="Descrição" value={fer.descricao} onChange={(e) => setFer({ ...fer, descricao: e.target.value })} />
            <Select value={fer.abrangencia} onValueChange={(v) => setFer({ ...fer, abrangencia: v })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="nacional">Nacional</SelectItem><SelectItem value="estadual">Estadual</SelectItem><SelectItem value="municipal">Municipal</SelectItem></SelectContent></Select>
            <Button size="sm" variant="outline" onClick={addFeriado}><Plus className="w-4 h-4" /></Button>
          </div>
          {feriados.map((f) => (
            <div key={f.id} className="flex items-center gap-3 text-sm border-t pt-1">
              <span className="w-24">{f.data.split('-').reverse().join('/')}</span><span className="flex-1">{f.descricao}</span><span className="text-xs text-muted-foreground">{f.abrangencia}</span>
              <Button size="icon" variant="ghost" onClick={async () => { await fbDb.from('fb_feriados').delete().eq('id', f.id); reload(); }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ModeloEditor({ m, variaveis, onSave, onPadrao }: { m: FbModelo; variaveis: FbRubrica[]; onSave: (i: ItemCfg[]) => void; onPadrao: () => void }) {
  const [itens, setItens] = useState<ItemCfg[]>(() => variaveis.map((v) => m.itens.find((i) => i.verba === v.verba) || { verba: v.verba, modo: 'percentual', percentual: 0 }));
  const set = (verba: string, patch: Partial<ItemCfg>) => setItens((l) => l.map((i) => (i.verba === verba ? { ...i, ...patch } : i)));
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between"><b className="text-sm">{m.nome}{m.padrao && ' (padrão)'}</b>{!m.padrao && <Button size="sm" variant="ghost" onClick={onPadrao}>Tornar padrão</Button>}</div>
      {itens.map((i) => (
        <div key={i.verba} className="flex items-center gap-2 text-sm">
          <span className="w-48">{variaveis.find((v) => v.verba === i.verba)?.descricao}</span>
          <Select value={i.modo} onValueChange={(v: Modo) => set(i.verba, { modo: v })}><SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="percentual">% do saldo</SelectItem><SelectItem value="horas_fixas">Horas fixas</SelectItem><SelectItem value="ajuste">Ajuste (resto)</SelectItem></SelectContent></Select>
          {i.modo === 'percentual' && <Input className="h-8 w-20" value={i.percentual ?? 0} onChange={(e) => set(i.verba, { percentual: parseNum(e.target.value) })} />}
          {i.modo === 'percentual' && <span className="text-xs text-muted-foreground">% (já inclui o DSR)</span>}
          {i.modo === 'horas_fixas' && <span className="text-xs text-muted-foreground">informadas por funcionário</span>}
        </div>
      ))}
      <Button size="sm" onClick={() => onSave(itens)}>Salvar modelo</Button>
    </div>
  );
}
