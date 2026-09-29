import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, Calculator, Download, FileUp } from 'lucide-react';
import ImportarExtratoDialog from './ImportarExtratoDialog';
import SaldoCard from './SaldoCard';
import { calcularAjuste, round2 } from '../utils/rateio';
import { fmt, parseNum, competenciaAAAAMM } from '../utils/validacoes';
import { gerarArquivo, nomeArquivo, baixarTxt } from '../utils/dominioLayout';
import { loadDistribuicao, saveDistribuicao, saveExportacao, updateCompetencia, type TsCompetencia, type TsConfig, type TsDistribuicao, type TsFuncionario, type TsSaldo } from '../hooks/useTaxaServico';

interface Props { comp: TsCompetencia; config: TsConfig; funcionarios: TsFuncionario[]; saldo: TsSaldo; onSaldoClick: () => void; onChanged: () => void }

export default function AjusteFechamento({ comp, config, funcionarios, saldo, onSaldoClick, onChanged }: Props) {
  const [dist, setDist] = useState<TsDistribuicao[]>([]);
  const [imp, setImp] = useState<'extrato' | 'alvo' | null>(null);
  const [ordem, setOrdem] = useState<'codigo' | 'nome'>('codigo');
  const byId = new Map(funcionarios.map((f) => [f.id, f]));
  const byCod = new Map(funcionarios.map((f) => [f.codigo.replace(/^0+/, ''), f.id]));

  useEffect(() => { loadDistribuicao(comp.id).then((d) => setDist(d.filter((x) => x.pontos > 0))); }, [comp.id]);

  const distOrdenada = useMemo(() => [...dist].sort((a, b) => {
    const fa = byId.get(a.funcionario_id); const fb = byId.get(b.funcionario_id);
    if (ordem === 'codigo') return Number(fa?.codigo ?? 0) - Number(fb?.codigo ?? 0) || (fa?.codigo ?? '').localeCompare(fb?.codigo ?? '');
    return (fa?.nome ?? '').localeCompare(fb?.nome ?? '', 'pt-BR');
  }), [dist, ordem, funcionarios]);

  const set = (fid: string, p: Partial<TsDistribuicao>) => setDist((ds) => ds.map((d) => d.funcionario_id === fid ? { ...d, ...p } : d));

  const aplicarImport = (campo: 'rendimento_bruto_extrato' | 'valor_bruto_alvo') => async (rows: { codigo: string; valor: number }[]) => {
    let n = 0;
    const m = new Map(rows.map((r) => [r.codigo.replace(/^0+/, ''), r.valor]));
    setDist((ds) => ds.map((d) => {
      const cod = byId.get(d.funcionario_id)?.codigo.replace(/^0+/, '') || '';
      if (m.has(cod)) { n++; return { ...d, [campo]: m.get(cod)! }; }
      return d;
    }));
    toast.success(`${n} funcionário(s) atualizado(s)`);
    void byCod;
  };

  const recalcular = async () => {
    const novo = dist.map((d) => ({ ...d, ...calcularAjuste(d) }));
    setDist(novo);
    const err = await saveDistribuicao(novo);
    if (err) toast.error(err.message); else toast.success('Comissões recalculadas');
  };

  const original = round2(dist.reduce((s, d) => s + d.valor_comissao, 0));
  const ajustado = round2(dist.reduce((s, d) => s + (d.valor_ajustado ?? d.valor_comissao), 0));
  const saldoComp = round2(original - ajustado);
  const calculado = dist.some((d) => d.valor_ajustado != null);

  const exportar = async () => {
    if (!calculado) return toast.error('Clique em "Recalcular comissões" antes.');
    const aaaamm = competenciaAAAAMM(comp.competencia);
    const { conteudo, erros } = gerarArquivo(dist.filter((d) => byId.get(d.funcionario_id)?.gera_lancamento !== false).map((d) => ({
      codigoEmpregado: byId.get(d.funcionario_id)?.codigo || '', competencia: aaaamm, rubrica: comp.codigo_verba || config.codigo_verba_padrao || '',
      tipoProcesso: comp.tipo_processo || '11', valor: d.valor_ajustado ?? d.valor_comissao, codigoEmpresa: config.codigo_empresa_dominio,
    })));
    if (erros.length) return toast.error(erros.join(' | '));
    await saveDistribuicao(dist);
    const nome = nomeArquivo(aaaamm, config.codigo_empresa_dominio, 'ajustado');
    baixarTxt(nome, conteudo);
    await saveExportacao(comp.id, 'ajustado', nome, conteudo);
    await updateCompetencia(comp.id, { saldo_nao_distribuido: saldoComp, status: 'ajustado' });
    toast.success('Arquivo ajustado gerado');
    onChanged();
  };

  return (
    <div className="space-y-4">
      <SaldoCard saldo={saldo} onClick={onSaldoClick} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setImp('extrato')}><FileUp className="w-4 h-4 mr-1" />Importar extrato da folha</Button>
        <Button variant="outline" onClick={() => setImp('alvo')}><FileUp className="w-4 h-4 mr-1" />Importar bruto alvo</Button>
        <Button onClick={recalcular}><Calculator className="w-4 h-4 mr-1" />Recalcular comissões</Button>
        <Button onClick={exportar} variant="secondary"><Download className="w-4 h-4 mr-1" />Exportar arquivo ajustado</Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar por:</span>
        <Button size="sm" variant={ordem === 'codigo' ? 'default' : 'outline'} onClick={() => setOrdem('codigo')}>Código</Button>
        <Button size="sm" variant={ordem === 'nome' ? 'default' : 'outline'} onClick={() => setOrdem('nome')}>Ordem alfabética</Button>
      </div>
      <div className="border rounded-md max-h-[50vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0"><tr>
            <th className="p-2 text-left">Funcionário</th><th className="p-2 text-right">Comissão original</th><th className="p-2 text-right">Bruto extrato</th>
            <th className="p-2 w-32">Bruto alvo</th><th className="p-2 text-right">Diferença</th><th className="p-2 text-right">Ajustado</th><th className="p-2">Alerta</th>
          </tr></thead>
          <tbody>{distOrdenada.map((d) => {
            const f = byId.get(d.funcionario_id);
            return (
              <tr key={d.funcionario_id} className="border-t">
                <td className="p-2">{f?.codigo} – {f?.nome}</td>
                <td className="p-2 text-right">{fmt(d.valor_comissao)}</td>
                <td className="p-1"><Input className="text-right" inputMode="decimal" defaultValue={d.rendimento_bruto_extrato ?? ''} key={`e${d.rendimento_bruto_extrato}`} onBlur={(e) => set(d.funcionario_id, { rendimento_bruto_extrato: e.target.value ? parseNum(e.target.value) : null })} /></td>
                <td className="p-1"><Input className="text-right" inputMode="decimal" defaultValue={d.valor_bruto_alvo ?? ''} key={`a${d.valor_bruto_alvo}`} onBlur={(e) => set(d.funcionario_id, { valor_bruto_alvo: e.target.value ? parseNum(e.target.value) : null })} /></td>
                <td className="p-2 text-right">{d.diferenca == null ? '—' : fmt(d.diferenca)}</td>
                <td className="p-2 text-right font-medium">{d.valor_ajustado == null ? '—' : fmt(d.valor_ajustado)}</td>
                <td className="p-2 text-xs">{d.alerta && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" />{d.alerta}</span>}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-md bg-muted/40 p-3">Líquido original distribuído<br /><b>{fmt(original)}</b></div>
        <div className="rounded-md bg-muted/40 p-3">Total ajustado<br /><b>{fmt(ajustado)}</b></div>
        <div className={`rounded-md p-3 ${saldoComp < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>
          {saldoComp < 0 ? 'Consumo de saldo por acréscimo' : 'Saldo não distribuído da competência'}<br /><b>{fmt(saldoComp)}</b>
        </div>
      </div>
      <ImportarExtratoDialog open={imp === 'extrato'} onOpenChange={(o) => !o && setImp(null)} empresaId={comp.empresa_id} onConfirm={aplicarImport('rendimento_bruto_extrato')} />
      <ImportarExtratoDialog open={imp === 'alvo'} onOpenChange={(o) => !o && setImp(null)} empresaId={comp.empresa_id} valorLabel="Bruto alvo" permitirPdf={false} onConfirm={aplicarImport('valor_bruto_alvo')} />
    </div>
  );
}
