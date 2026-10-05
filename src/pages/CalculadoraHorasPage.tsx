import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Timer, Plus, Trash2, Calculator } from 'lucide-react';

/** Decimal (vírgula ou ponto) → HH:MM */
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

/** HH:MM (ou decimal) → decimal com vírgula */
function hhmmToDecimal(input: string): string {
  const s = input.trim();
  if (!s) return '';
  const m = s.match(/^(-?)(\d{1,3}):(\d{1,2})$/);
  if (!m) {
    const n = Number(s.replace(',', '.'));
    if (isFinite(n)) return n.toFixed(4).replace(/\.?0+$/, '').replace('.', ',') || '0';
    return '';
  }
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  if (min >= 60) return '';
  const dec = sign * (h + min / 60);
  return dec.toFixed(4).replace(/\.?0+$/, '').replace('.', ',') || '0';
}

/** HH:MM → minutos (aceita sinal). null se inválido. */
function hhmmToMin(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/^(-?)(\d{1,4}):(\d{1,2})$/);
  if (m) {
    const min = parseInt(m[3], 10);
    if (min >= 60) return null;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + min);
  }
  // decimal (vírgula ou ponto)
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || s === '') return null;
  return Math.round(n * 60);
}

function minToHHMM(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function CalculadoraHorasPage() {
  const [decIn, setDecIn] = useState('');
  const [hhmmIn, setHhmmIn] = useState('');

  const [linhas, setLinhas] = useState<{ id: number; valor: string }[]>([{ id: 1, valor: '' }, { id: 2, valor: '' }]);
  const [multiplicador, setMultiplicador] = useState('1');
  const [nextId, setNextId] = useState(3);

  const setLinha = (id: number, valor: string) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, valor } : l)));

  const totalMin = linhas.reduce((acc, l) => acc + (hhmmToMin(l.valor) ?? 0), 0);
  const multNum = Number((multiplicador || '0').replace(',', '.'));
  const totalComMult = Math.round(totalMin * (isFinite(multNum) ? multNum : 0));

  const invalidas = linhas.filter((l) => l.valor.trim() && hhmmToMin(l.valor) === null);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Timer className="w-6 h-6 text-primary" />
          Calculadora de Horas
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Converta entre decimal e hora:minuto e some jornadas rapidamente.
        </p>
      </div>

      {/* Conversor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversor decimal ↔ hora:minuto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Soma de horas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Soma de horas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {linhas.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input
                  value={l.valor}
                  onChange={(e) => setLinha(l.id, e.target.value)}
                  placeholder="08:00"
                  className={`font-mono w-32 ${l.valor.trim() && hhmmToMin(l.valor) === null ? 'border-destructive' : ''}`}
                />
                <span className="text-sm text-muted-foreground flex-1 truncate">
                  {hhmmToMin(l.valor) !== null && l.valor.trim() ? `${hhmmToDecimal(l.valor)} h decimal` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinhas((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== l.id) : prev))}
                  title="Remover linha"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLinhas((p) => [...p, { id: nextId, valor: '' }]); setNextId((n) => n + 1); }}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar linha
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4 pt-2 border-t">
            <div>
              <Label className="text-xs">Multiplicar por (opcional)</Label>
              <Input
                inputMode="decimal"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
                className="w-28"
                placeholder="1"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calculator className="w-4 h-4" />
                    Total {isFinite(multNum) && multNum !== 1 && multNum !== 0 ? `× ${multiplicador}` : ''}
                  </span>
                  <span className="font-mono text-xl font-bold">{minToHHMM(totalComMult)}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right mt-1">
                  {hhmmToDecimal(minToHHMM(totalComMult) || '0:0')} h decimal
                </div>
              </div>
            </div>
          </div>

          {invalidas.length > 0 && (
            <p className="text-xs text-destructive">
              Verifique os campos destacados: use o formato 07:30 (minutos até 59) ou decimal (ex.: 7,5).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
