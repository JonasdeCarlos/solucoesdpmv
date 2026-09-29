// Templates pré-configurados de políticas de prêmio.

export type HotelariaFaixa = { nivel: 'piso' | 'meta_0' | 'meta_1' | 'meta_2'; pct: number; alvo: number | null };
export type HotelariaCriterio = {
  id: string;
  nome: string;
  peso_pct: number; // % sobre faturamento (base do critério)
  metrica: 'faturamento_direto' | 'nota_media' | 'pct_avaliacoes' | 'realizado_meta' | 'realizado_meta_inverso' | 'percentual' | 'nota_generica' | 'sim_nao';
  unidade?: string | null;
  escala_max?: number | null;
  descricao?: string | null;
  canal?: string | null;
  faixas: HotelariaFaixa[];
};

export type HotelariaConfig = {
  split_coletivo: number; // ex.: 80
  split_individual: number; // ex.: 20
  criterios: HotelariaCriterio[];
  escala: Array<{ label: string; valor: number }>;
  // % do pool individual efetivamente distribuído como prêmio máximo
  // (ex.: pool = faturamento * split_individual%; teto = pool * individual_pct_distribuicao%)
  individual_pct_distribuicao?: number;
  base_label?: string;
  rateio?: 'pontos' | 'igualitario';
  // Metas por competência (chave "YYYY-MM"). Usadas para assinar a política do mês.
  metas_mensais?: Record<string, MetaMensal>;
};

export type MetaMensal = {
  meta_0: number;
  meta_1: number;
  meta_2: number;
  faturamento_previsto?: number;
  observacoes?: string;
  vigencia_inicio?: string; // YYYY-MM-DD
  vigencia_fim?: string;    // YYYY-MM-DD
};

export const HOTELARIA_CONFIG: HotelariaConfig = {
  split_coletivo: 80,
  split_individual: 20,
  criterios: [
    {
      id: 'faturamento',
      nome: 'Faturamento Direto',
      peso_pct: 40,
      metrica: 'faturamento_direto',
      canal: null,
      faixas: [
        { nivel: 'piso',   pct: 1.0, alvo: null },
        { nivel: 'meta_0', pct: 1.5, alvo: 0 },
        { nivel: 'meta_1', pct: 2.0, alvo: 0 },
        { nivel: 'meta_2', pct: 2.5, alvo: 0 },
      ],
    },
    {
      id: 'booking', nome: 'Notas Booking', peso_pct: 10, metrica: 'nota_media', canal: 'booking',
      faixas: [
        { nivel: 'piso', pct: 1.0, alvo: null },
        { nivel: 'meta_0', pct: 1.5, alvo: 9.1 },
        { nivel: 'meta_1', pct: 2.0, alvo: 9.2 },
        { nivel: 'meta_2', pct: 2.5, alvo: 9.3 },
      ],
    },
    {
      id: 'google', nome: 'Notas Google', peso_pct: 10, metrica: 'nota_media', canal: 'google',
      faixas: [
        { nivel: 'piso', pct: 1.0, alvo: null },
        { nivel: 'meta_0', pct: 1.5, alvo: 4.7 },
        { nivel: 'meta_1', pct: 2.0, alvo: 4.8 },
        { nivel: 'meta_2', pct: 2.5, alvo: 4.9 },
      ],
    },
    {
      id: 'tripadvisor', nome: 'Notas TripAdvisor', peso_pct: 10, metrica: 'nota_media', canal: 'tripadvisor',
      faixas: [
        { nivel: 'piso', pct: 1.0, alvo: null },
        { nivel: 'meta_0', pct: 1.5, alvo: 4.7 },
        { nivel: 'meta_1', pct: 2.0, alvo: 4.8 },
        { nivel: 'meta_2', pct: 2.5, alvo: 4.9 },
      ],
    },
    {
      id: 'qtd_avaliacoes', nome: 'Quantidade de Avaliações', peso_pct: 10, metrica: 'pct_avaliacoes', canal: null,
      faixas: [
        { nivel: 'piso', pct: 1.0, alvo: null },
        { nivel: 'meta_0', pct: 1.5, alvo: 60 },
        { nivel: 'meta_1', pct: 2.0, alvo: 70 },
        { nivel: 'meta_2', pct: 2.5, alvo: 80 },
      ],
    },
  ],
  escala: [
    { label: 'Excelente', valor: 100 },
    { label: 'Muito Bom', valor: 75 },
    { label: 'Bom', valor: 50 },
    { label: 'Regular', valor: 25 },
    { label: 'Insatisfatório', valor: 0 },
  ],
  individual_pct_distribuicao: 1,
};

export const HOTELARIA_CRITERIOS_INDIVIDUAIS = [
  {
    nome: 'Postura e Atendimento',
    peso: 5,
    descricao:
      'Peso 5% (dos 20% individuais). Avalia cordialidade, simpatia, postura profissional em situações de pressão, resolução voltada à experiência do hóspede, clareza e respeito na comunicação, interesse genuíno em ajudar, discrição, trabalho em equipe, receptividade a críticas e ausência de reclamações recorrentes.',
  },
  {
    nome: 'Eficiência no Trabalho',
    peso: 5,
    descricao:
      'Peso 5%. Avalia organização, produtividade e qualidade da execução dos processos da Central de Reservas: cadastros corretos, reservas sem erros, alterações e cancelamentos conforme política, cobranças, sistema atualizado, registros completos, cumprimento de fluxos, agilidade, baixa incidência de erros e autonomia.',
  },
  {
    nome: 'Pontualidade e Cumprimento da Escala',
    peso: 5,
    descricao:
      'Peso 5%. Avalia comprometimento com horários e responsabilidade operacional: início pontual, jornada integral, ausência de atrasos recorrentes, sem faltas injustificadas, cumprimento da escala, organização em trocas de turno, comunicação prévia de ausências, pontualidade em reuniões e treinamentos, cumprimento de prazos e ausência de impacto operacional.',
  },
  {
    nome: 'Gestão Comercial e Contribuição para os Resultados',
    peso: 5,
    descricao:
      'Peso 5%. Avalia comprometimento com os resultados comerciais: gestão dos indicadores atualizada, reportes corretos e no prazo, senso de urgência em oportunidades, conversão de orçamentos, follow-up de cotações, upsell/cross-sell, iniciativa para recuperar vendas, identificação de melhorias, cumprimento de planos de ação e comprometimento com metas.',
  },
];

export const HOTELARIA_ESCALA_TEXTO =
  'Escala de pontuação por critério individual: 100% Excelente (sempre demonstra) • 75% Muito Bom (quase sempre) • 50% Bom (na maior parte das vezes) • 25% Regular (ocasionalmente) • 0% Insatisfatório (raramente/nunca).';
export const isModeloHotelaria = (p: any) =>
  p?.modelo_template === 'hotelaria' || p?.modelo_template === 'personalizado';
export const isModeloPersonalizado = (p: any) => p?.modelo_template === 'personalizado';

export const METRICAS_GENERICAS = ['realizado_meta', 'realizado_meta_inverso', 'percentual', 'nota_generica', 'sim_nao'] as const;
export const METRICA_LABEL: Record<string, string> = {
  faturamento_direto: 'Faturamento (Meta 0/1/2)',
  nota_media: 'Nota média do canal',
  pct_avaliacoes: '% de avaliações / reservas',
  realizado_meta: 'Realizado x meta (maior é melhor)',
  realizado_meta_inverso: 'Realizado x meta (menor é melhor)',
  percentual: 'Percentual atingido (%)',
  nota_generica: 'Nota média',
  sim_nao: 'Sim / Não',
};

/** Enquadra o realizado de um indicador genérico na faixa atingida. */
export function faixaGenerica(c: HotelariaCriterio, realizado: number): HotelariaFaixa {
  const piso = c.faixas.find(f => f.nivel === 'piso') || c.faixas[0];
  const niveis = c.faixas.filter(f => f.nivel !== 'piso');
  const v = Number(realizado || 0);
  if (c.metrica === 'sim_nao') {
    const top = niveis.find(f => f.nivel === 'meta_2') || niveis[niveis.length - 1] || piso;
    return v >= 1 ? top : piso;
  }
  const order: HotelariaFaixa['nivel'][] = ['meta_2', 'meta_1', 'meta_0'];
  for (const n of order) {
    const f = niveis.find(x => x.nivel === n);
    if (!f || f.alvo === null || f.alvo === undefined) continue;
    if (c.metrica === 'realizado_meta_inverso' ? v <= f.alvo : v >= f.alvo) return f;
  }
  return piso;
}
