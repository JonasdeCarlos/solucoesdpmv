import type { HolidayTipo, HolidayScope } from './types';

function normalize(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
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
    args.tipo,
    args.scope_type,
    args.uf || '',
    normalize(args.municipio || ''),
    args.cct_id || '',
    args.company_id || '',
    normalize(args.nome),
  ].join('|');
}