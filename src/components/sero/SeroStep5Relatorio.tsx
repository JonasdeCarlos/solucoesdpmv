import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SeroObra, SeroResultado, SeroVauVal, SeroDeducao, SeroRetencao } from '@/types/sero';
import { TIPO_OBRA_LABELS, TECNICA_LABELS, CATEGORIA_LABELS } from '@/types/sero';
import { formatBRL } from '@/utils/seroCalculations';

interface Props {
  obra: SeroObra;
  resultado: SeroResultado | null;
  vauVal: SeroVauVal | null;
  deducoes: SeroDeducao[];
  retencoes: SeroRetencao[];
  onBack: () => void;
  onObraChange: (o: SeroObra) => void;
}

const SeroStep5Relatorio: React.FC<Props> = ({ obra, resultado, vauVal, deducoes, retencoes, onBack, onObraChange }) => {
  const r = resultado;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Simulação de apoio. Validar no SERO/RFB antes de regularizar.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Memória de Cálculo SERO — {obra.cno}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h4 className="font-semibold mb-1">1. Identificação da Obra</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div>CNO: {obra.cno}</div>
              <div>Responsável: {obra.responsavel_nome} ({obra.responsavel_doc})</div>
              <div>Local: {obra.municipio}/{obra.uf}</div>
              <div>Endereço: {obra.endereco}</div>
              <div>Início: {obra.data_inicio}</div>
              <div>Término previsto: {obra.data_termino_previsto || obra.data_termino}</div>
              <div>Categoria: {CATEGORIA_LABELS[obra.categoria]}</div>
              <div>Tipo: {TIPO_OBRA_LABELS[obra.tipo_obra]}</div>
              <div>Técnica: {TECNICA_LABELS[obra.tecnica_construtiva]}</div>
              <div>Área: {r?.areaTotal.toFixed(2)} m²</div>
            </div>
          </section>

          {r && vauVal && (
            <>
              <section>
                <h4 className="font-semibold mb-1">2. Tabela VAU/VAL Utilizada</h4>
                <p className="text-xs">
                  {obra.uf} — {TIPO_OBRA_LABELS[obra.tipo_obra]} — {formatBRL(Number(vauVal.valor_m2))}/m² —
                  Vigência: {vauVal.competencia_inicio} a {vauVal.competencia_fim} — Fonte: {vauVal.fonte}
                </p>
              </section>

              <section>
                <h4 className="font-semibold mb-1">3. Aferição Indireta</h4>
                <div className="bg-muted p-3 rounded text-xs font-mono space-y-1">
                  <div>Custo Estimado = {r.areaTotal.toFixed(2)} m² × {formatBRL(Number(vauVal.valor_m2))} = {formatBRL(r.custoTotalObra)}</div>
                  <div>Remuneração MO = {formatBRL(r.custoTotalObra)} × % MO × Redutor = {formatBRL(r.remuneracaoMO)}</div>
                  <div>(–) Deduções = {formatBRL(r.deducoesTotal)}</div>
                  <div>Remuneração MO Líquida = {formatBRL(r.remuneracaoLiquida)}</div>
                </div>
              </section>

              {deducoes.length > 0 && (
                <section>
                  <h4 className="font-semibold mb-1">4. Deduções</h4>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left p-1">Tipo</th><th className="text-right p-1">Valor</th><th className="text-left p-1">Compet.</th><th className="text-left p-1">NF</th></tr></thead>
                    <tbody>
                      {deducoes.map((d, i) => (
                        <tr key={i} className="border-b"><td className="p-1">{d.tipo}</td><td className="text-right p-1">{formatBRL(Number(d.valor))}</td><td className="p-1">{d.competencia}</td><td className="p-1">{d.nf_numero}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {retencoes.length > 0 && (
                <section>
                  <h4 className="font-semibold mb-1">5. Retenções de NFs</h4>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left p-1">Fornecedor</th><th className="text-right p-1">Bruto</th><th className="text-right p-1">Retenção</th></tr></thead>
                    <tbody>
                      {retencoes.map((r, i) => (
                        <tr key={i} className="border-b"><td className="p-1">{r.fornecedor_nome}</td><td className="text-right p-1">{formatBRL(Number(r.valor_bruto))}</td><td className="text-right p-1">{formatBRL(Number(r.retencao_valor))}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section>
                <h4 className="font-semibold mb-1">6. Resultado</h4>
                <div className="bg-muted p-3 rounded text-xs font-mono space-y-1">
                  <div>INSS Devido (Patronal + RAT + Terceiros) = {formatBRL(r.inssDevido)}</div>
                  <div>INSS Coberto (Folha + Retenções) = {formatBRL(r.inssCoberto)}</div>
                  <div className={`font-bold ${r.saldoFinal > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    SALDO FINAL = {formatBRL(r.saldoFinal)} {r.saldoFinal > 0 ? '(A RECOLHER)' : '(COBERTURA SUFICIENTE)'}
                  </div>
                  <div>INSS por m² = {formatBRL(r.inssM2)}/m²</div>
                </div>
              </section>
            </>
          )}

          <section>
            <Label>Observações do Analista</Label>
            <Textarea
              value={obra.observacoes_analista}
              onChange={e => onObraChange({ ...obra, observacoes_analista: e.target.value })}
              rows={3}
              placeholder="Observações, ressalvas, pendências..."
            />
          </section>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    </div>
  );
};

export default SeroStep5Relatorio;
