import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatCurrency } from '@/utils/formatters';
import { CprbConsolidatedResult } from '@/utils/cprbCalculations';
import { DasConsolidatedResult } from '@/utils/dasCalculations';
import { CprbPremissas } from './CprbStep1Premissas';
import { TrendingDown, TrendingUp, Equal, ArrowRight, FileSearch } from 'lucide-react';

interface Props {
  result: CprbConsolidatedResult | null;
  dasResult: DasConsolidatedResult | null;
  premissas: CprbPremissas;
  onBack: () => void;
  onNext: () => void;
  onCalculate: () => void;
  isCalculated: boolean;
}

const KpiCard = ({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: 'success' | 'destructive' | 'default' }) => (
  <Card>
    <CardContent className="pt-4 pb-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${variant === 'success' ? 'text-green-600' : variant === 'destructive' ? 'text-red-600' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </CardContent>
  </Card>
);

const CprbStep3Simulation = ({ result, dasResult, premissas, onBack, onNext, onCalculate, isCalculated }: Props) => {
  if (!isCalculated || !result) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Clique para executar a simulação com as premissas informadas.</p>
            <Button size="lg" onClick={onCalculate}>
              <ArrowRight className="w-4 h-4 mr-2" /> Calcular Simulação
            </Button>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>← Voltar</Button>
        </div>
      </div>
    );
  }

  const VantagemIcon = result.vantajosidade === 'cprb' ? TrendingDown
    : result.vantajosidade === 'folha' ? TrendingUp : Equal;

  const vantagemLabel = result.vantajosidade === 'cprb'
    ? 'CPRB mais vantajosa'
    : result.vantajosidade === 'folha'
    ? 'Folha mais vantajosa'
    : 'Empate técnico';

  const vantagemVariant = result.vantajosidade === 'cprb' ? 'success'
    : result.vantajosidade === 'folha' ? 'destructive' : 'default';

  return (
    <div className="space-y-6">
      {/* Resultado principal */}
      <Card className={`border-2 ${result.vantajosidade === 'cprb' ? 'border-green-500' : result.vantajosidade === 'folha' ? 'border-red-500' : 'border-yellow-500'}`}>
        <CardContent className="pt-6 flex items-center justify-center gap-4">
          <VantagemIcon className={`w-8 h-8 ${vantagemVariant === 'success' ? 'text-green-600' : vantagemVariant === 'destructive' ? 'text-red-600' : 'text-yellow-600'}`} />
          <div>
            <Badge variant={vantagemVariant === 'success' ? 'default' : vantagemVariant === 'destructive' ? 'destructive' : 'secondary'} className="text-sm">
              {vantagemLabel}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">
              Diferença: {formatCurrency(Math.abs(result.economiaCprb))} ({Math.abs(result.economiaPercentual).toFixed(1)}%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receita 12m" value={formatCurrency(result.totalReceitaProjetada)} />
        <KpiCard label="Folha 12m" value={formatCurrency(result.totalFolhaProjetada)} />
        <KpiCard label="Custo CPRB" value={formatCurrency(result.totalCustoCprb)} variant={result.vantajosidade === 'cprb' ? 'success' : 'default'} />
        <KpiCard label="Custo Folha" value={formatCurrency(result.totalCustoFolha)} variant={result.vantajosidade === 'folha' ? 'success' : 'default'} />
        <KpiCard label="Economia CPRB" value={formatCurrency(result.economiaCprb)} variant={result.economiaCprb > 0 ? 'success' : 'destructive'} sub={`${result.economiaPercentual.toFixed(1)}%`} />
        <KpiCard label="Receita/Folha" value={result.indiceReceitaFolha.toFixed(2)} sub="Índice" />
        <KpiCard label="Custo/m² CPRB" value={formatCurrency(result.custoM2MedioCprb)} />
        <KpiCard label="Custo/m² Folha" value={formatCurrency(result.custoM2MedioFolha)} />
      </div>

      {/* DAS Integration KPIs */}
      {dasResult && premissas.incluirDasNoM2 && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-base mb-4">📊 Custo por m² com DAS integrado</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="DAS Estimado (12m)"
                value={formatCurrency(dasResult.totalDas)}
                sub={`Alíq. efetiva: ${(dasResult.aliquotaEfetivaMedia * 100).toFixed(2)}%`}
              />
              <KpiCard
                label="DAS Médio Mensal"
                value={formatCurrency(dasResult.totalDas / (dasResult.monthly.length || 1))}
                sub={`Anexo ${premissas.dasAnexo}`}
              />
              {(() => {
                const areaM2 = premissas.areaM2Total || 1;
                const custoM2CprbComDas = (result.custoMaoObraTotalCprb + dasResult.totalDas) / areaM2;
                const custoM2FolhaComDas = (result.custoMaoObraTotalFolha + dasResult.totalDas) / areaM2;
                return (
                  <>
                    <KpiCard
                      label="Custo/m² CPRB + DAS"
                      value={formatCurrency(Math.round(custoM2CprbComDas * 100) / 100)}
                      sub={`sem DAS: ${formatCurrency(result.custoM2MedioCprb)}`}
                      variant="success"
                    />
                    <KpiCard
                      label="Custo/m² Folha + DAS"
                      value={formatCurrency(Math.round(custoM2FolhaComDas * 100) / 100)}
                      sub={`sem DAS: ${formatCurrency(result.custoM2MedioFolha)}`}
                      variant="destructive"
                    />
                  </>
                );
              })()}
            </div>
            {/* Monthly DAS breakdown */}
            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="das-mensal">
                <AccordionTrigger className="text-sm font-medium">
                  DAS Mensal Estimado
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">RBT12</TableHead>
                        <TableHead className="text-right">Alíq. Efetiva</TableHead>
                        <TableHead className="text-right">DAS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dasResult.monthly.map((m) => (
                        <TableRow key={m.competencia}>
                          <TableCell className="font-medium">{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.receitaMes)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.rbt12)}</TableCell>
                          <TableCell className="text-right">{(m.aliquotaEfetivaPonderada * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.dasTotal)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{formatCurrency(dasResult.totalReceita)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">{(dasResult.aliquotaEfetivaMedia * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(dasResult.totalDas)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Tabela mensal */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-4">Memória de Cálculo Mensal</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Folha</TableHead>
                  <TableHead className="text-right">CPRB (receita)</TableHead>
                  <TableHead className="text-right">Folha (transição)</TableHead>
                  <TableHead className="text-right">Total CPRB</TableHead>
                  <TableHead className="text-right">Total Folha</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.monthly.map((m) => (
                  <TableRow key={m.competencia}>
                    <TableCell className="font-medium">{m.competencia}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.receitaMes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.folhaMes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.cprbValor)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.contribFolhaTransicao)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(m.custoCenarioCprb)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(m.custoCenarioFolha)}</TableCell>
                    <TableCell className={`text-right font-bold ${m.diferencaAbsoluta > 0 ? 'text-green-600' : m.diferencaAbsoluta < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(m.diferencaAbsoluta)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totais */}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(result.totalReceitaProjetada)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(result.totalFolhaProjetada)}</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">{formatCurrency(result.totalCustoCprb)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(result.totalCustoFolha)}</TableCell>
                  <TableCell className={`text-right ${result.economiaCprb > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(result.economiaCprb)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Memória de Cálculo Detalhada */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSearch className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Memória de Cálculo — Composição dos Totais</h3>
          </div>
          <Accordion type="multiple" className="w-full">
            {/* Composição da Folha Projetada */}
            <AccordionItem value="folha">
              <AccordionTrigger className="text-sm font-medium">
                Folha Projetada 12m: {formatCurrency(result.totalFolhaProjetada)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Folha total informada: <strong>{formatCurrency(premissas.folhaTotal)}</strong>, distribuída em <strong>{premissas.horizonteMeses}</strong> meses
                    {premissas.percentualCrescimento > 0 && <> com crescimento de <strong>{(premissas.percentualCrescimento * 100).toFixed(1)}%</strong> ao mês</>}.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">Folha do Mês</TableHead>
                        <TableHead className="text-right">Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.monthly.reduce((acc, m) => {
                        const prev = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
                        acc.push({ ...m, acumulado: prev + m.folhaMes });
                        return acc;
                      }, [] as (typeof result.monthly[0] & { acumulado: number })[]).map((m) => (
                        <TableRow key={m.competencia}>
                          <TableCell>{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.folhaMes)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.acumulado)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Composição da Receita Projetada */}
            <AccordionItem value="receita">
              <AccordionTrigger className="text-sm font-medium">
                Receita Projetada 12m: {formatCurrency(result.totalReceitaProjetada)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Receita total informada: <strong>{formatCurrency(premissas.receitaTotal)}</strong>, distribuída em <strong>{premissas.horizonteMeses}</strong> meses
                    {premissas.percentualCrescimento > 0 && <> com crescimento de <strong>{(premissas.percentualCrescimento * 100).toFixed(1)}%</strong> ao mês</>}.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">Receita do Mês</TableHead>
                        <TableHead className="text-right">Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.monthly.reduce((acc, m) => {
                        const prev = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
                        acc.push({ ...m, acumulado: prev + m.receitaMes });
                        return acc;
                      }, [] as (typeof result.monthly[0] & { acumulado: number })[]).map((m) => (
                        <TableRow key={m.competencia}>
                          <TableCell>{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.receitaMes)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.acumulado)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Composição do Custo CPRB */}
            <AccordionItem value="cprb">
              <AccordionTrigger className="text-sm font-medium">
                Custo Cenário CPRB: {formatCurrency(result.totalCustoCprb)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Soma mensal de: CPRB sobre receita (alíquota × % transição) + Contribuição sobre folha (% transição folha).
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">CPRB s/ Receita</TableHead>
                        <TableHead className="text-right">Contrib. Folha (transição)</TableHead>
                        <TableHead className="text-right">Total Mês</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.monthly.map((m) => (
                        <TableRow key={m.competencia}>
                          <TableCell>{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.cprbValor)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.contribFolhaTransicao)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.custoCenarioCprb)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{formatCurrency(result.monthly.reduce((s, m) => s + m.cprbValor, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(result.monthly.reduce((s, m) => s + m.contribFolhaTransicao, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(result.totalCustoCprb)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Composição do Custo Folha */}
            <AccordionItem value="folha-custo">
              <AccordionTrigger className="text-sm font-medium">
                Custo Cenário Folha: {formatCurrency(result.totalCustoFolha)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Contribuição patronal de 20% sobre a folha mensal (sem CPRB).
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">Folha do Mês</TableHead>
                        <TableHead className="text-right">Contrib. Patronal (20%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.monthly.map((m) => (
                        <TableRow key={m.competencia}>
                          <TableCell>{m.competencia}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.folhaMes)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.contribPatronalFolha)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{formatCurrency(result.totalFolhaProjetada)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(result.totalCustoFolha)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Encargos Gerenciais */}
            <AccordionItem value="encargos">
              <AccordionTrigger className="text-sm font-medium">
                Encargos Gerenciais (premissas ativas)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground mb-2">Componentes incluídos no custo gerencial de mão de obra (base: folha mensal):</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between border-b pb-1">
                      <span>Férias (1/12)</span>
                      <span className={premissas.incluirFerias ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirFerias ? '8,33%' : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>1/3 Férias</span>
                      <span className={premissas.incluirTercoFerias ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirTercoFerias ? '2,78%' : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>13º Salário (1/12)</span>
                      <span className={premissas.incluirDecimoTerceiro ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirDecimoTerceiro ? '8,33%' : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>FGTS</span>
                      <span className={premissas.incluirFgts ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirFgts ? '8,00%' : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Multa FGTS</span>
                      <span className={premissas.incluirMultaFgts ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirMultaFgts ? `${(premissas.percentualMultaFgts * 100).toFixed(0)}% × FGTS × rotatividade` : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>RAT/FAP</span>
                      <span className={premissas.incluirRatFap ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirRatFap ? `${(premissas.aliquotaRatFap * 100).toFixed(1)}%` : 'Não incluído'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Terceiros</span>
                      <span className={premissas.incluirTerceiros ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {premissas.incluirTerceiros ? `${(premissas.aliquotaTerceiros * 100).toFixed(1)}%` : 'Não incluído'}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    let pct = 0;
                    if (premissas.incluirFerias) pct += 8.33;
                    if (premissas.incluirTercoFerias) pct += 2.78;
                    if (premissas.incluirDecimoTerceiro) pct += 8.33;
                    if (premissas.incluirFgts) pct += 8.0;
                    if (premissas.incluirRatFap) pct += premissas.aliquotaRatFap * 100;
                    if (premissas.incluirTerceiros) pct += premissas.aliquotaTerceiros * 100;
                    return (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        <strong>% total de encargos gerenciais sobre folha ≈ {pct.toFixed(2)}%</strong>
                        <span className="text-muted-foreground ml-2">(excluindo multa FGTS que depende da rotatividade)</span>
                      </div>
                    );
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Break-even */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-2">Ponto de Equilíbrio</h3>
          <p className="text-sm text-muted-foreground">
            O índice Receita/Folha atual é <strong>{result.indiceReceitaFolha.toFixed(2)}</strong>.
            {result.breakEvenRatio > 0 && (
              <> O ponto de equilíbrio (break-even) é aproximadamente <strong>{result.breakEvenRatio.toFixed(2)}</strong>.
                {result.indiceReceitaFolha < result.breakEvenRatio
                  ? ' Como o índice está abaixo do break-even, a CPRB tende a ser mais vantajosa.'
                  : ' Como o índice está acima do break-even, a contribuição sobre a folha tende a ser mais vantajosa.'
                }
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <Button onClick={onNext} size="lg">Próximo: Relatório →</Button>
      </div>
    </div>
  );
};

export default CprbStep3Simulation;
