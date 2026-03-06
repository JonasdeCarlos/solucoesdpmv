import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BookOpen, Printer, Trash2, Plus } from 'lucide-react';
import { minutesToHHMM } from '@/utils/pontoCalculations';
import { toast } from 'sonner';

const BANCO_HORAS_KEY = 'ponto_banco_horas';

export interface BancoHorasEntry {
  id: string;
  empregadoNome: string;
  empresaNome: string;
  mesAno: string; // yyyy-MM
  saldoFinal: number; // minutes
  addedAt: string;
}

function loadEntries(): BancoHorasEntry[] {
  try {
    const raw = localStorage.getItem(BANCO_HORAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: BancoHorasEntry[]) {
  localStorage.setItem(BANCO_HORAS_KEY, JSON.stringify(entries));
}

function formatMesAno(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(m) - 1]}/${y}`;
}

interface Props {
  empregadoNome: string;
  empresaNome: string;
  mesAno: string;
  saldoFinal: number;
}

const PontoBancoHoras: React.FC<Props> = ({ empregadoNome, empresaNome, mesAno, saldoFinal }) => {
  const [entries, setEntries] = useState<BancoHorasEntry[]>(loadEntries);
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleIncluir = () => {
    const existing = entries.find(e => e.mesAno === mesAno && e.empregadoNome === empregadoNome);
    let updated: BancoHorasEntry[];

    if (existing) {
      updated = entries.map(e =>
        e.id === existing.id ? { ...e, saldoFinal, empresaNome, addedAt: new Date().toISOString() } : e
      );
      toast.success(`Banco de Horas atualizado para ${formatMesAno(mesAno)}`);
    } else {
      const entry: BancoHorasEntry = {
        id: crypto.randomUUID(),
        empregadoNome: empregadoNome || 'Empregado',
        empresaNome: empresaNome || '',
        mesAno,
        saldoFinal,
        addedAt: new Date().toISOString(),
      };
      updated = [...entries, entry].sort((a, b) => a.mesAno.localeCompare(b.mesAno));
      toast.success(`Período ${formatMesAno(mesAno)} incluído no Banco de Horas`);
    }

    setEntries(updated);
    saveEntries(updated);
  };

  const handleRemove = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
    toast.info('Período removido do Banco de Horas');
  };

  const handleClearAll = () => {
    setEntries([]);
    saveEntries([]);
    toast.info('Banco de Horas limpo');
  };

  const handlePrintReport = () => {
    const content = reportRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Banco de Horas</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 10pt; padding: 15mm; color: #222; }
          h2 { font-size: 14pt; margin-bottom: 6px; }
          .subtitle { font-size: 9pt; color: #666; margin-bottom: 12px; }
          .info { font-size: 9pt; margin-bottom: 10px; }
          .info .label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }
          th, td { border: 1px solid #999; padding: 4px 8px; text-align: center; }
          th { background: #eee; font-weight: bold; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .positive { color: #166534; font-weight: bold; }
          .negative { color: #991b1b; font-weight: bold; }
          .total-row { background: #f5f5f5; font-weight: bold; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
          .sig-line { text-align: center; width: 45%; }
          .sig-line hr { border: none; border-top: 1px solid #333; margin-bottom: 4px; }
          .disclaimer { margin-top: 16px; font-size: 7pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculate running balance
  let saldoAcumulado = 0;
  const entriesWithBalance = entries.map(e => {
    saldoAcumulado += e.saldoFinal;
    return { ...e, saldoAcumulado };
  });

  const totalCredito = entries.reduce((s, e) => s + (e.saldoFinal > 0 ? e.saldoFinal : 0), 0);
  const totalDebito = entries.reduce((s, e) => s + (e.saldoFinal < 0 ? e.saldoFinal : 0), 0);

  const saldoClass = (v: number) => v > 0 ? 'text-green-700 dark:text-green-400' : v < 0 ? 'text-red-700 dark:text-red-400' : '';

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleIncluir} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Incluir no Banco de Horas
        </Button>
        <Button
          variant={showReport ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowReport(!showReport)}
          className="gap-1.5"
        >
          <BookOpen className="w-4 h-4" />
          {showReport ? 'Ocultar' : 'Ver'} Banco de Horas ({entries.length})
        </Button>
      </div>

      {/* Report view */}
      {showReport && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Relatório de Banco de Horas</CardTitle>
              <div className="flex gap-2">
                {entries.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5">
                      <Printer className="w-4 h-4" />
                      Imprimir / PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                      Limpar Tudo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Nenhum período adicionado ao Banco de Horas. Processe um mês e clique em "Incluir no Banco de Horas".
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Período</TableHead>
                      <TableHead className="text-center">Empregado</TableHead>
                      <TableHead className="text-center">Crédito</TableHead>
                      <TableHead className="text-center">Débito</TableHead>
                      <TableHead className="text-center">Saldo Mês</TableHead>
                      <TableHead className="text-center">Saldo Acumulado</TableHead>
                      <TableHead className="text-center w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesWithBalance.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-center">{formatMesAno(e.mesAno)}</TableCell>
                        <TableCell className="text-center">{e.empregadoNome}</TableCell>
                        <TableCell className={`font-mono text-center ${e.saldoFinal > 0 ? saldoClass(e.saldoFinal) : ''}`}>
                          {e.saldoFinal > 0 ? minutesToHHMM(e.saldoFinal) : ''}
                        </TableCell>
                        <TableCell className={`font-mono text-center ${e.saldoFinal < 0 ? saldoClass(e.saldoFinal) : ''}`}>
                          {e.saldoFinal < 0 ? minutesToHHMM(e.saldoFinal) : ''}
                        </TableCell>
                        <TableCell className={`font-mono text-center font-semibold ${saldoClass(e.saldoFinal)}`}>
                          {minutesToHHMM(e.saldoFinal)}
                        </TableCell>
                        <TableCell className={`font-mono text-center font-bold ${saldoClass(e.saldoAcumulado)}`}>
                          {minutesToHHMM(e.saldoAcumulado)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(e.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="text-right font-bold">Totais:</TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(totalCredito)}`}>
                        {minutesToHHMM(totalCredito)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(totalDebito)}`}>
                        {minutesToHHMM(totalDebito)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(saldoAcumulado)}`}>
                        {minutesToHHMM(saldoAcumulado)}
                      </TableCell>
                      <TableCell className={`font-mono text-center font-bold ${saldoClass(saldoAcumulado)}`}>
                        {minutesToHHMM(saldoAcumulado)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden print content */}
      <div ref={reportRef} className="hidden">
        <h2>RELATÓRIO DE BANCO DE HORAS</h2>
        <div className="info">
          {entries[0]?.empresaNome && <><span className="label">Empresa: </span>{entries[0].empresaNome}<br/></>}
          {entries[0]?.empregadoNome && <><span className="label">Empregado: </span>{entries[0].empregadoNome}<br/></>}
          <span className="label">Emissão: </span>{new Date().toLocaleDateString('pt-BR')}
        </div>

        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Crédito</th>
              <th>Débito</th>
              <th>Saldo Mês</th>
              <th>Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {entriesWithBalance.map(e => (
              <tr key={e.id}>
                <td>{formatMesAno(e.mesAno)}</td>
                <td className={e.saldoFinal > 0 ? 'positive' : ''}>{e.saldoFinal > 0 ? minutesToHHMM(e.saldoFinal) : ''}</td>
                <td className={e.saldoFinal < 0 ? 'negative' : ''}>{e.saldoFinal < 0 ? minutesToHHMM(e.saldoFinal) : ''}</td>
                <td className={e.saldoFinal >= 0 ? 'positive' : 'negative'}>{minutesToHHMM(e.saldoFinal)}</td>
                <td className={e.saldoAcumulado >= 0 ? 'positive' : 'negative'}><strong>{minutesToHHMM(e.saldoAcumulado)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td className="text-right"><strong>Totais:</strong></td>
              <td className="positive">{minutesToHHMM(totalCredito)}</td>
              <td className="negative">{minutesToHHMM(totalDebito)}</td>
              <td className={saldoAcumulado >= 0 ? 'positive' : 'negative'}>{minutesToHHMM(saldoAcumulado)}</td>
              <td className={saldoAcumulado >= 0 ? 'positive' : 'negative'}><strong>{minutesToHHMM(saldoAcumulado)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <div className="signatures">
          <div className="sig-line"><hr/> Empregado</div>
          <div className="sig-line"><hr/> Empresa / Responsável</div>
        </div>

        <div className="disclaimer">
          ⚠️ Relatório estimativo de banco de horas para conferência. Pode haver regras específicas por CCT, escalas e acordos.
        </div>
      </div>
    </div>
  );
};

export default PontoBancoHoras;
