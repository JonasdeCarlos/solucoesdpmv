export type TipoCalculo = 'manual' | 'dias' | 'horas' | 'hora_extra' | 'adicional_noturno';

export const TIPO_CALCULO_LABELS: Record<TipoCalculo, string> = {
  manual: 'Manual',
  dias: 'Por dias',
  horas: 'Por horas',
  hora_extra: 'Hora extra',
  adicional_noturno: 'Adicional noturno',
};

export interface Verba {
  id: string;
  nome: string;
  tipoCalculo: TipoCalculo;
  referenciaPadrao: string;
  padraoPD: 'P' | 'D';
  incideFGTS: boolean;
  calculaDSR: boolean;
}

export function createEmptyVerba(): Verba {
  return {
    id: crypto.randomUUID(),
    nome: '',
    tipoCalculo: 'manual',
    referenciaPadrao: '',
    padraoPD: 'P',
    incideFGTS: true,
    calculaDSR: false,
  };
}
