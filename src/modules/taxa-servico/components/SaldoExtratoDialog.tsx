import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmt, competenciaLabel } from '../utils/validacoes';
import type { TsCompetencia } from '../hooks/useTaxaServico';

export default function SaldoExtratoDialog({ open, onOpenChange, competencias }: { open: boolean; onOpenChange: (o: boolean) => void; competencias: TsCompetencia[] }) {
  const movs: { comp: string; tipo: 'Gerado' | 'Utilizado'; valor: number }[] = [];
  [...competencias].sort((a, b) => a.competencia.localeCompare(b.competencia)).forEach((c) => {
    if ((c.status === 'exportado' || c.status === 'ajustado') && c.saldo_utilizado) movs.push({ comp: c.competencia, tipo: 'Utilizado', valor: -c.saldo_utilizado });
    if (c.status === 'ajustado' && c.saldo_nao_distribuido) movs.push({ comp: c.competencia, tipo: 'Gerado', valor: c.saldo_nao_distribuido });
  });
  let acc = 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Extrato do saldo não distribuído</DialogTitle></DialogHeader>
        {movs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma movimentação.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr><th className="p-2 text-left">Competência</th><th className="p-2 text-left">Movimento</th><th className="p-2 text-right">Valor</th><th className="p-2 text-right">Saldo</th></tr></thead>
            <tbody>{movs.map((m, i) => { acc += m.valor; return (
              <tr key={i} className="border-t">
                <td className="p-2">{competenciaLabel(m.comp)}</td><td className="p-2">{m.tipo}</td>
                <td className={`p-2 text-right ${m.valor < 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(m.valor)}</td>
                <td className="p-2 text-right font-medium">{fmt(acc)}</td>
              </tr>); })}</tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
