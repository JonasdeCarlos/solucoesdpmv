import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ratear } from '../utils/rateio';
import { fmt, parseNum } from '../utils/validacoes';
import { loadDistribuicao, saveDistribuicao, updateCompetencia, type TsCompetencia, type TsFuncionario } from '../hooks/useTaxaServico';

interface Props { comp: TsCompetencia; funcionarios: TsFuncionario[]; onBack: () => void; onNext: () => void }

export default function StepRateio({ comp, funcionarios, onBack, onNext }: Props) {
  const ativos = funcionarios.filter((f) => f.ativo);
  const [pontos, setPontos] = useState<Record<string, string>>({});
  const bloqueado = comp.status === 'exportado' || comp.status === 'ajustado';

  useEffect(() => {
    loadDistribuicao(comp.id).then((d) => setPontos(Object.fromEntries(d.map((x) => [x.funcionario_id, String(x.pontos)]))));
  }, [comp.id]);

  const r = useMemo(() => ratear(comp.valor_liquido, ativos.map((f) => ({ funcionario_id: f.id, pontos: parseNum(pontos[f.id]) }))), [comp.valor_liquido, ativos, pontos]);

  const salvar = async () => {
    if (bloqueado) return onNext();
    if (!r.totalPontos) return toast.error('Informe os pontos.');
    if (r.diferenca !== 0) return toast.error('A soma distribuída difere do líquido.');
    const err = await saveDistribuicao(r.itens.map((i) => ({
      competencia_id: comp.id, funcionario_id: i.funcionario_id, pontos: i.pontos, valor_comissao: i.valor_comissao,
      rendimento_bruto_extrato: null, valor_bruto_alvo: null, diferenca: null, valor_ajustado: null, alerta: null,
    })));
    if (err) return toast.error(err.message);
    await updateCompetencia(comp.id, { status: 'calculado' });
    toast.success('Rateio salvo');
    onNext();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">Líquido a distribuir: <b className="text-primary">{fmt(comp.valor_liquido)}</b></p>
      <div className="border rounded-md max-h-[50vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 w-32">Pontos</th><th className="p-2 text-right">Comissão</th></tr></thead>
          <tbody>{ativos.map((f) => {
            const it = r.itens.find((i) => i.funcionario_id === f.id);
            return (
              <tr key={f.id} className="border-t">
                <td className="p-2">{f.codigo}</td><td className="p-2">{f.nome}</td>
                <td className="p-1"><Input disabled={bloqueado} inputMode="decimal" value={pontos[f.id] ?? ''} onChange={(e) => setPontos((p) => ({ ...p, [f.id]: e.target.value }))} /></td>
                <td className="p-2 text-right">{fmt(it?.valor_comissao)}</td>
              </tr>);
          })}</tbody>
          <tfoot className="bg-muted/50 font-medium"><tr>
            <td className="p-2" colSpan={2}>Total de pontos: {r.totalPontos.toLocaleString('pt-BR')} · Valor do ponto: {r.valorPonto.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
            <td className="p-2 text-right">Soma: {fmt(r.soma)}</td>
            <td className={`p-2 text-right ${r.diferenca !== 0 ? 'text-destructive' : ''}`}>Diferença: {fmt(r.diferenca)}</td>
          </tr></tfoot>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={salvar}>{bloqueado ? 'Avançar' : 'Salvar e avançar'}</Button>
      </div>
    </div>
  );
}
