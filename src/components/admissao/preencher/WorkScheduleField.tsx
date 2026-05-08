import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TimeInput from '@/components/ponto/TimeInput';
import { FormField, WorkScheduleValue, defaultWorkSchedule } from '@/utils/admissao/formSchema';

function parseHHMM(s: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function dayMinutes(marcacoes: string[]): number {
  let total = 0;
  for (let i = 0; i + 1 < marcacoes.length; i += 2) {
    const a = parseHHMM(marcacoes[i]);
    const b = parseHHMM(marcacoes[i + 1]);
    if (a == null || b == null) continue;
    let diff = b - a;
    if (diff < 0) diff += 24 * 60; // crosses midnight
    total += diff;
  }
  return total;
}

function fmtMin(min: number): string {
  if (!min) return '00:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  field: FormField;
  value: WorkScheduleValue | undefined;
  onChange: (v: WorkScheduleValue) => void;
  error?: string;
}

const WorkScheduleField = ({ field, value, onChange, error }: Props) => {
  const slotsDefault = (field.schedule_slots || 4) as 2 | 4 | 6;
  const v: WorkScheduleValue = value && value.dias?.length
    ? value
    : defaultWorkSchedule(slotsDefault);

  // Initialize on mount if empty
  useEffect(() => {
    if (!value || !value.dias?.length) onChange(defaultWorkSchedule(slotsDefault));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotLabels = v.slots === 6 ? ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída']
    : v.slots === 2 ? ['Entrada', 'Saída']
    : ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];

  const dayTotals = v.dias.map((d) => d.ativo ? dayMinutes(d.marcacoes) : 0);
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const setSlots = (s: 2 | 4 | 6) => {
    onChange({
      slots: s,
      dias: v.dias.map((d) => {
        const next = Array(s).fill('');
        d.marcacoes.forEach((m, i) => { if (i < s) next[i] = m; });
        return { ...d, marcacoes: next };
      }),
    });
  };

  const toggleAtivo = (i: number) => {
    onChange({ ...v, dias: v.dias.map((d, idx) => idx === i ? { ...d, ativo: !d.ativo } : d) });
  };

  const setMarc = (di: number, si: number, val: string) => {
    const updated = v.dias.map((d, i) => {
      if (i !== di) return d;
      const m = [...d.marcacoes];
      m[si] = val;
      return { ...d, marcacoes: m };
    });
    // Replicate filled row downward to empty active rows
    const edited = updated[di];
    const allFilled = edited.marcacoes.every((m) => /^\d{2}:\d{2}$/.test(m));
    let final = updated;
    if (allFilled) {
      final = updated.map((d, i) => {
        if (i <= di || !d.ativo) return d;
        const isEmpty = d.marcacoes.every((m) => !m);
        if (!isEmpty) return d;
        return { ...d, marcacoes: [...edited.marcacoes] };
      });
    }
    onChange({ ...v, dias: final });
  };

  return (
    <div className="space-y-2">
      <Label className="font-medium">
        {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground -mt-1">{field.description}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Dica: preencha o primeiro dia ativo e os horários serão replicados automaticamente para os demais dias ativos vazios.
      </p>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Marcações por dia:</Label>
        <Select value={String(v.slots)} onValueChange={(s) => setSlots(Number(s) as 2 | 4 | 6)}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 (Ent/Saí)</SelectItem>
            <SelectItem value="4">4 (com intervalo)</SelectItem>
            <SelectItem value="6">6 (2 intervalos)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Dia</th>
              <th className="p-2">Ativo</th>
              {slotLabels.map((l, i) => (
                <th key={i} className="p-2 text-center text-xs">{l}</th>
              ))}
              <th className="p-2 text-center text-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.dias.map((d, di) => (
              <tr key={d.dia} className={`border-t ${!d.ativo ? 'opacity-50' : ''}`}>
                <td className="p-2 font-medium">{d.dia}</td>
                <td className="p-2 text-center">
                  <Switch checked={d.ativo} onCheckedChange={() => toggleAtivo(di)} />
                </td>
                {d.marcacoes.map((m, si) => (
                  <td key={si} className="p-1 text-center">
                    <TimeInput value={m} onChange={(val) => setMarc(di, si, val)} disabled={!d.ativo} />
                  </td>
                ))}
                <td className="p-2 text-center font-mono text-xs tabular-nums">
                  {d.ativo ? fmtMin(dayTotals[di]) : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="p-2" colSpan={2 + v.slots}>Total semanal</td>
              <td className="p-2 text-center font-mono tabular-nums">{fmtMin(weekTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default WorkScheduleField;