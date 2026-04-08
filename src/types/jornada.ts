export type SlotCount = 2 | 4 | 6;

export interface JornadaDiaConfig {
  dia: string; // 'Seg', 'Ter', etc.
  ativo: boolean;
  marcacoes: string[]; // hh:mm slots
}

export interface JornadaParams {
  empresaNome: string;
  empresaCnpj: string;
  colaboradorNome: string;
  colaboradorFuncao: string;
  cargaSemanalContratada: string; // hh:mm
  slots: SlotCount;
  intervaloMinimo4a6h: string; // hh:mm (15 min default)
  intervaloMinimoAcima6h: string; // hh:mm (1h default)
  interjornadaMinima: string; // hh:mm (11h default)
  noturnoHabilitado: boolean;
  noturnoInicio: string; // hh:mm
  noturnoFim: string; // hh:mm
  toleranciaMinutos: number;
  periodoInicio: string; // yyyy-MM-dd
  periodoFim: string; // yyyy-MM-dd
}

export interface JornadaDiaResultado {
  dia: string;
  ativo: boolean;
  marcacoes: string[];
  totalTrabalhadoMin: number;
  totalIntervaloMin: number;
  noturnoRealMin: number;
  noturnoConvertidoMin: number;
  alertas: string[];
}

export interface JornadaAnalise {
  dias: JornadaDiaResultado[];
  totalSemanalMin: number;
  cargaContratadaMin: number;
  saldoMin: number;
  statusGeral: 'ok' | 'atencao' | 'critico';
  apontamentos: string[];
}

export function createDefaultParams(): JornadaParams {
  return {
    empresaNome: '',
    empresaCnpj: '',
    colaboradorNome: '',
    colaboradorFuncao: '',
    cargaSemanalContratada: '44:00',
    slots: 4,
    intervaloMinimo4a6h: '00:15',
    intervaloMinimoAcima6h: '01:00',
    interjornadaMinima: '11:00',
    noturnoHabilitado: false,
    noturnoInicio: '22:00',
    noturnoFim: '05:00',
    toleranciaMinutos: 10,
    periodoInicio: '',
    periodoFim: '',
  };
}

export function createDefaultDias(slots: SlotCount): JornadaDiaConfig[] {
  const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return nomes.map((dia, i) => ({
    dia,
    ativo: i < 5, // Seg-Sex active
    marcacoes: Array(slots).fill(''),
  }));
}
