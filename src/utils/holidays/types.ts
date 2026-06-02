export type HolidayTipo = 'nacional' | 'distrital' | 'municipal' | 'estadual' | 'sindical' | 'ponto_facultativo' | 'interno';
export type HolidayScope = 'todos' | 'uf' | 'municipio' | 'empresa' | 'cct';
export type HolidaySource = 'auto' | 'manual' | 'decreto' | 'cct' | 'import_csv';
export type HolidayStatus = 'ativo' | 'inativo';

export interface Holiday {
  id: string;
  data: string;
  nome: string;
  tipo: HolidayTipo;
  is_holiday: boolean;
  is_optional: boolean;
  scope_type: HolidayScope;
  uf: string | null;
  municipio: string | null;
  company_id: string | null;
  cct_id: string | null;
  source_type: HolidaySource;
  source_doc_id: string | null;
  status: HolidayStatus;
  observacoes: string;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

export type NoticeAudienceType = 'todos' | 'uf' | 'municipio' | 'cct' | 'empresa';
export interface NoticeAudience {
  type: NoticeAudienceType;
  uf?: string;
  municipio?: string;
  cct_id?: string;
  company_id?: string;
}

export interface HolidayNotice {
  id: string;
  title: string;
  body_template: string;
  holiday_ids: string[];
  audience: NoticeAudience;
  status: 'rascunho' | 'publicado' | 'arquivado';
  periodo_inicio: string | null;
  periodo_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfficeBranding {
  id: string;
  office_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  heading_font?: string;
  body_font?: string;
  brand_manual_url?: string | null;
  contacts: { phone?: string; email?: string; site?: string; address?: string };
}

export const TIPO_LABELS: Record<HolidayTipo, string> = {
  nacional: 'Nacional',
  distrital: 'Distrital',
  municipal: 'Municipal',
  estadual: 'Estadual',
  sindical: 'Sindical (CCT)',
  ponto_facultativo: 'Ponto Facultativo',
  interno: 'Interno',
};

export const TIPO_COLORS: Record<HolidayTipo, string> = {
  nacional: '#DC2626',
  municipal: '#628E3F',
  estadual: '#2563EB',
  distrital: '#0EA5E9',
  sindical: '#9333EA',
  ponto_facultativo: '#F59E0B',
  interno: '#64748B',
};