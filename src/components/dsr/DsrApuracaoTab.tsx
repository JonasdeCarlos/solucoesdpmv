import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useFeriadosExtendidos, useProvisionEntries, useVerbasDsr, useDsrResults } from '@/hooks/useDsrModule';
import { apurarDsr, contarDiasMes, exportarCsvApuracao } from '@/utils/dsrCalculations';
import { gerarPdfApuracaoDsr } from '@/utils/dsrPdfGenerator';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  empresa: string;
  competencia: string;
}

export default function DsrApuracaoTab({ empresa, competencia }: Props) {
  const { verbas } = useVerbasDsr();
  const { entries } = useProvisionEntries(empresa, competencia);
  const { feriados, overrides } = useFeriadosExtendidos();
  const { saveResult } = useDsrResults();

  const apuracao = useMemo(() => {
    if (!competencia) return null;
    return apurarDsr(empresa, competencia, verbas, entries, feriados, overrides);
  }, [empresa, competencia, verbas, entries, feriados, overrides]);

  const contagem = useMemo(() => {
    if (!competencia) return null;
    return contarDiasMes(competencia, feriados, overrides);
  }, [competencia, feriados, overrides]);

  if (!competencia) {
    return <p className="text-sm text-muted-foreground">Selecione uma competência na aba “Lançamentos”.</p>;
  }

  if (!apuracao || !contagem) return null;
  const r = apuracao.resultado;

  const downloadCsv = () => {
    const csv = exportarCsvApuracao(r);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuracao-dsr-${r.competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const { error } = await saveResult(r);
    if (error) toast.error('Erro ao salvar apuração.');
    else toast.success('Apuração salva.');
  };

  return (
    <div className="space-y-6">
      {apuracao.erro && (
        <div className="p-3 border-l-4 border-destructive bg-destructive/10 text-sm">
          ⚠️ {apuracao.erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumo do mês — {r.competencia}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Dias úteis (DU)" value={r.diasUteis} highlight />
            <Stat label="Dias DSR" value={r.diasDsr} highlight />
            <Stat label="Domingos" value={r.domingos} />
            <Stat label="Feriados não úteis" value={r.feriadosNaoUteis} />
          </div>

          {contagem.feriadosListados.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Feriados do mês:</p>
              <div className="flex flex-wrap gap-2">
                {contagem.feriadosListados.map((f) => (
                  <span key={f.data + f.nome} className="text-xs px-2 py-1 bg-muted rounded">
                    {f.data.split('-').reverse().join('/')} — {f.nome}
                    <span className="ml-1 text-muted-foreground">({f.escopo})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por verba</CardTitle>
        </CardHeader>
        <CardContent>
          {r.detalheVerbas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento na competência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verba</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-center">DU</TableHead>
                  <TableHead className="text-center">DSR (dias)</TableHead>
                  <TableHead className="text-right">DSR (R$)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.detalheVerbas.map((v) => (
                  <TableRow key={v.verbaId}>
                    <TableCell>
                      <div className="font-medium">{v.nome}</div>
                      <div className="text-xs text-muted-foreground">{v.formula}</div>
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(v.base)}</TableCell>
                    <TableCell className="text-center">{v.diasUteis}</TableCell>
                    <TableCell className="text-center">{v.diasDsr}</TableCell>
                    <TableCell className="text-right">{fmtBRL(v.dsr)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
            <Stat label="Total base" value={fmtBRL(r.totalBase)} />
            <Stat label="Total DSR" value={fmtBRL(r.totalDsr)} highlight />
            <Stat label="Total geral" value={fmtBRL(r.totalBase + r.totalDsr)} highlight />
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => gerarPdfApuracaoDsr(r, contagem)}>
              <FileDown className="w-4 h-4 mr-1" />Exportar PDF
            </Button>
            <Button variant="outline" onClick={downloadCsv}>
              <FileDown className="w-4 h-4 mr-1" />Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />Salvar apuração
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