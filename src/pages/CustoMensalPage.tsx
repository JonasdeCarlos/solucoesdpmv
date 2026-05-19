import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Calculator, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  type CustoMensalInput,
  calcularCustoMensal,
  gerarMemoriaCalculo,
  gerarTextoCopiavel,
  formatBRL,
  formatPct,
} from '@/utils/custoMensalCalculations';

const defaultInput: CustoMensalInput = {
  salario: 0,
  baseCalculo: 0,
  simplesNacional: false,
  recolheCPP: false,
  ratPct: 2,
  terceirosPct: 5.8,
  fgtsPct: 8,
  multaFgtsPct: 40,
  competencia: '',
};

const STORAGE_KEY = 'custo_mensal_state_v1';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { input?: CustoMensalInput; baseEditada?: boolean; calculado?: boolean } : null;
  } catch {
    return null;
  }
}

const CustoMensalPage: React.FC = () => {
  const { toast } = useToast();
  const persisted = loadPersistedState();
  const [input, setInput] = useState<CustoMensalInput>(persisted?.input ?? defaultInput);
  const [baseEditada, setBaseEditada] = useState(persisted?.baseEditada ?? false);
  const [calculado, setCalculado] = useState(persisted?.calculado ?? false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, baseEditada, calculado }));
  }, [input, baseEditada, calculado]);

  const handleSalarioChange = (v: string) => {
    const num = parseFloat(v.replace(',', '.')) || 0;
    setInput(prev => ({
      ...prev,
      salario: num,
      baseCalculo: baseEditada ? prev.baseCalculo : num,
    }));
    setCalculado(false);
  };

  const handleBaseChange = (v: string) => {
    const num = parseFloat(v.replace(',', '.')) || 0;
    setBaseEditada(true);
    setInput(prev => ({ ...prev, baseCalculo: num }));
    setCalculado(false);
  };

  const handleField = (field: keyof CustoMensalInput, v: string) => {
    const num = parseFloat(v.replace(',', '.')) || 0;
    setInput(prev => ({ ...prev, [field]: num }));
    setCalculado(false);
  };

  const result = useMemo(() => calcularCustoMensal(input), [input]);
  const memoria = useMemo(() => gerarMemoriaCalculo(input, result), [input, result]);

  const handleCalcular = () => {
    if (input.baseCalculo <= 0) {
      toast({ title: 'Informe o salário', variant: 'destructive' });
      return;
    }
    setCalculado(true);
  };

  const handleCopiar = useCallback(() => {
    const txt = gerarTextoCopiavel(input, result);
    navigator.clipboard.writeText(txt);
    toast({ title: 'Demonstrativo copiado!' });
  }, [input, result, toast]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Custo Mensal de Contratação</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
  h2 { font-size: 15px; margin-bottom: 4px; }
  h3 { font-size: 12px; margin: 12px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; }
  th { background: #e5e7eb; font-weight: 600; }
  .right { text-align: right; }
  .total-row { font-weight: 700; background: #f3f4f6; }
  .grand-total { font-size: 13px; font-weight: 700; background: #d1fae5; }
  .disclaimer { margin-top: 16px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
  .meta { margin-bottom: 12px; }
  .meta span { margin-right: 20px; }
</style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  // Group lines by grupo
  const grupos = memoria.reduce<Record<string, typeof memoria>>((acc, l) => {
    const g = l.grupo || 'Outros';
    if (!acc[g]) acc[g] = [];
    acc[g].push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Custo Mensal de Contratação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Salário mensal (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={input.salario || ''}
                onChange={(e) => handleSalarioChange(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Base de cálculo (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={input.baseCalculo || ''}
                onChange={(e) => handleBaseChange(e.target.value)}
                placeholder="= Salário"
              />
              <p className="text-xs text-muted-foreground mt-1">Edite para incluir adicionais</p>
            </div>
            <div>
              <Label>Competência (opcional)</Label>
              <Input
                type="month"
                value={input.competencia}
                onChange={(e) => setInput(prev => ({ ...prev, competencia: e.target.value }))}
              />
            </div>
          </div>

          {/* Simples / CPP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={input.simplesNacional}
                onCheckedChange={(v) => setInput(prev => ({ ...prev, simplesNacional: v, recolheCPP: false }))}
              />
              <Label>Simples Nacional</Label>
            </div>
            {input.simplesNacional && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={input.recolheCPP}
                  onCheckedChange={(v) => setInput(prev => ({ ...prev, recolheCPP: v }))}
                />
                <Label>Recolhe CPP pela folha?</Label>
              </div>
            )}
          </div>

          {/* Alíquotas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <Label>RAT (%)</Label>
              <Input type="number" min={0} step="0.01" value={input.ratPct || ''} onChange={(e) => handleField('ratPct', e.target.value)} />
            </div>
            <div>
              <Label>Terceiros (%)</Label>
              <Input type="number" min={0} step="0.01" value={input.terceirosPct || ''} onChange={(e) => handleField('terceirosPct', e.target.value)} />
            </div>
            <div>
              <Label>FGTS (%)</Label>
              <Input type="number" min={0} step="0.01" value={input.fgtsPct || ''} onChange={(e) => handleField('fgtsPct', e.target.value)} />
            </div>
            <div>
              <Label>Multa FGTS (%)</Label>
              <Input type="number" min={0} step="0.01" value={input.multaFgtsPct || ''} onChange={(e) => handleField('multaFgtsPct', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleCalcular} className="gap-1.5">
              <Calculator className="w-4 h-4" /> Calcular
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!calculado} className="gap-1.5">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </Button>
            <Button variant="outline" onClick={handleCopiar} disabled={!calculado} className="gap-1.5">
              <Copy className="w-4 h-4" /> Copiar demonstrativo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Memória de cálculo */}
      {calculado && (
        <Card>
          <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-base">Memória de Cálculo</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopiar} className="gap-1.5">
                <Copy className="w-4 h-4" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-4 h-4" /> Imprimir / PDF
              </Button>
            </div>
          </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(grupos).map(([grupo, linhas]) => (
              <div key={grupo}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">{grupo}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Alíquota/Ref</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{l.item}</TableCell>
                        <TableCell className="text-right">{l.base}</TableCell>
                        <TableCell className="text-right">{l.aliquota}</TableCell>
                        <TableCell className="text-right font-mono">{l.valor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

            {/* Totais */}
            <div className="border-t pt-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Custo direto (base + encargos + FGTS mês)</span>
                  <span className="font-mono font-semibold">{formatBRL(result.base + result.custoEncargos)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Total provisões (13º + férias + 1/3)</span>
                  <span className="font-mono font-semibold">{formatBRL(result.totalProvisoes)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>FGTS do mês</span>
                  <span className="font-mono font-semibold">{formatBRL(result.fgtsMes)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>FGTS reflexos (s/ provisões)</span>
                  <span className="font-mono font-semibold">{formatBRL(result.totalFgtsReflexos)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>FGTS total</span>
                  <span className="font-mono font-semibold">{formatBRL(result.fgtsTotal)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Prov. multa FGTS ({formatPct(input.multaFgtsPct)})</span>
                  <span className="font-mono font-semibold">{formatBRL(result.provMultaFgts)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/30 text-base font-bold">
                <span>CUSTO MENSAL TOTAL ESTIMADO</span>
                <span className="font-mono text-lg">{formatBRL(result.custoMensalTotal)}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                <span>Percentual efetivo sobre base</span>
                <span className="font-mono font-semibold">{formatPct(result.percentualEfetivo)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print view (hidden) */}
      <div ref={printRef} className="hidden">
        <h2>Custo Mensal de Contratação</h2>
        <div className="meta">
          {input.competencia && <span><strong>Competência:</strong> {input.competencia}</span>}
          <span><strong>Salário:</strong> {formatBRL(input.salario)}</span>
          <span><strong>Base:</strong> {formatBRL(result.base)}</span>
          <span><strong>Simples:</strong> {input.simplesNacional ? 'Sim' : 'Não'}</span>
          {input.simplesNacional && <span><strong>CPP na folha:</strong> {input.recolheCPP ? 'Sim' : 'Não'}</span>}
        </div>

        <h3>Memória de Cálculo</h3>
        <table>
          <thead>
            <tr><th>Item</th><th className="right">Base</th><th className="right">Alíquota/Ref</th><th className="right">Valor (R$)</th></tr>
          </thead>
          <tbody>
            {memoria.map((l, i) => {
              const isFirst = i === 0 || l.grupo !== memoria[i - 1]?.grupo;
              return (
                <React.Fragment key={i}>
                  {isFirst && l.grupo && (
                    <tr><td colSpan={4} style={{ fontWeight: 700, background: '#f3f4f6', paddingTop: 8 }}>{l.grupo}</td></tr>
                  )}
                  <tr>
                    <td>{l.item}</td>
                    <td className="right">{l.base}</td>
                    <td className="right">{l.aliquota}</td>
                    <td className="right">{l.valor}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <h3>Totais</h3>
        <table>
          <tbody>
            <tr><td>Custo direto (base + encargos + FGTS mês)</td><td className="right">{formatBRL(result.base + result.custoEncargos)}</td></tr>
            <tr><td>Total provisões (13º + férias + 1/3)</td><td className="right">{formatBRL(result.totalProvisoes)}</td></tr>
            <tr><td>FGTS do mês</td><td className="right">{formatBRL(result.fgtsMes)}</td></tr>
            <tr><td>FGTS reflexos (s/ provisões)</td><td className="right">{formatBRL(result.totalFgtsReflexos)}</td></tr>
            <tr><td>FGTS total</td><td className="right">{formatBRL(result.fgtsTotal)}</td></tr>
            <tr><td>Provisão multa FGTS ({formatPct(input.multaFgtsPct)})</td><td className="right">{formatBRL(result.provMultaFgts)}</td></tr>
            <tr className="grand-total"><td>CUSTO MENSAL TOTAL ESTIMADO</td><td className="right">{formatBRL(result.custoMensalTotal)}</td></tr>
            <tr><td>Percentual efetivo sobre base</td><td className="right">{formatPct(result.percentualEfetivo)}</td></tr>
          </tbody>
        </table>

        <div className="disclaimer">
          ⚠️ Cálculo estimativo. Alíquotas variam por CNAE/FPAS/FAP, regras do Simples/CPP, CCT e particularidades do contrato.
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        ⚠️ Cálculo estimativo. Alíquotas variam por CNAE/FPAS/FAP, regras do Simples/CPP, CCT e particularidades do contrato.
      </p>
    </div>
  );
};

export default CustoMensalPage;
