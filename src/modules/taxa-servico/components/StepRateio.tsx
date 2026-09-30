import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { ratear } from '../utils/rateio';
import { fmt, parseNum } from '../utils/validacoes';
import { loadDistribuicao, saveDistribuicao, updateCompetencia, type TsCompetencia, type TsFuncionario } from '../hooks/useTaxaServico';
import RelatorioRateioDialog from './RelatorioRateioDialog';

interface Props { comp: TsCompetencia; funcionarios: TsFuncionario[]; empresaNome?: string; onBack: () => void; onNext: () => void; fechada?: boolean }

const draftKey = (id: string) => `ts-rateio-draft-${id}`;
const diasKey = (id: string) => `ts-rateio-dias-${id}`;
const ultimoKey = (empresaId: string) => `ts-rateio-ultimo-${empresaId}`;
const diasDoMes = (comp: string) => new Date(Number(comp.slice(0, 4)), Number(comp.slice(5, 7)), 0).getDate();

export default function StepRateio({ comp, funcionarios, empresaNome = '', onBack, onNext, fechada }: Props) {
  const [ordem, setOrdem] = useState<'nome' | 'codigo'>('codigo');
  const ativos = useMemo(() => funcionarios.filter((f) => f.ativo).sort((a, b) =>
    ordem === 'codigo' ? Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo) : a.nome.localeCompare(b.nome, 'pt-BR')), [funcionarios, ordem]);
  // Últimos valores digitados na empresa: servem de ponto de partida para o próximo mês
  const ultimo = (() => { try { return JSON.parse(localStorage.getItem(ultimoKey(comp.empresa_id)) || '{}'); } catch { return {}; } })() as { pontos?: Record<string, string>; dias?: Record<string, string> };
  const lerOuUltimo = (key: string, fallback?: Record<string, string>) => {
    const raw = localStorage.getItem(key);
    if (raw) { try { return JSON.parse(raw); } catch { /* ignore */ } }
    return fallback ? { ...fallback } : {};
  };
  const salvarUltimo = (patch: { pontos?: Record<string, string>; dias?: Record<string, string> }) => {
    try {
      const atual = JSON.parse(localStorage.getItem(ultimoKey(comp.empresa_id)) || '{}');
      localStorage.setItem(ultimoKey(comp.empresa_id), JSON.stringify({ ...atual, ...patch }));
    } catch { /* ignore */ }
  };
  const [pontos, setPontos] = useState<Record<string, string>>(() => lerOuUltimo(draftKey(comp.id), ultimo.pontos));
  const diasMes = diasDoMes(comp.competencia);
  const [dias, setDias] = useState<Record<string, string>>(() => lerOuUltimo(diasKey(comp.id), ultimo.dias));
  const setDia = (id: string, v: string) => setDias((p) => {
    const n = { ...p, [id]: v };
    localStorage.setItem(diasKey(comp.id), JSON.stringify(n));
    salvarUltimo({ dias: n });
    return n;
  });
  const diasDe = (id: string) => {
    const v = dias[id];
    if (v == null || v === '') return diasMes;
    return Math.min(diasMes, Math.max(0, parseNum(v)));
  };
  const fator = (id: string) => diasDe(id) / diasMes;
  const [rel, setRel] = useState(false);
  const bloqueado = fechada ?? (comp.status === 'exportado' || comp.status === 'ajustado');

  useEffect(() => {
    loadDistribuicao(comp.id).then((d) => {
      if (!d.length) return;
      const salvo = Object.fromEntries(d.map((x) => [x.funcionario_id, String(x.pontos)]));
      const temRascunho = !!localStorage.getItem(draftKey(comp.id));
      // rascunho digitado tem prioridade sobre o que está salvo
      setPontos((atual) => (bloqueado || !temRascunho ? salvo : { ...salvo, ...atual }));
    });
  }, [comp.id, bloqueado]);

  const setPonto = (id: string, v: string) => setPontos((p) => {
    const n = { ...p, [id]: v };
    localStorage.setItem(draftKey(comp.id), JSON.stringify(n));
    salvarUltimo({ pontos: n });
    return n;
  });

  const r = useMemo(() => ratear(comp.valor_liquido, ativos.map((f) => ({ funcionario_id: f.id, pontos: parseNum(pontos[f.id]) * fator(f.id) }))), [comp.valor_liquido, ativos, pontos, dias, diasMes]);

  const salvar = async () => {
    if (bloqueado) return onNext();
    if (!r.totalPontos) return toast.error('Informe os pontos.');
    if (r.diferenca !== 0) return toast.error('A soma distribuída difere do líquido.');
    const err = await saveDistribuicao(r.itens.map((i) => ({
      competencia_id: comp.id, funcionario_id: i.funcionario_id, pontos: parseNum(pontos[i.funcionario_id]), valor_comissao: i.valor_comissao,
      rendimento_bruto_extrato: null, valor_bruto_alvo: null, diferenca: null, valor_ajustado: null, alerta: null,
    })));
    if (err) return toast.error(err.message);
    if (comp.status === 'rascunho') await updateCompetencia(comp.id, { status: 'calculado' });
    toast.success('Rateio salvo');
    onNext();
  };

  const linhas = ativos.map((f) => {
    const it = r.itens.find((i) => i.funcionario_id === f.id);
    return { codigo: f.codigo, nome: f.nome, pontos: parseNum(pontos[f.id]), valor: it?.valor_comissao || 0, lanca: f.gera_lancamento !== false };
  }).filter((l) => l.pontos > 0 && l.valor > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm">Líquido a distribuir: <b className="text-primary">{fmt(comp.valor_liquido)}</b></p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Ordenar por:</span>
          <Button size="sm" variant={ordem === 'codigo' ? 'default' : 'outline'} onClick={() => setOrdem('codigo')}>Código</Button>
          <Button size="sm" variant={ordem === 'nome' ? 'default' : 'outline'} onClick={() => setOrdem('nome')}>Ordem alfabética</Button>
          <Button variant="outline" size="sm" disabled={!r.totalPontos} onClick={() => setRel(true)}><FileText className="w-4 h-4 mr-1" />Gerar relatório</Button>
        </div>
      </div>
      <div className="border rounded-md max-h-[50vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 w-32">Pontos</th><th className="p-2 w-24">Dias (máx. {diasMes})</th><th className="p-2 text-right">Comissão</th></tr></thead>
          <tbody>{ativos.map((f) => {
            const it = r.itens.find((i) => i.funcionario_id === f.id);
            return (
              <tr key={f.id} className="border-t">
                <td className="p-2">{f.codigo}</td>
                <td className="p-2">{f.nome}{f.gera_lancamento === false && <span className="ml-2 text-xs text-muted-foreground">(sem lançamento)</span>}</td>
                <td className="p-1"><Input disabled={bloqueado} inputMode="decimal" value={pontos[f.id] ?? ''} onChange={(e) => setPonto(f.id, e.target.value)} /></td>
                <td className="p-1"><Input disabled={bloqueado} inputMode="decimal" value={dias[f.id] ?? String(diasMes)} onChange={(e) => setDia(f.id, e.target.value)} /></td>
                <td className="p-2 text-right">{fmt(it?.valor_comissao)}</td>
              </tr>);
          })}</tbody>
          <tfoot className="bg-muted/50 font-medium"><tr>
            <td className="p-2" colSpan={3}>Pontos efetivos (proporcionais aos dias): {r.totalPontos.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} · Valor do ponto: {r.valorPonto.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
            <td className="p-2 text-right">Soma: {fmt(r.soma)}</td>
            <td className={`p-2 text-right ${r.diferenca !== 0 ? 'text-destructive' : ''}`}>Diferença: {fmt(r.diferenca)}</td>
          </tr></tfoot>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={salvar}>{bloqueado ? 'Avançar' : 'Salvar e avançar'}</Button>
      </div>
      <RelatorioRateioDialog open={rel} onOpenChange={setRel} empresa={empresaNome} competencia={comp.competencia}
        arrecadado={comp.valor_arrecadado} percentual={comp.percentual_retencao} retido={comp.valor_retido} saldoUtilizado={comp.saldo_utilizado}
        liquido={comp.valor_liquido} saldoNaoDistribuido={comp.saldo_nao_distribuido} totalPontos={r.totalPontos} valorPonto={r.valorPonto} linhas={linhas} />
    </div>
  );
}
