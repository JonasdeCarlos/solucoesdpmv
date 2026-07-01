import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';

function decimalToHHMM(input: string): string {
  const s = input.trim().replace(',', '.');
  if (!s) return '';
  const n = Number(s);
  if (!isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hhmmToDecimal(input: string): string {
  const s = input.trim();
  if (!s) return '';
  const m = s.match(/^(-?)(\d{1,3}):(\d{1,2})$/);
  if (!m) {
    const n = Number(s.replace(',', '.'));
    if (isFinite(n)) return n.toFixed(4).replace('.', ',');
    return '';
  }
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  if (min >= 60) return '';
  const dec = sign * (h + min / 60);
  return dec.toFixed(4).replace(/\.?0+$/, '').replace('.', ',') || '0';
}

export function HoraDecimalConverter() {
  const [decIn, setDecIn] = useState('');
  const [hhmmIn, setHhmmIn] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Conversor de horas">
          <Calculator className="w-4 h-4" />
          <span className="hidden md:inline ml-1">Conversor</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conversor de Horas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <Label className="text-xs">Decimal (ex: 7,5)</Label>
              <Input
                inputMode="decimal"
                value={decIn}
                onChange={(e) => setDecIn(e.target.value)}
                placeholder="7,5"
              />
            </div>
            <span className="pb-2 text-muted-foreground">→</span>
            <div>
              <Label className="text-xs">Hora:Minuto</Label>
              <Input value={decimalToHHMM(decIn)} readOnly placeholder="07:30" className="font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <Label className="text-xs">Hora:Minuto (ex: 7:30)</Label>
              <Input
                value={hhmmIn}
                onChange={(e) => setHhmmIn(e.target.value)}
                placeholder="07:30"
                className="font-mono"
              />
            </div>
            <span className="pb-2 text-muted-foreground">→</span>
            <div>
              <Label className="text-xs">Decimal</Label>
              <Input value={hhmmToDecimal(hhmmIn)} readOnly placeholder="7,5" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Digite em um dos campos e a conversão aparece automaticamente. Ex.: 7,5 → 07:30 · 1:45 → 1,75
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}