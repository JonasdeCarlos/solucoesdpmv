import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { Tendencia, formatHHMM } from '@/utils/bancoHoras/calc';

export function TrendArrow({ tend, delta }: { tend: Tendencia; delta: number | null }) {
  if (delta == null) return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = tend === 'alta' ? ArrowUp : tend === 'queda' ? ArrowDown : ArrowRight;
  const color = tend === 'alta' ? 'text-green-600' : tend === 'queda' ? 'text-red-600' : 'text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`} title={`Variação ${formatHHMM(delta)}`}>
      <Icon className="w-3 h-3" />
      {formatHHMM(delta)}
    </span>
  );
}
