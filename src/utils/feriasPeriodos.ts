import { addDays, addMonths, addYears, differenceInCalendarDays, differenceInYears } from 'date-fns';
import { formatDate } from '@/utils/formatters';
import type { Step1Data } from '@/utils/calculations';

/** Data final projetada (desligamento + aviso indenizado + 3 dias/ano, máx. 60). */
export function dataProjetada(step1: Step1Data): Date | null {
  const { dataAdmissao: adm, dataDesligamento: desl } = step1;
  if (!adm || !desl) return null;
  if (!step1.calculaAvisoPrevioIndenizado) return desl;
  const anos = Math.max(0, differenceInYears(desl, adm));
  const dias = (step1.diasAvisoPrevioIndenizado || 0) + Math.min(anos * 3, 60);
  return addDays(desl, dias);
}

/** Linhas detalhando os períodos aquisitivos de férias (vencidas e proporcionais mês a mês). */
export function detalharPeriodosFerias(step1: Step1Data): { vencidas: string[]; proporcionais: string[] } {
  const adm = step1.dataAdmissao;
  const desl = step1.dataDesligamento;
  const fim = dataProjetada(step1);
  if (!adm || !desl || !fim) return { vencidas: [], proporcionais: [] };

  // Início do período aquisitivo em curso (último aniversário de admissão ≤ desligamento)
  let anos = Math.max(0, differenceInYears(desl, adm));
  let inicio = addYears(adm, anos);
  if (inicio > desl) { anos--; inicio = addYears(adm, anos); }

  const vencidas: string[] = [];
  if (step1.temFeriasVencidas && step1.periodosVencidos > 0) {
    for (let i = step1.periodosVencidos; i >= 1; i--) {
      const ini = addYears(inicio, -i);
      if (ini < adm) continue;
      const f = addDays(addYears(ini, 1), -1);
      vencidas.push(`${formatDate(ini)} a ${formatDate(f)} - 12/12`);
    }
  }

  const proporcionais: string[] = [];
  for (let k = 0; k < 24; k++) {
    const ini = addMonths(inicio, k);
    if (ini > fim) break;
    const fimMes = addDays(addMonths(inicio, k + 1), -1);
    const projecao = ini > desl || fimMes > desl;
    if (fimMes <= fim) {
      proporcionais.push(`${formatDate(ini)} a ${formatDate(fimMes)} - 1/12${projecao ? ' (indenizado - projeção do aviso)' : ''}`);
    } else {
      const dias = differenceInCalendarDays(fim, ini) + 1;
      const avo = dias >= 15 ? '1/12' : '0/12';
      const txt = dias >= 15 ? `${dias} dias ≥ 15` : `${dias} dias < 15, não gera avo`;
      proporcionais.push(
        `${formatDate(ini)} a ${formatDate(fim)} - ${projecao ? 'indenizado de ' : ''}${avo}${projecao ? ' considerando projeção' : ''} (${txt})`,
      );
    }
  }
  return { vencidas, proporcionais };
}
