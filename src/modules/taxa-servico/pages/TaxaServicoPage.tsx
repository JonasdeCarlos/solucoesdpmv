import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, Lock, LockOpen, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import SaldoCard from '../components/SaldoCard';
import SaldoExtratoDialog from '../components/SaldoExtratoDialog';
import StepEmpresa from '../components/StepEmpresa';
import StepValores from '../components/StepValores';
import StepFuncionarios from '../components/StepFuncionarios';
import StepRateio from '../components/StepRateio';
import StepExportacao from '../components/StepExportacao';
import AjusteFechamento from '../components/AjusteFechamento';
import RelatorioFechamentoDialog from '../components/RelatorioFechamentoDialog';
import { useEmpresas, useTaxaServicoEmpresa, isFechada, setFechada, marcarAbertaSeNova, type TsCompetencia } from '../hooks/useTaxaServico';
import { fmt, competenciaLabel } from '../utils/validacoes';

const STEPS = ['Empresa', 'Valores', 'Funcionários', 'Pontuação e rateio', 'Verba e exportação', 'Fechamento'];
const STATUS: Record<string, string> = { rascunho: 'Rascunho', calculado: 'Calculado', exportado: 'Exportado', ajustado: 'Ajustado' };

export default function TaxaServicoPage() {
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { config, funcionarios, competencias, saldo, reload, saveConfig } = useTaxaServicoEmpresa(empresaId);
  const [modo, setModo] = useState<'lista' | 'fluxo'>('lista');
  const [step, setStep] = useState(0);
  const [comp, setComp] = useState<TsCompetencia | null>(null);
  const [extrato, setExtrato] = useState(false);
  const [relFinal, setRelFinal] = useState(false);
  const [busca, setBusca] = useState('');
  const [, force] = useState(0);
  const fechada = comp ? isFechada(comp) : false;
  const alternarFechamento = (v: boolean) => {
    if (!comp) return;
    setFechada(comp.id, v); force((n) => n + 1);
    toast.success(v ? 'Competência fechada' : 'Competência reaberta para edição');
  };
  const aposExportar = async () => { if (comp) marcarAbertaSeNova(comp.id); await refreshComp(); };
  const empresasFiltradas = empresas.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase().trim()));

  const abrir = (c: TsCompetencia | null, s = 0) => { setComp(c); setStep(s); setModo('fluxo'); };
  const refreshComp = async () => {
    await reload();
    if (comp) {
      const { tsDb } = await import('../hooks/useTaxaServico');
      const { data } = await tsDb.from('ts_competencias').select('*').eq('id', comp.id).single();
      if (data) setComp({ ...data, valor_liquido: Number(data.valor_liquido), saldo_utilizado: Number(data.saldo_utilizado), valor_arrecadado: Number(data.valor_arrecadado), percentual_retencao: Number(data.percentual_retencao), valor_retido: Number(data.valor_retido), saldo_nao_distribuido: Number(data.saldo_nao_distribuido) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Taxa de Serviço / Gorjetas</h2>
        <p className="text-sm text-muted-foreground">Lançamento, rateio por pontos e exportação para o Domínio.</p>
      </div>

      {modo === 'lista' && (
        <>
          <div className="flex gap-2 items-center max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar empresa…" className="pl-8" />
            </div>
            <Select value={empresaId || ''} onValueChange={setEmpresaId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {empresasFiltradas.length === 0
                  ? <p className="p-2 text-xs text-muted-foreground">Nenhuma empresa encontrada.</p>
                  : empresasFiltradas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {empresaId && <SaldoCard saldo={saldo} onClick={() => setExtrato(true)} />}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Competências</CardTitle>
              <Button onClick={() => abrir(null, 0)}><Plus className="w-4 h-4 mr-1" />Nova competência</Button>
            </CardHeader>
            <CardContent>
              {!empresaId ? <p className="text-sm text-muted-foreground">Selecione uma empresa.</p> : !competencias.length ? <p className="text-sm text-muted-foreground">Nenhuma competência.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th className="p-2">Mês</th><th className="p-2 text-right">Líquido</th><th className="p-2">Status</th><th /></tr></thead>
                  <tbody>{competencias.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => abrir(c, 1)}>
                      <td className="p-2">{competenciaLabel(c.competencia)}</td>
                      <td className="p-2 text-right">{fmt(c.valor_liquido)}</td>
                      <td className="p-2"><Badge variant={c.status === 'rascunho' ? 'outline' : 'secondary'}>{STATUS[c.status]}</Badge>{isFechada(c) && <Badge className="ml-1" variant="outline"><Lock className="w-3 h-3 mr-1" />Fechada</Badge>}</td>
                      <td className="p-2 text-right text-primary">Abrir</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {modo === 'fluxo' && (
        <Card>
          <CardHeader>
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => { setModo('lista'); reload(); }}><ArrowLeft className="w-4 h-4 mr-1" />Competências</Button>
            {comp && <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Competência {competenciaLabel(comp.competencia)} — {STATUS[comp.status]} · {fechada ? 'Fechada' : 'Em aberto'}</CardTitle>
              {fechada && <Button size="sm" variant="outline" onClick={() => alternarFechamento(false)}><LockOpen className="w-4 h-4 mr-1" />Reabrir apuração</Button>}
            </div>}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="lancamento">
              {comp && (comp.status === 'calculado' || comp.status === 'exportado' || comp.status === 'ajustado') && (
                <TabsList className="mb-4"><TabsTrigger value="lancamento">Lançamento</TabsTrigger><TabsTrigger value="ajuste">Ajuste de fechamento</TabsTrigger></TabsList>
              )}
              <TabsContent value="lancamento">
                <div className="flex flex-wrap gap-1 mb-6">
                  {STEPS.map((s, i) => (
                    <button key={s} disabled={i > 1 && !comp} onClick={() => setStep(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${i === step ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'} disabled:opacity-40`}>
                      {i + 1}. {s}
                    </button>
                  ))}
                </div>
                {step === 0 && <StepEmpresa empresas={empresas} empresaId={empresaId} onEmpresa={setEmpresaId} config={config} saveConfig={saveConfig} onNext={() => setStep(1)} />}
                {step === 1 && empresaId && config && <StepValores key={comp?.id || 'novo'} empresaId={empresaId} config={config} comp={comp} fechada={comp ? fechada : undefined} onBack={() => setStep(0)} onSaved={async (c) => { setComp(c); await reload(); setStep(2); }} />}
                {step === 2 && empresaId && <StepFuncionarios empresaId={empresaId} funcionarios={funcionarios} reload={reload} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
                {step === 3 && comp && <StepRateio fechada={fechada} comp={comp} funcionarios={funcionarios} empresaNome={empresas.find((e) => e.id === empresaId)?.nome} onBack={() => setStep(2)} onNext={async () => { await refreshComp(); setStep(4); }} />}
                {step === 4 && comp && config && <StepExportacao comp={comp} config={config} funcionarios={funcionarios} onBack={() => setStep(3)} onGoValores={() => setStep(1)} onDone={aposExportar} />}
                {step === 4 && comp && !fechada && <div className="flex justify-end mt-4"><Button variant="outline" onClick={() => setStep(5)}>Ir para fechamento</Button></div>}
                {step === 5 && comp && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="border rounded-md p-3"><p className="text-muted-foreground">Arrecadado</p><b>{fmt(comp.valor_arrecadado)}</b></div>
                      <div className="border rounded-md p-3"><p className="text-muted-foreground">Líquido distribuído</p><b>{fmt(comp.valor_liquido)}</b></div>
                      <div className="border rounded-md p-3"><p className="text-muted-foreground">Situação</p><b>{STATUS[comp.status]} · {fechada ? 'Fechada' : 'Em aberto'}</b></div>
                    </div>
                    {comp.status === 'rascunho' || comp.status === 'calculado'
                      ? <p className="text-sm text-muted-foreground">Exporte o arquivo no passo 5 antes de fechar a competência.</p>
                      : <p className="text-sm text-muted-foreground">{fechada ? 'Apuração fechada: valores e pontuação ficam somente leitura. Reabra para corrigir e exportar de novo.' : 'Enquanto estiver em aberto, é possível alterar valores, pontos e dias e exportar novamente.'}</p>}
                    <div className="flex justify-between">
                      <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(4)}>Voltar</Button>
                      <Button variant="secondary" onClick={() => setRelFinal(true)}><FileText className="w-4 h-4 mr-1" />Relatório final</Button></div>
                      {fechada
                        ? <Button variant="outline" onClick={() => alternarFechamento(false)}><LockOpen className="w-4 h-4 mr-1" />Reabrir apuração</Button>
                        : <Button disabled={comp.status === 'rascunho' || comp.status === 'calculado'} onClick={() => alternarFechamento(true)}><Lock className="w-4 h-4 mr-1" />Fechar competência</Button>}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="ajuste">
                {comp && config && <AjusteFechamento comp={comp} config={config} funcionarios={funcionarios} saldo={saldo} onSaldoClick={() => setExtrato(true)} onChanged={aposExportar} />}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      {comp && <RelatorioFechamentoDialog open={relFinal} onOpenChange={setRelFinal} empresa={empresas.find((e) => e.id === empresaId)?.nome || ''} comp={comp} funcionarios={funcionarios} saldo={saldo} fechada={fechada} />}
      <SaldoExtratoDialog open={extrato} onOpenChange={setExtrato} competencias={competencias} />
    </div>
  );
}
