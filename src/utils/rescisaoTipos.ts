export type RescisaoTipoId =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'justa_causa'
  | 'acordo_484a'
  | 'termino_prazo'
  | 'rescisao_indireta';

export interface RescisaoDocLinha {
  documento: string;
  empregado: string;
  empregador: string;
  observacoes?: string;
}

export interface RescisaoTipoConfig {
  id: RescisaoTipoId;
  label: string;
  documentos: RescisaoDocLinha[];
}

/** Documentos comuns a TODAS as rescisões (padrão final) */
export const DOCUMENTOS_COMUNS: RescisaoDocLinha[] = [
  { documento: 'TRCT/TQRCT', empregado: 'Conforme tipo', empregador: '2 vias', observacoes: 'Documento principal' },
  { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
  { documento: 'Folha de Ponto do mês (se houver)', empregado: '1 via', empregador: '1 via', observacoes: 'Fundamental para conferência' },
  { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via', observacoes: 'Quando aplicável' },
  { documento: 'Chave FGTS', empregado: '1 via', empregador: '1 via', observacoes: 'Quando houver saque' },
  { documento: 'Seguro-Desemprego', empregado: '1 via', empregador: '1 via', observacoes: 'Quando aplicável' },
];

export const RESCISAO_TIPOS: RescisaoTipoConfig[] = [
  {
    id: 'sem_justa_causa',
    label: 'Rescisão sem Justa Causa',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '3 vias', empregador: '2 vias', observacoes: 'Pode haver retenção na CEF ou MTE' },
      { documento: 'Aviso Prévio', empregado: '1 via', empregador: '1 via' },
      { documento: 'Guia FGTS (GRRF)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Chave FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Seguro-Desemprego', empregado: '1 via', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
  {
    id: 'pedido_demissao',
    label: 'Pedido de Demissão',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '1 via', empregador: '2 vias' },
      { documento: 'Pedido de Demissão', empregado: '—', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
  {
    id: 'justa_causa',
    label: 'Justa Causa',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '1 via', empregador: '2 vias' },
      { documento: 'Comunicação de Justa Causa', empregado: '1 via', empregador: '1 via' },
      { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
  {
    id: 'acordo_484a',
    label: 'Rescisão por Acordo (Art. 484-A CLT)',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '3 vias', empregador: '2 vias' },
      { documento: 'Termo de Acordo', empregado: '1 via', empregador: '1 via' },
      { documento: 'Guia FGTS (20%)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Chave FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
  {
    id: 'termino_prazo',
    label: 'Término de Contrato (Prazo Determinado)',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '3 vias', empregador: '2 vias', observacoes: 'Há saque FGTS' },
      { documento: 'Contrato de Trabalho', empregado: '1 via', empregador: '1 via' },
      { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Chave FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
  {
    id: 'rescisao_indireta',
    label: 'Rescisão Indireta',
    documentos: [
      { documento: 'TRCT/TQRCT', empregado: '3 vias', empregador: '2 vias', observacoes: 'Equiparada à sem justa causa' },
      { documento: 'Aviso Prévio', empregado: '1 via', empregador: '1 via' },
      { documento: 'Guia FGTS (40%)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Chave FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Extrato FGTS', empregado: '1 via', empregador: '1 via' },
      { documento: 'Seguro-Desemprego', empregado: '1 via', empregador: '1 via' },
      { documento: 'Folha de Ponto (se houver)', empregado: '1 via', empregador: '1 via' },
      { documento: 'Comprovante de pagamento', empregado: '1 via', empregador: '1 via' },
    ],
  },
];

export function getRescisaoTipoConfig(id: RescisaoTipoId): RescisaoTipoConfig {
  return RESCISAO_TIPOS.find(t => t.id === id) ?? RESCISAO_TIPOS[0];
}