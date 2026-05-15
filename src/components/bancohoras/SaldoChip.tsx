import { AlertTriangle } from 'lucide-react';
import { classifyFaixa, FAIXA_CLASS, formatHHMM } from '@/utils/bancoHoras/calc';

export function SaldoChip({ minutes }: { minutes: number }) {
  const faixa = classifyFaixa(minutes);
  const label = formatHHMM(minutes);
  const negative = minutes < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${FAIXA_CLASS[faixa]}`}
    >
      {negative && <AlertTriangle className="w-3 h-3" />}
      {label}
    </span>
  );
}
