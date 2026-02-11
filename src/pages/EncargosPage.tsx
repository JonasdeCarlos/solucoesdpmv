import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, Calculator, Copy, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  type EncargosInput,
  type TabelaEncargos,
  TABELAS,
  getTabelaAnos,
  calcularEncargos,
  gerarMemoriaEncargos,
  gerarTextoEncargos,
  formatBRL,
  formatPct,
} from '@/utils/encargosCalculations';

const defaultInput: EncargosInput = {
  salarioBruto: 0,
  outrasTributaveis: 0,
  outrasIsentas: 0,
  dependentes: 0,
  pensaoAlimenticia: 0,
  descontoSimplificado: false,
  ano: 2026,
};

const EncargosPage: React.FC = () => {
  const { toast } = useToast();
  const [input, setInput] = useState<EncargosInput>(defaultInput);
  const [calculado, setCalculado] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Custom tables stored in localStorage
  const [tabelasCustom, setTabelasCustom] = useLocalStorage<Record<number, TabelaEncargos>>('encargos-tabelas-custom', {});

  const tabelaAtual: TabelaEncargos = tabelasCustom[input.ano] || TABELAS[input.ano] || TABELAS[2026];

  const handleNum = (field: keyof EncargosInput, v: string) => {
    const num = parseFloat(v.replace(',', '.')) || 0;
    setInput(prev => ({ ...prev, [field]: num }));
    setCalculado(false);
  };

  const result = useMemo(() => calcularEncargos(input), [input]);
  const memoria = useMemo(() => gerarMemoriaEncargos(input, result), [input, result]);

  const handleCalcular = () => {
    if (input.salarioBruto <= 0) {
      toast({ title: 'Informe o salário bruto', variant: 'destructive' });
      return;
    }
    setCalculado(true);
  };

  const handleCopiar = useCallback(() => {
    navigator.clipboard.writeText(gerarTextoEncargos(input, result));
    toast({ title: 'Demonstrativo copiado!' });
  }, [input, result, toast]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Encargos no Salário</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
  h2{font-size:15px;margin-bottom:4px}
  h3{font-size:12px;margin:12px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th,td{border:1px solid #999;padding:3px 6px;text-align:left}
  th{background:#e5e7eb;font-weight:600}
  .right{text-align:right}
  .grand-total{font-size:13px;font-weight:700;background:#d1fae5}
  .disclaimer{margin-top:16px;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:6px}
  .meta{margin-bottom:12px}.meta span{margin-right:20px}
  @media print{body{margin:10px}}
</style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  const grupos = memoria.reduce<Record<string, typeof memoria>>((acc, l) => {
    const g = l.grupo || 'Outros';
    if (!acc[g]) acc[g] = [];
    acc[g].push(l);
    return acc;
  }, {});

  // Config editor helpers
  const handleSaveTabela = (updated: TabelaEncargos) => {
    setTabelasCustom(prev => ({ ...prev, [updated.ano]: updated }));
    toast({ title: `Tabela ${updated.ano} salva!` });
    setConfigOpen(false);
  };

  const handleResetTabela = () => {
    setTabelasCustom(prev => {
      const copy = { ...prev };
      delete copy[input.ano];
      return copy;
    });
    toast({ title: `Tabela ${input.ano} restaurada ao padrão` });
  };

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Encargos no Salário (INSS + IRRF)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Salário bruto mensal (R$)</Label>
              <Input type="number" min={0} step="0.01" value={input.salarioBruto || ''} onChange={e => handleNum('salarioBruto', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Outras verbas tributáveis (R$)</Label>
              <Input type="number" min={0} step="0.01" value={input.outrasTributaveis || ''} onChange={e => handleNum('outrasTributaveis', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Outras verbas isentas (R$)</Label>
              <Input type="number" min={0} step="0.01" value={input.outrasIsentas || ''} onChange={e => handleNum('outrasIsentas', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Nº de dependentes</Label>
              <Input type="number" min={0} step="1" value={input.dependentes || ''} onChange={e => setInput(prev => ({ ...prev, dependentes: parseInt(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <Label>Pensão alimentícia (R$)</Label>
              <Input type="number" min={0} step="0.01" value={input.pensaoAlimenticia || ''} onChange={e => handleNum('pensaoAlimenticia', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Ano / Tabela</Label>
              <Select value={String(input.ano)} onValueChange={v => { setInput(prev => ({ ...prev, ano: Number(v) })); setCalculado(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getTabelaAnos().map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={input.descontoSimplificado} onCheckedChange={v => { setInput(prev => ({ ...prev, descontoSimplificado: v })); setCalculado(false); }} />
            <Label>Desconto simplificado mensal (IRRF)</Label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleCalcular} className="gap-1.5"><Calculator className="w-4 h-4" /> Calcular</Button>
            <Button variant="outline" onClick={handlePrint} disabled={!calculado} className="gap-1.5"><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
            <Button variant="outline" onClick={handleCopiar} disabled={!calculado} className="gap-1.5"><Copy className="w-4 h-4" /> Copiar demonstrativo</Button>
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1.5"><Settings2 className="w-4 h-4" /> Configurar Tabelas</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Configurar Tabelas — {input.ano}</DialogTitle></DialogHeader>
                <TabelaEditor tabela={{ ...tabelaAtual }} onSave={handleSaveTabela} onReset={handleResetTabela} />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {calculado && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Salário Bruto', value: formatBRL(input.salarioBruto) },
              { label: 'INSS', value: formatBRL(result.totalINSS) },
              { label: 'Base IRRF', value: formatBRL(result.baseIRRF) },
              { label: 'IRRF', value: formatBRL(result.irrfFinal) },
              { label: 'Total Descontos', value: formatBRL(result.totalDescontos) },
              { label: 'Líquido Estimado', value: formatBRL(result.salarioLiquido), highlight: true },
            ].map(c => (
              <Card key={c.label} className={c.highlight ? 'border-primary/50 bg-primary/5' : ''}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-mono font-bold text-sm mt-1">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Memória de cálculo */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-base">Memória de Cálculo</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopiar} className="gap-1.5"><Copy className="w-4 h-4" /> Copiar</Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5"><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
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
                      {linhas.map((l, i) => {
                        const isTotal = l.item.startsWith('Total') || l.item.startsWith('SALÁRIO');
                        return (
                          <TableRow key={i} className={isTotal ? 'font-bold bg-muted/30' : ''}>
                            <TableCell>{l.item}</TableCell>
                            <TableCell className="text-right">{l.base}</TableCell>
                            <TableCell className="text-right">{l.aliquota}</TableCell>
                            <TableCell className="text-right font-mono">{l.valor}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Print view */}
      <div ref={printRef} className="hidden">
        <h2>Simulação de Encargos no Salário — {input.ano}</h2>
        <div className="meta">
          <span><strong>Salário bruto:</strong> {formatBRL(input.salarioBruto)}</span>
          {input.outrasTributaveis > 0 && <span><strong>Outras tributáveis:</strong> {formatBRL(input.outrasTributaveis)}</span>}
          <span><strong>Dependentes:</strong> {input.dependentes}</span>
          <span><strong>Desc. simplificado:</strong> {input.descontoSimplificado ? 'Sim' : 'Não'}</span>
        </div>
        {Object.entries(grupos).map(([grupo, linhas]) => (
          <React.Fragment key={grupo}>
            <h3>{grupo}</h3>
            <table>
              <thead><tr><th>Item</th><th className="right">Base</th><th className="right">Alíquota/Ref</th><th className="right">Valor (R$)</th></tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className={l.item.startsWith('SALÁRIO') ? 'grand-total' : ''}>
                    <td>{l.item}</td><td className="right">{l.base}</td><td className="right">{l.aliquota}</td><td className="right">{l.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </React.Fragment>
        ))}
        <div className="disclaimer">⚠️ Simulação. Pode variar conforme natureza das verbas, decisões judiciais, CCT e parametrizações internas.</div>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        ⚠️ Simulação. Pode variar conforme natureza das verbas, decisões judiciais, CCT e parametrizações internas.
      </p>
    </div>
  );
};

// ===== Tabela Editor Component =====

interface TabelaEditorProps {
  tabela: TabelaEncargos;
  onSave: (t: TabelaEncargos) => void;
  onReset: () => void;
}

const TabelaEditor: React.FC<TabelaEditorProps> = ({ tabela, onSave, onReset }) => {
  const [t, setT] = useState<TabelaEncargos>(JSON.parse(JSON.stringify(tabela)));

  const updateINSS = (idx: number, field: 'ate' | 'aliquota', v: string) => {
    setT(prev => {
      const copy = { ...prev, inss: [...prev.inss] };
      copy.inss[idx] = { ...copy.inss[idx], [field]: parseFloat(v) || 0 };
      return copy;
    });
  };

  const updateIRRF = (idx: number, field: 'ate' | 'aliquota' | 'deducao', v: string) => {
    setT(prev => {
      const copy = { ...prev, irrf: [...prev.irrf] };
      const val = field === 'ate' && idx === prev.irrf.length - 1 ? Infinity : parseFloat(v) || 0;
      copy.irrf[idx] = { ...copy.irrf[idx], [field]: val };
      return copy;
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h4 className="font-semibold mb-2">INSS — Faixas progressivas</h4>
        <Table>
          <TableHeader><TableRow><TableHead>Até (R$)</TableHead><TableHead>Alíquota (%)</TableHead></TableRow></TableHeader>
          <TableBody>
            {t.inss.map((f, i) => (
              <TableRow key={i}>
                <TableCell><Input type="number" step="0.01" value={f.ate} onChange={e => updateINSS(i, 'ate', e.target.value)} className="h-8" /></TableCell>
                <TableCell><Input type="number" step="0.01" value={f.aliquota} onChange={e => updateINSS(i, 'aliquota', e.target.value)} className="h-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="font-semibold mb-2">IRRF — Tabela mensal</h4>
        <Table>
          <TableHeader><TableRow><TableHead>Até (R$)</TableHead><TableHead>Alíquota (%)</TableHead><TableHead>Dedução (R$)</TableHead></TableRow></TableHeader>
          <TableBody>
            {t.irrf.map((f, i) => (
              <TableRow key={i}>
                <TableCell>{i === t.irrf.length - 1 ? '∞' : <Input type="number" step="0.01" value={f.ate} onChange={e => updateIRRF(i, 'ate', e.target.value)} className="h-8" />}</TableCell>
                <TableCell><Input type="number" step="0.01" value={f.aliquota} onChange={e => updateIRRF(i, 'aliquota', e.target.value)} className="h-8" /></TableCell>
                <TableCell><Input type="number" step="0.01" value={f.deducao} onChange={e => updateIRRF(i, 'deducao', e.target.value)} className="h-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Dedução por dependente (R$)</Label>
          <Input type="number" step="0.01" value={t.deducaoDependente} onChange={e => setT(prev => ({ ...prev, deducaoDependente: parseFloat(e.target.value) || 0 }))} className="h-8" />
        </div>
        <div>
          <Label>Limite desc. simplificado (R$)</Label>
          <Input type="number" step="0.01" value={t.limiteDescontoSimplificado} onChange={e => setT(prev => ({ ...prev, limiteDescontoSimplificado: parseFloat(e.target.value) || 0 }))} className="h-8" />
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Redução mensal do IR</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Limite isenção (R$)</Label><Input type="number" step="0.01" value={t.reducaoMensal.limiteIsencao} onChange={e => setT(prev => ({ ...prev, reducaoMensal: { ...prev.reducaoMensal, limiteIsencao: parseFloat(e.target.value) || 0 } }))} className="h-8" /></div>
          <div><Label>Redução máxima (R$)</Label><Input type="number" step="0.01" value={t.reducaoMensal.reducaoMaxima} onChange={e => setT(prev => ({ ...prev, reducaoMensal: { ...prev.reducaoMensal, reducaoMaxima: parseFloat(e.target.value) || 0 } }))} className="h-8" /></div>
          <div><Label>Limite regressão (R$)</Label><Input type="number" step="0.01" value={t.reducaoMensal.limiteRegressao} onChange={e => setT(prev => ({ ...prev, reducaoMensal: { ...prev.reducaoMensal, limiteRegressao: parseFloat(e.target.value) || 0 } }))} className="h-8" /></div>
          <div><Label>Coeficiente</Label><Input type="number" step="0.000001" value={t.reducaoMensal.coeficiente} onChange={e => setT(prev => ({ ...prev, reducaoMensal: { ...prev.reducaoMensal, coeficiente: parseFloat(e.target.value) || 0 } }))} className="h-8" /></div>
          <div><Label>Constante (R$)</Label><Input type="number" step="0.01" value={t.reducaoMensal.constante} onChange={e => setT(prev => ({ ...prev, reducaoMensal: { ...prev.reducaoMensal, constante: parseFloat(e.target.value) || 0 } }))} className="h-8" /></div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(t)}>Salvar tabela</Button>
        <Button variant="outline" onClick={onReset}>Restaurar padrão</Button>
      </div>
    </div>
  );
};

export default EncargosPage;
