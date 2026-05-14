// Normalização e categorização de motivos de avisos

export const MOTIVO_CATEGORIES = [
  'Contrato experiência 1º vencimento',
  'Contrato experiência prorrogação',
  'Aviso Prévio de rescisão',
  'Monitoramento de Saúde - Admissional',
  'Monitoramento de Saúde - Periódico',
  'Vencimento de 2º Férias',
  'Retorno de afastamento de Doença',
  'Programação de férias',
  'Envio rescisão eSocial',
  'Outros',
] as const;

export type MotivoCategoria = (typeof MOTIVO_CATEGORIES)[number];

export function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function categorizarMotivo(raw: string): MotivoCategoria {
  const n = normalizeText(raw);
  // Tolera typos comuns do OCR: "PRORROG", "PRROROG", "PRRORROG", "PROROG", etc.
  const isProrrog = /PR+O?R+O?G/.test(n);
  if (n.includes('EXPERIENCIA') && isProrrog) return 'Contrato experiência prorrogação';
  if (n.includes('EXPERIENCIA')) return 'Contrato experiência 1º vencimento';
  if (n.includes('AVISO PREVIO')) return 'Aviso Prévio de rescisão';
  if (n.includes('MONITORAMENTO') && n.includes('ADMISSIONAL')) return 'Monitoramento de Saúde - Admissional';
  if (n.includes('MONITORAMENTO') && n.includes('PERIODIC')) return 'Monitoramento de Saúde - Periódico';
  if ((n.includes('2') || n.includes('SEGUNDA')) && n.includes('FERIAS')) return 'Vencimento de 2º Férias';
  if (n.includes('VENCIMENTO') && n.includes('FERIAS')) return 'Vencimento de 2º Férias';
  if (n.includes('RETORNO') && n.includes('AFAST')) return 'Retorno de afastamento de Doença';
  if (n.includes('PROGRAMACAO') && n.includes('FERIAS')) return 'Programação de férias';
  if (n.includes('ESOCIAL') || (n.includes('ENVIO') && n.includes('RESCISAO'))) return 'Envio rescisão eSocial';
  return 'Outros';
}

/** Parses "DD/MM/YYYY" or "DD/MM/YYYY - Limite DD/MM/YYYY" */
export function parseVencimento(raw: string): { due: string | null; limit: string | null } {
  if (!raw) return { due: null, limit: null };
  const dateRe = /(\d{2})\/(\d{2})\/(\d{4})/g;
  const matches = [...raw.matchAll(dateRe)];
  const toIso = (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}`;
  return { due: matches[0] ? toIso(matches[0]) : null, limit: matches[1] ? toIso(matches[1]) : null };
}

export function parseEmissionDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function formatBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function normalizeCnpj(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function buildAvisoDedupeKey(parts: {
  empresaCode: string; employeeCode: string; employeeName: string;
  motivo: string; due: string | null; limit: string | null;
}): string {
  return [
    parts.empresaCode.trim(),
    parts.employeeCode.trim(),
    normalizeText(parts.employeeName),
    parts.motivo.trim(),
    parts.due ?? '',
    parts.limit ?? '',
  ].join('|');
}

export function formatCnpj(raw: string): string {
  const d = normalizeCnpj(raw);
  if (d.length !== 14) return raw;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

export async function makeUniqueHash(parts: {
  cnpj: string; empresaCode: string; employeeCode: string;
  employeeName: string; motivo: string; due: string | null; limit: string | null;
}): Promise<string> {
  const key = [
    // CNPJ removido do hash: o OCR pode retornar valores diferentes entre execuções.
    // empresa_code já identifica a empresa de forma única e estável.
    parts.empresaCode.trim(),
    parts.employeeCode.trim(),
    normalizeText(parts.employeeName),
    parts.motivo,
    parts.due ?? '',
    parts.limit ?? '',
  ].join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const STATUS_OPTIONS = [
  { value: 'sem_retorno', label: 'Sem retorno' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_tratamento', label: 'Em tratamento' },
  { value: 'concluido', label: 'Concluído' },
] as const;

export type AvisoStatus = typeof STATUS_OPTIONS[number]['value'];

export function statusLabel(s: string): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export const CALL_CHANNELS = [
  'Ligação telefônica',
  'WhatsApp (chamada)',
  'WhatsApp (mensagem)',
  'E-mail',
  'Presencial',
  'Outro',
] as const;
