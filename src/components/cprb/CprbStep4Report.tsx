import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import { CprbConsolidatedResult } from '@/utils/cprbCalculations';
import { CprbPremissas } from './CprbStep1Premissas';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  premissas: CprbPremissas;
  result: CprbConsolidatedResult | null;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}

const CprbStep4Report = ({ premissas, result, onBack, onSave, isSaving }: Props) => {
  if (!result) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Nenhuma simulação calculada. Volte ao passo anterior.</p>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
      </div>
    );
  }

  const vantagemTexto = result.vantajosidade === 'cprb'
    ? `Pelas premissas informadas, o cenário CPRB apresenta economia estimada de ${formatCurrency(result.economiaCprb)} (${result.economiaPercentual.toFixed(1)}%) no horizonte de ${premissas.horizonteMeses} meses. Recomenda-se validar enquadramento legal e dados projetados antes da tomada de decisão.`
    : result.vantajosidade === 'folha'
    ? `Pelas premissas informadas, o recolhimento sobre a folha apresenta custo menor em ${formatCurrency(Math.abs(result.economiaCprb))} (${Math.abs(result.economiaPercentual).toFixed(1)}%) no horizonte de ${premissas.horizonteMeses} meses.`
    : `As diferenças entre os cenários são pequenas (${formatCurrency(Math.abs(result.economiaCprb))}). Recomenda-se análise mais detalhada.`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-bold mb-4">Relatório Comparativo — CPRB x Folha</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Empresa:</strong> {premissas.empresaNome || '—'}</div>
            <div><strong>CNPJ:</strong> {premissas.cnpj || '—'}</div>
            <div><strong>CNAE:</strong> {premissas.cnae || '—'}</div>
            <div><strong>Regime:</strong> Simples Nacional</div>
            <div><strong>Competência Inicial:</strong> {premissas.competenciaInicial}</div>
            <div><strong>Horizonte:</strong> {premissas.horizonteMeses} meses</div>
          </div>
        </CardContent>
      </Card>

      {/* Premissas */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-3">Premissas da Simulação</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><strong>Receita Total:</strong> {formatCurrency(premissas.receitaTotal)}</div>
            <div><strong>Folha Total:</strong> {formatCurrency(premissas.folhaTotal)}</div>
            <div><strong>13º Salário:</strong> {formatCurrency(premissas.decimoTerceiro)}</div>
            <div><strong>Pró-labore:</strong> {formatCurrency(premissas.proLabore)}</div>
            <div><strong>Área (m²):</strong> {premissas.areaM2Total || '—'}</div>
            <div><strong>Crescimento/mês:</strong> {(premissas.percentualCrescimento * 100).toFixed(1)}%</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {premissas.incluirFerias && <span className="bg-muted px-2 py-1 rounded">Férias ✓</span>}
            {premissas.incluirTercoFerias && <span className="bg-muted px-2 py-1 rounded">1/3 Férias ✓</span>}
            {premissas.incluirDecimoTerceiro && <span className="bg-muted px-2 py-1 rounded">13º ✓</span>}
            {premissas.incluirFgts && <span className="bg-muted px-2 py-1 rounded">FGTS ✓</span>}
            {premissas.incluirMultaFgts && <span className="bg-muted px-2 py-1 rounded">Multa FGTS ✓</span>}
            {premissas.incluirRatFap && <span className="bg-muted px-2 py-1 rounded">RAT/FAP ✓</span>}
            {premissas.incluirTerceiros && <span className="bg-muted px-2 py-1 rounded">Terceiros ✓</span>}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      <Card className="border-2 border-primary">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-3">Resultado Comparativo</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Custo CPRB (12m):</strong> {formatCurrency(result.totalCustoCprb)}</div>
            <div><strong>Custo Folha (12m):</strong> {formatCurrency(result.totalCustoFolha)}</div>
            <div><strong>Economia CPRB:</strong> <span className={result.economiaCprb > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurrency(result.economiaCprb)}</span></div>
            <div><strong>Índice Receita/Folha:</strong> {result.indiceReceitaFolha.toFixed(2)}</div>
            <div><strong>Break-even:</strong> {result.breakEvenRatio.toFixed(2)}</div>
            <div><strong>Custo/m² CPRB:</strong> {formatCurrency(result.custoM2MedioCprb)}</div>
            <div><strong>Custo/m² Folha:</strong> {formatCurrency(result.custoM2MedioFolha)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendação */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-2">Análise de Vantajosidade</h3>
          <p className="text-sm">{vantagemTexto}</p>
        </CardContent>
      </Card>

      {/* Ressalvas */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-2">Riscos e Ressalvas</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Simulação para apoio à decisão. Validar enquadramento CNAE/atividade e interpretação tributária com contador/consultoria.</li>
            <li>Os valores projetados dependem das premissas informadas e podem divergir da realidade.</li>
            <li>A opção pela CPRB é irretratável para o ano-calendário e deve ser exercida conforme legislação vigente.</li>
            <li>A reoneração gradual segue os percentuais da Lei 14.973/2024 e pode sofrer alterações legislativas.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Aviso legal */}
      <div className="bg-muted/50 border rounded p-4 text-xs text-muted-foreground">
        ⚠️ Este módulo é uma ferramenta de simulação e apoio gerencial. A adoção de opção tributária/previdenciária
        deve observar o enquadramento legal da empresa, CNAE, atividade efetivamente exercida, regras vigentes por
        competência e validação técnica contábil/jurídica.
      </div>

      {/* Ações */}
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <FileText className="w-4 h-4 mr-2" /> Imprimir
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Salvando...' : 'Salvar Cenário'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CprbStep4Report;
