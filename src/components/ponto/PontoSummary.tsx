import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type PontoResumo } from '@/utils/pontoCalculations';
import { minutesToHHMM } from '@/utils/pontoCalculations';

interface Props {
  resumo: PontoResumo;
}

const PontoSummary: React.FC<Props> = ({ resumo }) => {
  const items = [
    { label: 'Total Trabalhado', value: minutesToHHMM(resumo.totalTrabalhado) },
    { label: 'Total a Cumprir', value: minutesToHHMM(resumo.totalACumprir) },
    { label: 'Saldo Positivo', value: minutesToHHMM(resumo.totalSaldoPositivo), className: 'text-green-700 dark:text-green-400' },
    { label: 'Saldo Negativo', value: minutesToHHMM(resumo.totalSaldoNegativo), className: 'text-red-700 dark:text-red-400' },
    { label: 'Saldo Final', value: minutesToHHMM(resumo.saldoFinal), className: resumo.saldoFinal >= 0 ? 'text-green-700 dark:text-green-400 font-bold' : 'text-red-700 dark:text-red-400 font-bold' },
    { label: 'Horas em Feriados', value: minutesToHHMM(resumo.totalFeriados) },
    { label: 'Horas em Folgas/DSR', value: minutesToHHMM(resumo.totalFolgasDsr) },
    { label: 'Noturno (real)', value: minutesToHHMM(resumo.totalNoturnoReal) },
    { label: 'Noturno (convertido)', value: minutesToHHMM(resumo.totalNoturnoConvertido) },
    { label: 'Int. Devido', value: minutesToHHMM(resumo.totalIntervaloDevido), className: resumo.totalIntervaloDevido > 0 ? 'text-orange-700 dark:text-orange-400' : '' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumo do Período</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map(item => (
            <div key={item.label} className="text-center p-2 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-lg font-mono font-semibold ${item.className || ''}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PontoSummary;
