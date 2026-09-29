import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus } from 'lucide-react';
import SaldoCard from '../components/SaldoCard';
import SaldoExtratoDialog from '../components/SaldoExtratoDialog';
import StepEmpresa from '../components/StepEmpresa';
import StepValores from '../components/StepValores';
import StepFuncionarios from '../components/StepFuncionarios';
import StepRateio from '../components/StepRateio';
import StepExportacao from '../components/StepExportacao';
import AjusteFechamento from '../components/AjusteFechamento';
import { useEmpresas, useTaxaServicoEmpresa, type TsCompetencia } from '../hooks/useTaxaServico';
import { fmt, competenciaLabel } from '../utils/validacoes';

const STEPS = ['Empresa', 'Valores', 'Funcionários', 'Pontuação e rateio', 'Verba e exportação'];
const STATUS: Record<string, string> = { rascunho: 'Rascunho', calculado: 'Calculado', exportado: 'Exportado', ajustado: 'Ajustado' };

export default function TaxaServicoPage() {
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { config, funcionarios, competencias, saldo, reload, saveConfig } = useTaxaServicoEmpresa(empresaId);
  const [modo, setModo] = useState<'lista' | 'fluxo'>('lista');
  const [step, setStep] = useState(0);
  const [comp, setComp] = useState<TsCompetencia | null>(null);
  const [extrato, setExtrato] = useState(false);

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
          <Select value={empresaId || ''} onValueChange={setEmpresaId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
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
                      <td className="p-2"><Badge variant={c.status === 'rascunho' ? 'outline' : 'secondary'}>{STATUS[c.status]}</Badge></td>
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
            {comp && <CardTitle className="text-base">Competência {competenciaLabel(comp.competencia)} — {STATUS[comp.status]}</CardTitle>}
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
                {step === 1 && empresaId && config && <StepValores key={comp?.id || 'novo'} empresaId={empresaId} config={config} comp={comp} onBack={() => setStep(0)} onSaved={async (c) => { setComp(c); await reload(); setStep(2); }} />}
                {step === 2 && empresaId && <StepFuncionarios empresaId={empresaId} funcionarios={funcionarios} reload={reload} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
                {step === 3 && comp && <StepRateio comp={comp} funcionarios={funcionarios} onBack={() => setStep(2)} onNext={async () => { await refreshComp(); setStep(4); }} />}
                {step === 4 && comp && config && <StepExportacao comp={comp} config={config} funcionarios={funcionarios} onBack={() => setStep(3)} onGoValores={() => setStep(1)} onDone={refreshComp} />}
              </TabsContent>
              <TabsContent value="ajuste">
                {comp && config && <AjusteFechamento comp={comp} config={config} funcionarios={funcionarios} saldo={saldo} onSaldoClick={() => setExtrato(true)} onChanged={refreshComp} />}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      <SaldoExtratoDialog open={extrato} onOpenChange={setExtrato} competencias={competencias} />
    </div>
  );
}
