import { type VerbaRescisoria, calcularTotal } from '@/utils/calculations';
import { formatCurrency } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ResultsTableProps {
  verbas: VerbaRescisoria[];
  editable?: boolean;
  onUpdate?: (verbas: VerbaRescisoria[]) => void;
}

const ResultsTable = ({ verbas, editable = false, onUpdate }: ResultsTableProps) => {
  const total = calcularTotal(verbas);
  const totalProventos = verbas.filter(v => v.tipo === 'credito').reduce((s, v) => s + (v.valor || 0), 0);
  const totalDescontos = verbas.filter(v => v.tipo === 'debito').reduce((s, v) => s + (v.valor || 0), 0);
  const hasDescontos = totalDescontos > 0;

  const handleValueChange = (index: number, newVal: number) => {
    if (!onUpdate) return;
    const updated = [...verbas];
    updated[index] = { ...updated[index], valor: newVal };
    onUpdate(updated);
  };

  const handleRefChange = (index: number, newRef: string) => {
    if (!onUpdate) return;
    const updated = [...verbas];
    updated[index] = { ...updated[index], referencia: newRef };
    onUpdate(updated);
  };

  const handleTipoChange = (index: number, tipo: 'credito' | 'debito') => {
    if (!onUpdate) return;
    const updated = [...verbas];
    updated[index] = { ...updated[index], tipo };
    onUpdate(updated);
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="results-table-header">
            <th className="text-left p-3 font-semibold">VERBA</th>
            <th className="text-left p-3 font-semibold">REF</th>
            <th className="text-right p-3 font-semibold">VALOR (R$)</th>
            {editable && <th className="text-center p-3 font-semibold">TIPO</th>}
          </tr>
        </thead>
        <tbody>
          {verbas.map((v, i) => (
            <tr key={v.id} className={i % 2 === 1 ? 'results-table-stripe' : ''}>
              <td className="p-3">{v.verba}</td>
              <td className="p-3">
                {editable ? (
                  <Input
                    value={v.referencia}
                    onChange={(e) => handleRefChange(i, e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                ) : (
                  v.referencia
                )}
              </td>
              <td className="p-3 text-right">
                {editable ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={v.valor}
                    onChange={(e) => handleValueChange(i, parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm text-right w-32 ml-auto"
                  />
                ) : (
                  <span className={v.tipo === 'debito' ? 'text-destructive' : ''}>
                    {v.tipo === 'debito' ? '- ' : ''}{formatCurrency(v.valor)}
                  </span>
                )}
              </td>
              {editable && (
                <td className="p-3 text-center">
                  <Select value={v.tipo} onValueChange={(val) => handleTipoChange(i, val as 'credito' | 'debito')}>
                    <SelectTrigger className="h-8 text-sm w-24 mx-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              )}
            </tr>
          ))}
          {hasDescontos ? (
            <>
              <tr className="font-semibold bg-muted/40">
                <td className="p-3" colSpan={2}>TOTAL PROVENTOS</td>
                <td className="p-3 text-right">{formatCurrency(totalProventos)}</td>
                {editable && <td />}
              </tr>
              <tr className="font-semibold bg-muted/40">
                <td className="p-3" colSpan={2}>TOTAL DESCONTOS</td>
                <td className="p-3 text-right text-destructive">- {formatCurrency(totalDescontos)}</td>
                {editable && <td />}
              </tr>
              <tr className="results-table-total font-bold">
                <td className="p-3" colSpan={2}>LÍQUIDO A RECEBER</td>
                <td className="p-3 text-right text-lg">{formatCurrency(total)}</td>
                {editable && <td />}
              </tr>
            </>
          ) : (
            <tr className="results-table-total font-bold">
              <td className="p-3" colSpan={2}>TOTAL GERAL</td>
              <td className="p-3 text-right text-lg">{formatCurrency(total)}</td>
              {editable && <td />}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
