export interface RescisaoDossier {
  id: string;
  employee_name: string;
  termination_date: string;
  payment_date_suggested: string | null;
  payment_date_final: string | null;
  competence_month: string | null;
  company_name: string | null;
  company_cnpj: string | null;
  checked_by: string | null;
  final_pdf_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RescisaoDossierFile {
  id: string;
  dossier_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  doc_category: string;
  sort_order: number;
  pages: number;
  uploaded_at: string;
}

export const DOC_CATEGORIES = [
  'TRCT',
  'Termo de Quitação/Homologação',
  'Aviso Prévio',
  'Carta Pedido de Demissão',
  'Ficha de Registro de Empregados',
  'Analítico Rescisão',
  'Extrato FGTS',
  'GRRF/Guia FGTS',
  'Seguro-Desemprego / Requerimento',
  'Exame Demissional (ASO)',
  'Carta de Preposto/Procuração',
  'Recibo de Pagamento',
  'Comprovante de Pagamento',
  'Outros',
] as const;

export type DocCategory = typeof DOC_CATEGORIES[number];

export const ESSENTIAL_DOCS: DocCategory[] = [
  'TRCT',
  'Aviso Prévio',
  'Exame Demissional (ASO)',
  'Recibo de Pagamento',
];

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  category: DocCategory;
  sortOrder: number;
  preview?: string;
  viasEmpregado?: string;
  viasEmpregador?: string;
  customLabel?: string;
}
