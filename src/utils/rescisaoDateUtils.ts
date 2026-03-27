import { addDays, isWeekend, isSunday, format } from 'date-fns';

/**
 * Art. 477, §6º CLT — prazo de 10 dias corridos a partir da rescisão.
 * Se cair em sábado, domingo ou feriado, antecipa para o último dia útil anterior.
 */
export function calcularDataPagamentoSugerida(
  dataRescisao: Date,
  feriadosDatas?: string[]
): Date {
  const prazoLegal = 10;
  let sugerida = addDays(dataRescisao, prazoLegal);

  // Se cai em dia não útil, volta para o dia útil anterior
  while (isNaoUtil(sugerida, feriadosDatas)) {
    sugerida = addDays(sugerida, -1);
  }

  return sugerida;
}

function isNaoUtil(date: Date, feriadosDatas?: string[]): boolean {
  if (isSunday(date)) return true;
  if (feriadosDatas) {
    const ds = format(date, 'yyyy-MM-dd');
    if (feriadosDatas.includes(ds)) return true;
  }
  return false;
}

export function formatCompetencia(date: Date): string {
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${m}/${date.getFullYear()}`;
}
