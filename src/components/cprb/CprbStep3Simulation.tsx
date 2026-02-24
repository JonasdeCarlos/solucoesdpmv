import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/formatters';
import { CprbConsolidatedResult } from '@/utils/cprbCalculations';
import { TrendingDown, TrendingUp, Equal, ArrowRight } from 'lucide-react';

interface Props {
  result: CprbConsolidatedResult | null;
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

const CprbStep3Simulation = ({ result, onBack, onNext, onCalculate, isCalculated }: Props) => {
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
