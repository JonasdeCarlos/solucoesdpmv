export type TipoLancamento = 'valor_fixo' | 'qtd_x_valor';
export type RegraDsr = 'padrao' | 'custom';
export type EscopoFeriado = 'nacional' | 'estadual' | 'municipal' | 'interno';

export interface VerbaDsr {
  id: string;
  codigo: string;
  nome: string;
  tipoLancamento: TipoLancamento;
  incideDsr: boolean;
  regraDsr: RegraDsr;
  regraDsrCustom?: string | null;
  consideraDomingoDsr: boolean;
  consideraFeriadoDsr: boolean;
  observacoes: string;
}

export interface FeriadoExtendido {
  id: string;
  data: string;            // YYYY-MM-DD
  nome: string;
  municipio: string;
  uf: string;
  escopo: EscopoFeriado;
  contaDiaNaoUtil: boolean;
  contaDsr: boolean;
}

export interface FeriadoNacionalOverride {
  id: string;
  ano: number;
  chave: string;            // ex: "confraternizacao", "tiradentes", "pascoa"
  pontoFacultativo: boolean;
}

export interface ProvisionEntry {
  id: string;
  empresaNome: string;
  competencia: string;       // YYYY-MM
  centroCusto: string;
  colaborador: string;
  verbaId: string;
  tipoLancamento: TipoLancamento;
  valor: number;
  quantidade: number;
  valorUnitario: number;
  observacao: string;
}

export interface DsrVerbaDetalhe {
  verbaId: string;
  codigo: string;
  nome: string;
  base: number;
  diasUteis: number;
  diasDsr: number;
  dsr: number;
  total: number;
  formula: string;
}

export interface DsrMonthlyResult {
  id?: string;
  empresaNome: string;
  competencia: string;
  diasUteis: number;
  diasDsr: number;
  domingos: number;
  feriadosNaoUteis: number;
  detalheVerbas: DsrVerbaDetalhe[];
  totalBase: number;
  totalDsr: number;
  geradoEm?: string;
}