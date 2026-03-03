export type CategoriaObra = 'obra_nova' | 'reforma' | 'demolicao' | 'ampliacao';
export type TipoObra = 'residencial_unifamiliar' | 'residencial_multifamiliar' | 'comercial' | 'galpao_industrial' | 'projeto_social' | 'casa_popular';
export type TecnicaConstrutiva = 'alvenaria' | 'madeira' | 'mista';
export type TipoDeducao = 'concreto_usinado' | 'argamassa_usinada' | 'massa_asfaltica';

export const TIPO_OBRA_LABELS: Record<TipoObra, string> = {
  residencial_unifamiliar: 'Residencial Unifamiliar',
  residencial_multifamiliar: 'Residencial Multifamiliar',
  comercial: 'Comercial - Salas e Lojas',
  galpao_industrial: 'Galpão Industrial',
  projeto_social: 'Projeto de Interesse Social',
  casa_popular: 'Casa Popular',
};

export const CATEGORIA_LABELS: Record<CategoriaObra, string> = {
  obra_nova: 'Obra Nova',
  reforma: 'Reforma',
  demolicao: 'Demolição',
  ampliacao: 'Ampliação',
};

export const TECNICA_LABELS: Record<TecnicaConstrutiva, string> = {
  alvenaria: 'Alvenaria',
  madeira: 'Madeira',
  mista: 'Mista',
};

export const DEDUCAO_LABELS: Record<TipoDeducao, string> = {
  concreto_usinado: 'Concreto Usinado',
  argamassa_usinada: 'Argamassa Usinada',
  massa_asfaltica: 'Massa Asfáltica',
};

export const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
] as const;

export interface SeroObra {
  id?: string;
  cno: string;
  responsavel_tipo: 'PF' | 'PJ';
  responsavel_nome: string;
  responsavel_doc: string;
  uf: string;
  municipio: string;
  endereco: string;
  data_inicio: string;
  data_termino: string;
  data_termino_previsto: string;
  categoria: CategoriaObra;
  tipo_obra: TipoObra;
  area_principal: number;
  area_complementar: number;
  tecnica_construtiva: TecnicaConstrutiva;
  contabilidade_regular: boolean;
  folha_vinculada_id?: string;
  rateio_tipo: 'percentual' | 'm2' | 'receita';
  rateio_valor: number;
  folha_total_projetada: number;
  encargos_projetados: number;
  observacoes_analista: string;
  status: string;
}

export interface SeroVauVal {
  id: string;
  uf: string;
  tipo_obra: string;
  valor_m2: number;
  percentual_concreto: number;
  competencia_inicio: string;
  competencia_fim: string;
  fonte: string;
}

export interface SeroParametro {
  id: string;
  chave: string;
  valor: number;
  descricao: string;
  vigencia_inicio: string;
  vigencia_fim: string;
}

export interface SeroDeducao {
  id?: string;
  obra_id: string;
  tipo: TipoDeducao;
  valor: number;
  competencia: string;
  nf_numero: string;
  nf_path?: string;
}

export interface SeroRetencao {
  id?: string;
  obra_id: string;
  cnpj_fornecedor: string;
  fornecedor_nome: string;
  valor_bruto: number;
  competencia: string;
  retencao_valor: number;
  aliquota_retencao: number;
  nf_path?: string;
}

export interface SeroResultado {
  custoTotalObra: number;
  remuneracaoMO: number;
  deducoesTotal: number;
  remuneracaoLiquida: number;
  inssPatronal: number;
  inssRat: number;
  inssTerceiros: number;
  inssDevido: number;
  inssFolha: number;
  inssRetencoes: number;
  inssCoberto: number;
  saldoFinal: number;
  inssM2: number;
  areaTotal: number;
}

export function createDefaultObra(): SeroObra {
  return {
    cno: '',
    responsavel_tipo: 'PF',
    responsavel_nome: '',
    responsavel_doc: '',
    uf: 'MG',
    municipio: 'Camanducaia',
    endereco: '',
    data_inicio: '',
    data_termino: '',
    data_termino_previsto: '',
    categoria: 'obra_nova',
    tipo_obra: 'residencial_unifamiliar',
    area_principal: 0,
    area_complementar: 0,
    tecnica_construtiva: 'alvenaria',
    contabilidade_regular: false,
    rateio_tipo: 'percentual',
    rateio_valor: 100,
    folha_total_projetada: 0,
    encargos_projetados: 0,
    observacoes_analista: '',
    status: 'rascunho',
  };
}
