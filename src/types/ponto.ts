export type TipoDia = 'normal' | 'feriado' | 'folga_dsr' | 'folga_comp_feriado' | 'falta' | 'afastamento';

export type DiaSemanaKey = 'Dom' | 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex' | 'Sáb';

export interface JornadaSemanal {
  Dom: string;
  Seg: string;
  Ter: string;
  Qua: string;
  Qui: string;
  Sex: string;
  Sáb: string;
}

export interface PontoConfig {
  jornadaDiaria: string; // hh:mm (fallback)
  jornadaSemanal: JornadaSemanal;
  tolerancia10min: boolean;
  intervaloMinimo: string; // hh:mm
  colunasMarcacoes: 4 | 6;
  noturnoInicio: string; // hh:mm
  noturnoFim: string; // hh:mm
}

export interface PontoDia {
  dia: number;
  diaSemana: string;
  tipoDia: TipoDia;
  marcacoes: string[]; // array of "hh:mm" or ""
  horasACumprir: string; // hh:mm
  observacao: string;
}

export interface PontoDiaCalculado extends PontoDia {
  trabalhoBruto: number; // minutes
  intervalos: number; // minutes
  trabalhoLiquido: number; // minutes
  saldoMinutos: number;
  saldoAntesTolerancia: number;
  noturnoReal: number; // minutes
  noturnoConvertido: number; // minutes
  alertaIntervalo: boolean;
  intervaloDevido: number; // minutes owed (difference when interval < minimum)
}

export interface PontoIdentificacao {
  empresaNome: string;
  empresaDoc: string;
  empresaEndereco: string;
  empregadoNome: string;
  empregadoCpf: string;
  empregadoFuncao: string;
  mesAno: string; // yyyy-MM
}

export interface PontoState {
  identificacao: PontoIdentificacao;
  config: PontoConfig;
  dias: PontoDia[];
}

export function createDefaultJornadaSemanal(jornada: string = '08:00'): JornadaSemanal {
  return {
    Dom: '00:00',
    Seg: jornada,
    Ter: jornada,
    Qua: jornada,
    Qui: jornada,
    Sex: jornada,
    Sáb: '00:00',
  };
}

export function createDefaultConfig(): PontoConfig {
  return {
    jornadaDiaria: '08:00',
    jornadaSemanal: createDefaultJornadaSemanal('08:00'),
    tolerancia10min: true,
    intervaloMinimo: '01:00',
    colunasMarcacoes: 4,
    noturnoInicio: '22:00',
    noturnoFim: '05:00',
  };
}

export function createDefaultIdentificacao(): PontoIdentificacao {
  return {
    empresaNome: '',
    empresaDoc: '',
    empresaEndereco: '',
    empregadoNome: '',
    empregadoCpf: '',
    empregadoFuncao: '',
    mesAno: new Date().toISOString().slice(0, 7),
  };
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function gerarDiasMes(mesAno: string, config: PontoConfig): PontoDia[] {
  const [year, month] = mesAno.split('-').map(Number);
  const totalDias = new Date(year, month, 0).getDate();
  const dias: PontoDia[] = [];

  for (let d = 1; d <= totalDias; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();

    const diaSemana = DIAS_SEMANA[dow] as DiaSemanaKey;
    const horasACumprir = config.jornadaSemanal
      ? config.jornadaSemanal[diaSemana]
      : (dow === 0 ? '00:00' : config.jornadaDiaria);

    const semJornada = horasACumprir === '00:00' || horasACumprir === '';

    dias.push({
      dia: d,
      diaSemana,
      tipoDia: semJornada ? 'folga_dsr' : 'normal',
      marcacoes: Array(config.colunasMarcacoes).fill(''),
      horasACumprir,
      observacao: '',
    });
  }

  return dias;
}
