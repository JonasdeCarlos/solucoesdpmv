import React, { useRef, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import TimeInput from './TimeInput';
import { type PontoDia, type PontoDiaCalculado, type PontoConfig, type TipoDia } from '@/types/ponto';
import { minutesToHHMM } from '@/utils/pontoCalculations';
import { Input } from '@/components/ui/input';

const MARCACAO_LABELS_4 = ['Entrada', 'Saída Int.', 'Entrada Int.', 'Saída'];
const MARCACAO_LABELS_6 = ['Entrada', 'Saída Int.1', 'Ent. Int.1', 'Saída Int.2', 'Ent. Int.2', 'Saída'];

const TIPO_DIA_OPTIONS: { value: TipoDia; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'folga_dsr', label: 'Folga/DSR' },
  { value: 'folga_comp_feriado', label: 'Folga Comp. Feriado' },
  { value: 'falta', label: 'Falta' },
  { value: 'afastamento', label: 'Afastamento' },
];

interface Props {
  dias: PontoDia[];
  diasCalculados: PontoDiaCalculado[];
  config: PontoConfig;
  onDiaChange: (index: number, dia: PontoDia) => void;
}

const PontoGrid: React.FC<Props> = ({ dias, diasCalculados, config, onDiaChange }) => {
  const inputRefs = useRef<Map<string, HTMLElement>>(new Map());
  const labels = config.colunasMarcacoes === 6 ? MARCACAO_LABELS_6 : MARCACAO_LABELS_4;

  const getRefKey = (diaIdx: number, markIdx: number) => `${diaIdx}-${markIdx}`;

  const handleMarkChange = useCallback((diaIdx: number, markIdx: number, val: string) => {
    const dia = dias[diaIdx];
    const newMarks = [...dia.marcacoes];
    newMarks[markIdx] = val;
    onDiaChange(diaIdx, { ...dia, marcacoes: newMarks });
  }, [dias, onDiaChange]);

  const handleComplete = useCallback((diaIdx: number, markIdx: number) => {
    // Try next mark in same day
    const nextMark = markIdx + 1;
    if (nextMark < config.colunasMarcacoes) {
      const key = getRefKey(diaIdx, nextMark);
      const el = inputRefs.current.get(key);
      if (el) {
        const input = el.querySelector('input') || el;
        (input as HTMLElement).focus();
        return;
      }
    }
    // Try first mark of next day
    const nextDay = diaIdx + 1;
    if (nextDay < dias.length) {
      const key = getRefKey(nextDay, 0);
      const el = inputRefs.current.get(key);
      if (el) {
        const input = el.querySelector('input') || el;
        (input as HTMLElement).focus();
      }
    }
  }, [config.colunasMarcacoes, dias.length]);

  const saldoClass = (mins: number) => {
    if (mins > 0) return 'text-green-700 dark:text-green-400';
    if (mins < 0) return 'text-red-700 dark:text-red-400';
    return '';
  };

  const isWeekend = (dia: PontoDia) => dia.diaSemana === 'Dom' || dia.diaSemana === 'Sáb';

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60 border-b">
            <th className="px-2 py-2 text-left font-medium w-10">Dia</th>
            <th className="px-1 py-2 text-left font-medium w-10">DS</th>
            <th className="px-1 py-2 text-left font-medium w-24">Tipo</th>
            {labels.map((l, i) => (
              <th key={i} className="px-1 py-2 text-center font-medium">{l}</th>
            ))}
            <th className="px-1 py-2 text-center font-medium w-[70px]">A cumprir</th>
            <th className="px-1 py-2 text-center font-medium">Trab.</th>
            <th className="px-1 py-2 text-center font-medium text-green-700 dark:text-green-400">Extra</th>
            <th className="px-1 py-2 text-center font-medium text-red-700 dark:text-red-400">Débito</th>
            <th className="px-1 py-2 text-center font-medium text-yellow-700 dark:text-yellow-400">Feriado</th>
            <th className="px-1 py-2 text-center font-medium text-blue-700 dark:text-blue-400">Folga</th>
            <th className="px-1 py-2 text-center font-medium">Not.R</th>
            <th className="px-1 py-2 text-center font-medium">Not.C</th>
            <th className="px-1 py-2 text-center font-medium text-orange-700 dark:text-orange-400">Int.Dev</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((dia, idx) => {
            const calc = diasCalculados[idx];
            const rowBg = isWeekend(dia)
              ? 'bg-muted/30'
              : dia.tipoDia === 'feriado'
              ? 'bg-yellow-50 dark:bg-yellow-900/10'
              : '';

            return (
              <tr key={dia.dia} className={`border-b hover:bg-muted/20 ${rowBg}`}>
                <td className="px-2 py-1 font-medium">{String(dia.dia).padStart(2, '0')}</td>
                <td className="px-1 py-1 text-muted-foreground">{dia.diaSemana}</td>
                <td className="px-1 py-1">
                  <Select
                    value={dia.tipoDia}
                    onValueChange={(v) => onDiaChange(idx, { ...dia, tipoDia: v as TipoDia })}
                  >
                    <SelectTrigger className="h-7 text-xs px-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_DIA_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                {dia.marcacoes.map((mark, mIdx) => (
                  <td key={mIdx} className="px-0.5 py-1">
                    <div ref={el => {
                      if (el) inputRefs.current.set(getRefKey(idx, mIdx), el);
                    }}>
                      <TimeInput
                        value={mark}
                        onChange={(v) => handleMarkChange(idx, mIdx, v)}
                        onComplete={() => handleComplete(idx, mIdx)}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-0.5 py-1">
                  <Input
                    value={dia.horasACumprir}
                    onChange={(e) => onDiaChange(idx, { ...dia, horasACumprir: e.target.value })}
                    className="w-[70px] text-center font-mono text-xs px-1 h-8"
                  />
                </td>
                <td className="px-1 py-1 text-center font-mono">
                  {minutesToHHMM(calc?.trabalhoLiquido ?? 0)}
                </td>
                <td className="px-1 py-1 text-center font-mono text-green-700 dark:text-green-400">
                  {calc && calc.saldoMinutos > 0 && dia.tipoDia === 'normal' ? minutesToHHMM(calc.saldoMinutos) : ''}
                  {calc && config.tolerancia10min && calc.saldoMinutos !== calc.saldoAntesTolerancia && calc.saldoAntesTolerancia > 0 && dia.tipoDia === 'normal' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground ml-0.5 cursor-help">*</span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Antes da tolerância: {minutesToHHMM(calc.saldoAntesTolerancia)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
                <td className="px-1 py-1 text-center font-mono text-red-700 dark:text-red-400">
                  {calc && calc.saldoMinutos < 0 && dia.tipoDia === 'normal' ? minutesToHHMM(calc.saldoMinutos) : ''}
                  {calc && config.tolerancia10min && calc.saldoMinutos !== calc.saldoAntesTolerancia && calc.saldoAntesTolerancia < 0 && dia.tipoDia === 'normal' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground ml-0.5 cursor-help">*</span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Antes da tolerância: {minutesToHHMM(calc.saldoAntesTolerancia)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
                <td className="px-1 py-1 text-center font-mono text-yellow-700 dark:text-yellow-400">
                  {calc && dia.tipoDia === 'feriado' && calc.trabalhoLiquido > 0 ? minutesToHHMM(calc.trabalhoLiquido) : ''}
                </td>
                <td className="px-1 py-1 text-center font-mono text-blue-700 dark:text-blue-400">
                  {calc && dia.tipoDia === 'folga_dsr' && calc.trabalhoLiquido > 0 ? minutesToHHMM(calc.trabalhoLiquido) : ''}
                </td>
                <td className="px-1 py-1 text-center font-mono text-muted-foreground">
                  {calc && calc.noturnoReal > 0 ? minutesToHHMM(calc.noturnoReal) : ''}
                </td>
                <td className="px-1 py-1 text-center font-mono text-muted-foreground">
                  {calc && calc.noturnoConvertido > 0 ? minutesToHHMM(calc.noturnoConvertido) : ''}
                </td>
                <td className="px-1 py-1 text-center font-mono text-orange-700 dark:text-orange-400">
                  {calc && calc.intervaloDevido > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center justify-center gap-0.5 cursor-help">
                          {minutesToHHMM(calc.intervaloDevido)}
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Intervalo intrajornada inferior ao mínimo
                      </TooltipContent>
                    </Tooltip>
                  ) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PontoGrid;
