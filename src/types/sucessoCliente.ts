export interface ClienteDP {
  id: string;
  nome: string;
  tipo: 'PF' | 'PJ';
  cpf: string;
  cnpj: string;
  endereco: string;
  codigo_cliente: string | null;
  nome_fantasia: string;
  municipio: string;
  uf: string;
  segmento: string;
  contato_nome: string;
  contato_telefone: string;
  contato_email: string;
  status: string;
  gestor_carteira: string;
  tipo_folha: string;
}

export interface DPProfile {
  id?: string;
  client_id: string;
  digisac_contact_name: string;
  digisac_contact_id: string;
  channel_default: string;
  best_contact_time: string;
  sla_hours: number;
  has_timeclock: boolean;
  timeclock_type: string;
  timeclock_owner: string;
  timeclock_url: string;
  timeclock_user: string;
  timeclock_notes: string;
  manual_send_method: string;
  manual_send_frequency: string;
  has_variables: boolean;
  variables_how: string;
  variables_deadline_day: number | null;
  variables_responsible: string;
  needs_preview: boolean;
  preview_deadline_day: number | null;
  preview_channel: string;
  preview_rules: string;
  workload_type: string;
  workload_hhmm: string;
  workload_rules: string;
  sst_empresa: string;
  sst_contato_nome: string;
  sst_contato_telefone: string;
  sst_contato_email: string;
  admissao_modelo_contrato: string;
  admissao_caminho_dominio: string;
  admissao_clausulas_especificas: string;
}

export function emptyProfile(client_id: string): DPProfile {
  return {
    client_id,
    digisac_contact_name: '',
    digisac_contact_id: '',
    channel_default: 'whatsapp',
    best_contact_time: '',
    sla_hours: 24,
    has_timeclock: false,
    timeclock_type: '',
    timeclock_owner: '',
    timeclock_url: '',
    timeclock_user: '',
    timeclock_notes: '',
    manual_send_method: '',
    manual_send_frequency: '',
    has_variables: false,
    variables_how: '',
    variables_deadline_day: null,
    variables_responsible: '',
    needs_preview: false,
    preview_deadline_day: null,
    preview_channel: '',
    preview_rules: '',
    workload_type: 'fixa',
    workload_hhmm: '',
    workload_rules: '',
    sst_empresa: '',
    sst_contato_nome: '',
    sst_contato_telefone: '',
    sst_contato_email: '',
    admissao_modelo_contrato: '',
    admissao_caminho_dominio: '',
    admissao_clausulas_especificas: '',
  };
}

export interface DiaryEntry {
  id: string;
  client_id: string;
  occurred_at: string;
  author_id: string | null;
  author_name: string;
  tags: string[];
  text: string;
  attachment_path: string;
  archived: boolean;
  archived_reason: string;
}

export interface ClientUpload {
  id: string;
  client_id: string;
  upload_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  version: number;
  uploaded_at: string;
  notes: string;
}

export interface ClientCCT {
  id: string;
  client_id: string;
  union_base: string;
  sindicato: string;
  uf: string;
  data_base: string;
  validity_start: string | null;
  validity_end: string | null;
  doc_path: string;
  doc_name: string;
  ai_summary: string;
  ai_clauses: Array<{ titulo: string; descricao: string }>;
  codigo_sindicato_dominio: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientRubric {
  id: string;
  client_id: string;
  code: string;
  name: string;
  kind: 'provento' | 'desconto' | 'informativa';
  percents_text: string;
  incidences: { inss?: boolean; fgts?: boolean; irrf?: boolean; dsr?: boolean; esocial?: boolean };
  is_critical: boolean;
  notes: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  is_default: boolean;
  steps: Array<{ id: string; title: string }>;
}

export interface ChecklistStepStatus {
  id: string;
  title: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  responsible: string;
  marked_at: string | null;
  observation: string;
  attachment_path: string;
}

export interface ChecklistRun {
  id: string;
  client_id: string;
  competence: string;
  template_id: string | null;
  steps_status: ChecklistStepStatus[];
}

export interface MessageTemplate {
  id: string;
  client_id: string | null;
  is_global: boolean;
  category: string;
  channel: string;
  title: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  client_id: string;
  event_date: string;
  event_type: string;
  title: string;
  notes: string;
}

export interface RiskFlag {
  id: string;
  client_id: string;
  flag_type: string;
  severity: 'baixa' | 'media' | 'alta';
  notes: string;
}