import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import { useFeriadosExtendidos } from '@/hooks/useDsrModule';
import {
  calcularPrevisaoAno,
  calcularPrevisaoMes,
  criarVerbaPrevisao,
  exportarCsvPrevisao,
  parseHoras,
  type VerbaPrevisao,
} from '@/utils/previsaoRecebimento';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  competencia: string;
}

export default function DsrPrevisaoTab({ competencia }: Props) {
  const { feriados, overrides } = useFeriadosExtendidos();
  const [salarioBase, setSalarioBase] = useState(0);
  const [jornadaMensal, setJornadaMensal] = useState(220);
  const [sabadoUtil, setSabadoUtil] = useState(true);
  const [anual, setAnual] = useState(false);
  const [verbas, setVerbas] = useState<VerbaPrevisao[]>([criarVerbaPrevisao()]);

  const comp = competencia || new Date().toISOString().slice(0, 7);
  const ano = Number(comp.split('-')[0]);
  const opts = { salarioBase, jornadaMensal, considerarSabadoUtil: sabadoUtil };

  const mes = useMemo(
    () => calcularPrevisaoMes(comp, verbas, opts, feriados, overrides),
    [comp, verbas, salarioBase, jornadaMensal, sabadoUtil, feriados, overrides],
  );

  const meses = useMemo(
    () => (anual ? calcularPrevisaoAno(ano, verbas, opts, feriados, overrides) : []),
    [anual, ano, verbas, salarioBase, jornadaMensal, sabadoUtil, feriados, overrides],
  );

  const totaisAno = useMemo(
    () =>
      meses.reduce(
        (a, m) => ({
          salario: a.salario + m.salarioBase,
          verbas: a.verbas + m.totalVerbas,
          dsr: a.dsr + m.totalDsr,
          bruto: a.bruto + m.totalBruto,
        }),
        { salario: 0, verbas: 0, dsr: 0, bruto: 0 },
      ),
    [meses],
  );

  const update = (id: string, patch: Partial<VerbaPrevisao>) =>
    setVerbas((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const downloadCsv = () => {
    const csv = exportarCsvPrevisao(anual ? meses : [mes]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `previsao-recebimento-${anual ? ano : comp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Previsão de recebimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Salário base (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={salarioBase || ''}
                onChange={(e) => setSalarioBase(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Jornada mensal (horas)</Label>
              <Input
                type="number"
                value={jornadaMensal || ''}
                onChange={(e) => setJornadaMensal(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch id="sab" checked={sabadoUtil} onCheckedChange={setSabadoUtil} />
              <Label htmlFor="sab" className="mb-1">Sábado é dia útil</Label>
            </div>
            <div className="flex items-end gap-2">
              <Switch id="anual" checked={anual} onCheckedChange={setAnual} />
              <Label htmlFor="anual" className="mb-1">Projetar o ano {ano}</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Valor-hora = salário base ÷ jornada mensal. O DSR é recalculado mês a mês conforme dias úteis e
            domingos/feriados do calendário.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Verbas variáveis</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setVerbas((p) => [...p, criarVerbaPrevisao()])}>
            <Plus className="w-4 h-4 mr-1" />Adicionar verba
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {verbas.map((v) => (
            <div key={v.id} className="grid gap-2 md:grid-cols-12 items-end border rounded-md p-3">
              <div className="md:col-span-4">
                <Label className="text-xs">Descrição</Label>
                <Input value={v.descricao} onChange={(e) => update(v.id, { descricao: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Tipo</Label>
                <Select value={v.tipo} onValueChange={(val) => update(v.id, { tipo: val as VerbaPrevisao['tipo'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="hora_extra">Hora extra</SelectItem>
                    <SelectItem value="adicional_noturno">Adicional noturno</SelectItem>
                    <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {v.tipo === 'valor_fixo' ? (
                <div className="md:col-span-2">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={v.valor || ''}
                    onChange={(e) => update(v.id, { valor: Number(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Horas (HH:MM)</Label>
                    <Input
                      placeholder="7:20"
                      value={v.horasInput}
                      onChange={(e) => update(v.id, { horasInput: e.target.value, horas: parseHoras(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Adicional (%)</Label>
                    <Input
                      type="number"
                      value={v.percentual}
                      onChange={(e) => update(v.id, { percentual: Number(e.target.value) || 0 })}
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-1 flex items-center gap-2">
                <Switch checked={v.incideDsr} onCheckedChange={(c) => update(v.id, { incideDsr: c })} />
                <span className="text-xs">DSR</span>
              </div>
              <div className="md:col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => setVerbas((p) => p.filter((x) => x.id !== v.id))}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {verbas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma verba adicionada.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previsão — {anual ? `ano ${ano}` : comp}</CardTitle>
        </CardHeader>
        <CardContent>
          {mes.erro && !anual && (
            <div className="p-3 mb-3 border-l-4 border-destructive bg-destructive/10 text-sm">⚠️ {mes.erro}</div>
          )}

          {!anual ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Dias úteis (DU)" value={mes.diasUteis} highlight />
                <Stat label="Dias DSR" value={mes.diasDsr} highlight />
                <Stat label="Salário base" value={fmtBRL(mes.salarioBase)} />
                <Stat label="Bruto previsto" value={fmtBRL(mes.totalBruto)} highlight />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Verba</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Reflexo DSR</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Salário base</TableCell>
                    <TableCell className="text-right">{fmtBRL(mes.salarioBase)}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(mes.salarioBase)}</TableCell>
                  </TableRow>
                  {mes.verbas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.descricao}</div>
                        <div className="text-xs text-muted-foreground">{l.detalhe}</div>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(l.base)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(l.dsr)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(l.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell>Bruto previsto</TableCell>
                    <TableCell className="text-right">{fmtBRL(mes.salarioBase + mes.totalVerbas)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(mes.totalDsr)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(mes.totalBruto)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-center">DU</TableHead>
                  <TableHead className="text-center">DSR (dias)</TableHead>
                  <TableHead className="text-right">Salário base</TableHead>
                  <TableHead className="text-right">Verbas</TableHead>
                  <TableHead className="text-right">Reflexo DSR</TableHead>
                  <TableHead className="text-right">Bruto previsto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((m) => (
                  <TableRow key={m.competencia}>
                    <TableCell className="font-mono text-xs">{m.competencia}</TableCell>
                    <TableCell className="text-center">{m.diasUteis}</TableCell>
                    <TableCell className="text-center">{m.diasDsr}</TableCell>
                    <TableCell className="text-right">{fmtBRL(m.salarioBase)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(m.totalVerbas)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(m.totalDsr)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(m.totalBruto)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Total {ano}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">{fmtBRL(totaisAno.salario)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totaisAno.verbas)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totaisAno.dsr)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totaisAno.bruto)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={downloadCsv}>
              <FileDown className="w-4 h-4 mr-1" />Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown className="w-4 h-4 mr-1" />Imprimir / PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
