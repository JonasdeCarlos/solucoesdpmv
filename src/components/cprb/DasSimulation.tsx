import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Calculator, FileSearch, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatCurrencyInput, parseCurrencyToNumber } from '@/utils/formatters';
import { useDasAnexosFaixas, useDasCnaeAnexo } from '@/hooks/useDasParameters';
import { calcularDas, DasSimulationInput, DasConsolidatedResult, DasFaixa, DasAtividadeInput } from '@/utils/dasCalculations';
import { distribuirMensal } from '@/utils/cprbCalculations';
import { toast } from 'sonner';

const InfoTip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-4 h-4 text-muted-foreground inline ml-1 cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
);

const CurrencyField = ({ label, value, onChange, tip }: { label: string; value: number; onChange: (v: number) => void; tip?: string }) => {
  const [display, setDisplay] = useState(value > 0 ? formatCurrencyInput(String(Math.round(value * 100))) : '');
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}{tip && <InfoTip text={tip} />}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          className="pl-10"
          value={display}
          onChange={(e) => {
            const formatted = formatCurrencyInput(e.target.value);
            setDisplay(formatted);
            onChange(parseCurrencyToNumber(formatted));
          }}
          placeholder="0,00"
        />
      </div>
    </div>
  );
};

const ANEXOS = ['I', 'II', 'III', 'IV', 'V'];
const STORAGE_KEY = 'das_simulation_state_v1';

interface DasInputState {
  competenciaInicial: string;
  horizonteMeses: number;
  rbt12Inicial: number;
  receitaTotalProjetada: number;
  percentualCrescimento: number;
  anexoPrincipal: string;
  segregarReceitas: boolean;
  atividades: { anexo: string; percentual: number }[];
  exigeFatorR: boolean;
  folha12mInicial: number;
  folhaTotalProjetada: number;
  empresaNome: string;
  cnpj: string;
  cnaePrincipal: string;
}

const defaultInput = (): DasInputState => {
  const now = new Date();
  return {
    competenciaInicial: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    horizonteMeses: 12,
    rbt12Inicial: 0,
    receitaTotalProjetada: 0,
    percentualCrescimento: 0,
    anexoPrincipal: 'IV',
    segregarReceitas: false,
    atividades: [{ anexo: 'IV', percentual: 100 }],
    exigeFatorR: false,
    folha12mInicial: 0,
    folhaTotalProjetada: 0,
    empresaNome: '',
    cnpj: '',
    cnaePrincipal: '',
  };
};

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { input?: DasInputState; result?: DasConsolidatedResult | null; isCalculated?: boolean } : null;
  } catch {
    return null;
  }
}

const DasSimulation = () => {
  const persisted = loadPersistedState();
  const [input, setInput] = useState<DasInputState>(persisted?.input ?? defaultInput);
  const [result, setResult] = useState<DasConsolidatedResult | null>(persisted?.result ?? null);
  const [isCalculated, setIsCalculated] = useState(persisted?.isCalculated ?? false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, result, isCalculated }));
  }, [input, result, isCalculated]);

  const { data: faixasDb, isLoading: loadingFaixas } = useDasAnexosFaixas();
  const { data: cnaeMap } = useDasCnaeAnexo();

  const update = (partial: Partial<DasInputState>) => {
    setInput((prev) => ({ ...prev, ...partial }));
    setIsCalculated(false);
  };

  // Sugestão de anexo por CNAE
  const handleCnaeChange = (cnae: string) => {
    update({ cnaePrincipal: cnae });
    if (cnaeMap) {
      const found = cnaeMap.find((c) => c.cnae === cnae);
      if (found) {
        update({
          cnaePrincipal: cnae,
          anexoPrincipal: found.anexo_sugerido,
          exigeFatorR: found.exige_fator_r,
          atividades: [{ anexo: found.anexo_sugerido, percentual: 100 }],
        });
        toast.info(`CNAE ${cnae}: Anexo ${found.anexo_sugerido} sugerido. ${found.observacoes || ''}`);
      }
    }
  };

  const handleAddAtividade = () => {
    update({ atividades: [...input.atividades, { anexo: 'I', percentual: 0 }] });
  };

  const handleRemoveAtividade = (idx: number) => {
    update({ atividades: input.atividades.filter((_, i) => i !== idx) });
  };

  const handleCalculate = () => {
    if (!faixasDb || faixasDb.length === 0) {
      toast.error('Não há tabelas de faixas do Simples cadastradas.');
      return;
    }
    if (input.rbt12Inicial <= 0) {
      toast.error('Informe a RBT12 inicial.');
      return;
    }
    if (input.receitaTotalProjetada <= 0) {
      toast.error('Informe a receita total projetada.');
      return;
    }

    const totalPerc = input.atividades.reduce((s, a) => s + a.percentual, 0);
    if (Math.abs(totalPerc - 100) > 0.01) {
      toast.error(`A soma dos percentuais de atividade deve ser 100%. Atual: ${totalPerc.toFixed(1)}%`);
      return;
    }

    const receitasMensais = distribuirMensal(
      input.receitaTotalProjetada,
      input.horizonteMeses,
      input.percentualCrescimento
    );
    const folhasMensais = input.exigeFatorR
      ? distribuirMensal(input.folhaTotalProjetada, input.horizonteMeses, input.percentualCrescimento)
      : [];

    const atividades: DasAtividadeInput[] = input.atividades.map((a) => ({
      anexo: a.anexo,
      percentualReceita: a.percentual / 100,
    }));

    const simInput: DasSimulationInput = {
      competenciaInicial: input.competenciaInicial,
      horizonteMeses: input.horizonteMeses,
      rbt12Inicial: input.rbt12Inicial,
      receitasMensais,
      atividades,
      exigeFatorR: input.exigeFatorR,
      folha12mInicial: input.folha12mInicial,
      folhasMensais,
    };

    const faixas: DasFaixa[] = faixasDb.map((f) => ({
      anexo: f.anexo,
      faixa: f.faixa,
      rbt12_min: Number(f.rbt12_min),
      rbt12_max: Number(f.rbt12_max),
      aliquota_nominal: Number(f.aliquota_nominal),
      parcela_deduzir: Number(f.parcela_deduzir),
    }));

    const res = calcularDas(simInput, faixas);
    setResult(res);
    setIsCalculated(true);
    toast.success('Simulação do DAS calculada!');
  };

  return (
    <div className="space-y-6">
      {/* Aviso legal */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          A simulação do DAS é ferramenta de apoio. Confirmar enquadramento do CNAE, anexo aplicável,
          segregação de receitas e regras vigentes no PGDAS-D/legislação antes do recolhimento.
        </AlertDescription>
      </Alert>

      {/* Inputs */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">Identificação e Período</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input value={input.empresaNome} onChange={(e) => update({ empresaNome: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input value={input.cnpj} onChange={(e) => update({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label>CNAE Principal <InfoTip text="Informe o CNAE para sugestão automática de Anexo" /></Label>
              <Input
                value={input.cnaePrincipal}
                onChange={(e) => handleCnaeChange(e.target.value)}
                placeholder="4120-4/00"
              />
            </div>
            <div className="space-y-1">
              <Label>Regime</Label>
              <Input value="Simples Nacional" disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label>Competência Inicial</Label>
              <Input type="month" value={input.competenciaInicial} onChange={(e) => update({ competenciaInicial: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Horizonte (meses)</Label>
              <Input type="number" min={1} max={60} value={input.horizonteMeses} onChange={(e) => update({ horizonteMeses: parseInt(e.target.value) || 12 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receita e RBT12 */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">Receita e Base de Cálculo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyField
              label="RBT12 Inicial (Receita Bruta 12m)"
              value={input.rbt12Inicial}
              onChange={(v) => update({ rbt12Inicial: v })}
              tip="Receita bruta acumulada dos últimos 12 meses — base para enquadramento na faixa do Simples"
            />
            <CurrencyField
              label="Receita Total Projetada"
              value={input.receitaTotalProjetada}
              onChange={(v) => update({ receitaTotalProjetada: v })}
              tip="Receita bruta projetada para o horizonte de simulação"
            />
            <div className="space-y-1">
              <Label>Crescimento mensal (%)</Label>
              <Input
                type="number"
                step={0.1}
                value={input.percentualCrescimento * 100 || ''}
                onChange={(e) => update({ percentualCrescimento: (parseFloat(e.target.value) || 0) / 100 })}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enquadramento / Anexo */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold text-base">Enquadramento — Anexo do Simples</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Anexo Principal <InfoTip text="Sugerido pelo CNAE — confirme ou ajuste" /></Label>
              <Select value={input.anexoPrincipal} onValueChange={(v) => {
                update({
                  anexoPrincipal: v,
                  atividades: input.segregarReceitas ? input.atividades : [{ anexo: v, percentual: 100 }],
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANEXOS.map((a) => <SelectItem key={a} value={a}>Anexo {a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-2 rounded border">
              <Label className="text-sm">Segregar receitas por Anexo?</Label>
              <Switch
                checked={input.segregarReceitas}
                onCheckedChange={(v) => {
                  if (!v) {
                    update({ segregarReceitas: false, atividades: [{ anexo: input.anexoPrincipal, percentual: 100 }] });
                  } else {
                    update({ segregarReceitas: true });
                  }
                }}
              />
            </div>
          </div>

          {input.segregarReceitas && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Distribua a receita por Anexo (soma deve ser 100%):</p>
              {input.atividades.map((ativ, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Select value={ativ.anexo} onValueChange={(v) => {
                    const copy = [...input.atividades];
                    copy[idx] = { ...copy[idx], anexo: v };
                    update({ atividades: copy });
                  }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANEXOS.map((a) => <SelectItem key={a} value={a}>Anexo {a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-24"
                    value={ativ.percentual || ''}
                    onChange={(e) => {
                      const copy = [...input.atividades];
                      copy[idx] = { ...copy[idx], percentual: parseFloat(e.target.value) || 0 };
                      update({ atividades: copy });
                    }}
                    placeholder="%"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  {input.atividades.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveAtividade(idx)}>✕</Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddAtividade}>+ Adicionar atividade</Button>
              <p className="text-xs font-medium">
                Total: {input.atividades.reduce((s, a) => s + a.percentual, 0).toFixed(1)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fator R */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-base font-semibold">Exige análise de Fator R?</Label>
            <Switch checked={input.exigeFatorR} onCheckedChange={(v) => update({ exigeFatorR: v })} />
            <InfoTip text="Atividades do Anexo V podem migrar para Anexo III se Fator R ≥ 28%" />
          </div>
          {input.exigeFatorR && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CurrencyField
                label="Folha acumulada 12m (inicial)"
                value={input.folha12mInicial}
                onChange={(v) => update({ folha12mInicial: v })}
                tip="Soma da folha dos últimos 12 meses para cálculo do Fator R"
              />
              <CurrencyField
                label="Folha total projetada"
                value={input.folhaTotalProjetada}
                onChange={(v) => update({ folhaTotalProjetada: v })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão calcular */}
      <div className="flex justify-center">
        <Button size="lg" onClick={handleCalculate} disabled={loadingFaixas}>
          <Calculator className="w-4 h-4 mr-2" /> Calcular DAS
        </Button>
      </div>

      {/* Resultados */}
      {isCalculated && result && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">DAS Estimado (12m)</p>
                <p className="text-lg font-bold">{formatCurrency(result.totalDas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Receita Projetada</p>
                <p className="text-lg font-bold">{formatCurrency(result.totalReceita)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Alíquota Efetiva Média</p>
                <p className="text-lg font-bold">{(result.aliquotaEfetivaMedia * 100).toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">DAS Médio Mensal</p>
                <p className="text-lg font-bold">{formatCurrency(result.totalDas / (result.monthly.length || 1))}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela mensal */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-base mb-4">Simulação Mensal do DAS</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">RBT12</TableHead>
                      <TableHead className="text-right">Faixa</TableHead>
                      <TableHead className="text-right">Alíq. Nominal</TableHead>
                      <TableHead className="text-right">Alíq. Efetiva</TableHead>
                      {result.monthly[0]?.fatorR !== null && <TableHead className="text-right">Fator R</TableHead>}
                      <TableHead className="text-right">DAS Estimado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.monthly.map((m) => {
                      const mainAnexo = m.porAnexo[0];
                      return (
                        <TableRow key={m.competencia}>
                          <TableCell className="font-medium">{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.receitaMes)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.rbt12)}</TableCell>
                          <TableCell className="text-right">{mainAnexo?.faixaAplicada || '—'}</TableCell>
                          <TableCell className="text-right">{mainAnexo ? (mainAnexo.aliquotaNominal * 100).toFixed(1) + '%' : '—'}</TableCell>
                          <TableCell className="text-right">{(m.aliquotaEfetivaPonderada * 100).toFixed(2)}%</TableCell>
                          {m.fatorR !== null && <TableCell className="text-right">{(m.fatorR * 100).toFixed(2)}%</TableCell>}
                          <TableCell className="text-right font-bold">{formatCurrency(m.dasTotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{formatCurrency(result.totalReceita)}</TableCell>
                      <TableCell colSpan={result.monthly[0]?.fatorR !== null ? 5 : 4} />
                      <TableCell className="text-right">{formatCurrency(result.totalDas)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Memória de cálculo */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <FileSearch className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Memória de Cálculo — DAS</h3>
              </div>
              <Alert className="mb-4">
                <AlertDescription className="text-xs font-mono">
                  Alíquota efetiva = ((RBT12 × alíquota nominal) − parcela a deduzir) ÷ RBT12<br />
                  DAS estimado = Receita do mês × alíquota efetiva
                </AlertDescription>
              </Alert>

              <Accordion type="multiple" className="w-full">
                {result.monthly.map((m) => (
                  <AccordionItem key={m.competencia} value={m.competencia}>
                    <AccordionTrigger className="text-sm">
                      {m.competencia} — DAS: {formatCurrency(m.dasTotal)} (Alíq. efetiva: {(m.aliquotaEfetivaPonderada * 100).toFixed(2)}%)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>Receita do mês:</div><div className="font-medium">{formatCurrency(m.receitaMes)}</div>
                          <div>RBT12:</div><div className="font-medium">{formatCurrency(m.rbt12)}</div>
                          {m.fatorR !== null && <><div>Fator R:</div><div className="font-medium">{(m.fatorR * 100).toFixed(2)}%</div></>}
                        </div>

                        {m.porAnexo.map((a, i) => (
                          <div key={i} className="mt-2 p-2 border rounded">
                            <Badge variant="secondary" className="mb-1">Anexo {a.anexo} — Faixa {a.faixaAplicada}</Badge>
                            <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                              <div>Receita neste anexo:</div><div>{formatCurrency(a.receitaAnexo)}</div>
                              <div>Alíquota nominal:</div><div>{(a.aliquotaNominal * 100).toFixed(1)}%</div>
                              <div>Parcela a deduzir:</div><div>{formatCurrency(a.parcelaDeduzir)}</div>
                              <div>Cálculo:</div>
                              <div className="font-mono text-xs">
                                (({formatCurrency(m.rbt12)} × {(a.aliquotaNominal * 100).toFixed(1)}%) − {formatCurrency(a.parcelaDeduzir)}) ÷ {formatCurrency(m.rbt12)}
                              </div>
                              <div>Alíquota efetiva:</div><div className="font-bold">{(a.aliquotaEfetiva * 100).toFixed(2)}%</div>
                              <div>DAS do anexo:</div><div className="font-bold">{formatCurrency(a.dasAnexo)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DasSimulation;
