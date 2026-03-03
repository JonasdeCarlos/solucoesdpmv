import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SeroObra, SeroResultado, SeroVauVal } from '@/types/sero';
import { TIPO_OBRA_LABELS, TECNICA_LABELS, CATEGORIA_LABELS } from '@/types/sero';
import { formatBRL } from '@/utils/seroCalculations';

interface Props {
  obra: SeroObra;
  resultado: SeroResultado | null;
  vauVal: SeroVauVal | null;
  onCalculate: () => void;
  onNext: () => void;
  onBack: () => void;
}

const SeroStep4Apuracao: React.FC<Props> = ({ obra, resultado, vauVal, onCalculate, onNext, onBack }) => {
  const r = resultado;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Simulação de apoio</AlertTitle>
        <AlertDescription>
          Validar enquadramento, parâmetros e preenchimento no SERO/ECAC antes de regularizar a obra.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros Utilizados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">UF:</span> <strong>{obra.uf}</strong></div>
            <div><span className="text-muted-foreground">Tipo:</span> <strong>{TIPO_OBRA_LABELS[obra.tipo_obra]}</strong></div>
            <div><span className="text-muted-foreground">Categoria:</span> <strong>{CATEGORIA_LABELS[obra.categoria]}</strong></div>
            <div><span className="text-muted-foreground">Técnica:</span> <strong>{TECNICA_LABELS[obra.tecnica_construtiva]}</strong></div>
            <div><span className="text-muted-foreground">Área Total:</span> <strong>{(Number(obra.area_principal) + Number(obra.area_complementar)).toFixed(2)} m²</strong></div>
            <div><span className="text-muted-foreground">VAU/m²:</span> <strong>{vauVal ? formatBRL(Number(vauVal.valor_m2)) : 'N/D'}</strong></div>
            <div><span className="text-muted-foreground">Fonte:</span> <strong>{vauVal?.fonte || '—'}</strong></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button size="lg" onClick={onCalculate} className="gap-2">
          <Calculator className="w-5 h-5" /> Calcular Apuração SERO
        </Button>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">INSS Devido (Aferição Indireta)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Custo total estimado da obra" value={formatBRL(r.custoTotalObra)} />
                <Row label="Remuneração MO estimada" value={formatBRL(r.remuneracaoMO)} />
                <Row label="(–) Deduções" value={`– ${formatBRL(r.deducoesTotal)}`} className="text-orange-600" />
                <Row label="Remuneração MO líquida" value={formatBRL(r.remuneracaoLiquida)} bold />
                <hr />
                <Row label="INSS Patronal (20%)" value={formatBRL(r.inssPatronal)} />
                <Row label="RAT (3%)" value={formatBRL(r.inssRat)} />
                <Row label="Terceiros (5,8%)" value={formatBRL(r.inssTerceiros)} />
                <Row label="INSS Devido Total" value={formatBRL(r.inssDevido)} bold className="text-lg" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Cobertura (Folha + Retenções)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="INSS via Folha (rateado)" value={formatBRL(r.inssFolha)} />
                <Row label="Retenções de NFs" value={formatBRL(r.inssRetencoes)} />
                <Row label="Total Coberto" value={formatBRL(r.inssCoberto)} bold className="text-green-600" />
                <hr />
                <Row label="INSS por m²" value={`${formatBRL(r.inssM2)}/m²`} />
              </CardContent>
            </Card>
          </div>

          <Card className={r.saldoFinal > 0 ? 'border-destructive' : 'border-green-500'}>
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-center gap-3">
                {r.saldoFinal > 0 ? (
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Final</p>
                  <p className={`text-2xl font-bold ${r.saldoFinal > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {formatBRL(r.saldoFinal)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs text-right">
                {r.saldoFinal > 0
                  ? 'Saldo a recolher ao final da obra. Risco de débito no fechamento.'
                  : 'Cobertura suficiente. A folha e retenções cobrem o INSS estimado.'}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={onNext} disabled={!r} className="gap-2">
          Relatório <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean; className?: string }> = ({ label, value, bold, className }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${className || ''}`}>
    <span>{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

export default SeroStep4Apuracao;
