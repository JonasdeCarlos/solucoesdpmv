import type { HolidayTipo, HolidayScope } from './types';

export function normalizeHolidayText(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

export function getHolidayEventKey(data: string, nome: string): string {
  const n = normalizeHolidayText(nome);
  if ((n.includes('SEXTA-FEIRA SANTA') || n.includes('PAIXAO DE CRISTO'))) return 'SEXTA_FEIRA_SANTA';
  if (n.includes('CARNAVAL')) return 'CARNAVAL';
  if (n.includes('QUARTA-FEIRA DE CINZAS') || n.includes('QUARTA FEIRA DE CINZAS')) return 'QUARTA_CINZAS';
  if (n.includes('CORPUS CHRISTI')) return 'CORPUS_CHRISTI';
  if (n.includes('CONSCIENCIA NEGRA') || n.includes('ZUMBI')) return 'CONSCIENCIA_NEGRA';
  if (n.includes('CONFRATERNIZACAO')) return 'CONFRATERNIZACAO';
  if (n === 'NATAL' || (data.endsWith('-12-25') && n.includes('NATAL'))) return 'NATAL';
  if (n.includes('INDEPENDENCIA')) return 'INDEPENDENCIA';
  if (n.includes('TIRADENTES')) return 'TIRADENTES';
  if (n.includes('DIA DO TRABALHO')) return 'DIA_TRABALHO';
  if (n.includes('APARECIDA')) return 'APARECIDA';
  if (n.includes('FINADOS')) return 'FINADOS';
  if (n.includes('PROCLAMACAO')) return 'PROCLAMACAO';
  if (n.includes('SERVIDOR PUBLICO')) return 'SERVIDOR_PUBLICO';
  if (n.includes('IMACULADA CONCEICAO') || n.includes('NOSSA SENHORA DA CONCEICAO') || n.includes('PADROEIRA DE CAMANDUCAIA')) return 'IMACULADA_CONCEICAO';
  return n;
}

export const BROAD_EVENT_KEYS = new Set([
  'SEXTA_FEIRA_SANTA', 'CARNAVAL', 'QUARTA_CINZAS', 'CORPUS_CHRISTI', 'CONSCIENCIA_NEGRA',
  'CONFRATERNIZACAO', 'NATAL', 'INDEPENDENCIA', 'TIRADENTES', 'DIA_TRABALHO',
  'APARECIDA', 'FINADOS', 'PROCLAMACAO', 'SERVIDOR_PUBLICO',
]);

export function getEffectiveScopeKey(args: {
  scope_type: HolidayScope;
  uf?: string | null;
  municipio?: string | null;
  cct_id?: string | null;
  company_id?: string | null;
}): string {
  if (args.scope_type === 'todos') return 'todos';
  if (args.scope_type === 'uf') return `uf:${normalizeHolidayText(args.uf || '')}`;
  if (args.scope_type === 'municipio') return `municipio:${normalizeHolidayText(args.uf || '')}:${normalizeHolidayText(args.municipio || '')}`;
  if (args.scope_type === 'cct') return `cct:${args.cct_id || ''}`;
  if (args.scope_type === 'empresa') return `empresa:${args.company_id || ''}`;
  return args.scope_type;
}

export function buildDedupeKey(args: {
  data: string;
  tipo: HolidayTipo;
  scope_type: HolidayScope;
  uf?: string | null;
  municipio?: string | null;
  cct_id?: string | null;
  company_id?: string | null;
  nome: string;
}): string {
  return [
    args.data,
    args.scope_type,
    getEffectiveScopeKey(args),
    args.cct_id || '',
    args.company_id || '',
    getHolidayEventKey(args.data, args.nome),
  ].join('|');
}

export function isDuplicateHoliday(candidate: {
  data: string; nome: string; scope_type: HolidayScope; uf?: string | null; municipio?: string | null; cct_id?: string | null; company_id?: string | null;
}, existing: {
  data: string; nome: string; scope_type: HolidayScope; uf?: string | null; municipio?: string | null; cct_id?: string | null; company_id?: string | null;
}): boolean {
  if (candidate.data !== existing.data) return false;
  const eventKey = getHolidayEventKey(candidate.data, candidate.nome);
  if (eventKey !== getHolidayEventKey(existing.data, existing.nome)) return false;
  if (getEffectiveScopeKey(candidate) === getEffectiveScopeKey(existing)) return true;
  return BROAD_EVENT_KEYS.has(eventKey) && getEffectiveScopeKey(existing) === 'todos';
}

export function dedupeHolidayList<T extends {
  data: string; nome: string; scope_type: HolidayScope; uf?: string | null; municipio?: string | null; cct_id?: string | null; company_id?: string | null; created_at?: string;
}>(items: T[]): T[] {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = `${item.data}|${getHolidayEventKey(item.data, item.nome)}`;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  const out: T[] = [];
  for (const group of grouped.values()) {
    const eventKey = getHolidayEventKey(group[0].data, group[0].nome);
    const hasGlobal = BROAD_EVENT_KEYS.has(eventKey) && group.some((h) => getEffectiveScopeKey(h) === 'todos');
    const seen = new Set<string>();
    const candidates = hasGlobal ? group.filter((h) => getEffectiveScopeKey(h) === 'todos') : group;
    for (const h of candidates) {
      const scopeKey = getEffectiveScopeKey(h);
      if (seen.has(scopeKey)) continue;
      seen.add(scopeKey);
      out.push(h);
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
}