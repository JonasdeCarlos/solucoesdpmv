import { Card, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { fmt } from '../utils/validacoes';
import type { TsSaldo } from '../hooks/useTaxaServico';

export default function SaldoCard({ saldo, onClick }: { saldo: TsSaldo; onClick?: () => void }) {
  return (
    <Card className="cursor-pointer border-primary/40 hover:border-primary transition-colors" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="rounded-full bg-primary/10 p-3"><Wallet className="w-6 h-6 text-primary" /></div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Saldo de comissões não distribuídas</p>
          <p className={`text-2xl font-bold ${saldo.saldo_acumulado < 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(saldo.saldo_acumulado)}</p>
          <p className="text-xs text-muted-foreground">Gerado {fmt(saldo.saldo_gerado)} · Utilizado {fmt(saldo.saldo_consumido)} · clique para ver o extrato</p>
        </div>
      </CardContent>
    </Card>
  );
}
