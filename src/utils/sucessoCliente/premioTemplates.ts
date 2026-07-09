// Templates pré-configurados de políticas de prêmio.

export type HotelariaFaixa = { nivel: 'piso' | 'meta_0' | 'meta_1' | 'meta_2'; pct: number; alvo: number | null };
export type HotelariaCriterio = {
  id: string;
  nome: string;
  peso_pct: number; // % sobre faturamento (base do critério)
  metrica: 'faturamento_direto' | 'nota_media' | 'pct_avaliacoes';
  canal?: string | null;
  faixas: HotelariaFaixa[];
};

export type HotelariaConfig = {
  split_coletivo: number; // ex.: 80
  split_individual: number; // ex.: 20
  criterios: HotelariaCriterio[];
  escala: Array<{ label: string; valor: number }>;
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