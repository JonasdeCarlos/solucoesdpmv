import { gerarLinha, validarLinha } from '@/modules/taxa-servico/utils/dominioLayout';

export type TipoValor = 'valor' | 'horas' | 'quantidade';
export interface Lancamento { codigo: string; nome: string; evento: string; valor: string }
export interface Mapa { evento: string; rubrica: string; tipo: TipoValor; ignorar: boolean }

export const normNome = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** "12:30" → {h:12,m:30}; "1.234,56" → 1234.56 */
export function parseValor(raw: string): { numero: number; horas: boolean } {
  const s = String(raw ?? '').trim().replace(/^R\$\s*/i, '');
  const hm = s.match(/^(-?\d+)[:hH](\d{1,2})$/);
  if (hm) return { numero: Number(hm[1]) + Number(hm[2]) / 60, horas: true };
  let t = s.replace(/\s/g, '');
  if (/,\d{1,3}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return { numero: Number.isFinite(n) ? n : 0, horas: false };
}

export function sugerirTipo(valores: string[]): TipoValor {
  if (valores.some((v) => parseValor(v).horas)) return 'horas';
  if (valores.every((v) => /^\d+$/.test(String(v).trim()))) return 'quantidade';
  return 'valor';
}

/** Valor do campo Domínio (o gerador multiplica por 100). Horas viram hhh,mm. */
export function valorDominio(raw: string, tipo: TipoValor): number {
  const s = String(raw ?? '').trim();
  if (tipo === 'horas') {
    const hm = s.match(/^(\d+)[:hH](\d{1,2})$/);
    if (hm) return Number(hm[1]) + Number(hm[2]) / 100;
    const dec = parseValor(s).numero; // decimal → hh:mm
    const h = Math.floor(dec); const m = Math.round((dec - h) * 60);
    return h + m / 100;
  }
  return Math.round(parseValor(s).numero * 100) / 100;
}

export function gerarConteudo(
  linhas: Lancamento[], mapas: Record<string, Mapa>, codigos: Record<string, string>,
  competencia: string, tipoProcesso: string, codigoEmpresa: string | null,
) {
  const erros: string[] = [];
  const out: string[] = [];
  for (const l of linhas) {
    const m = mapas[l.evento];
    if (!m || m.ignorar) continue;
    const codigo = (l.codigo || codigos[normNome(l.nome)] || '').trim();
    const valor = valorDominio(l.valor, m.tipo);
    if (!(valor > 0)) continue;
    const input = { codigoEmpregado: codigo, competencia, rubrica: m.rubrica, tipoProcesso, valor, codigoEmpresa };
    const e = validarLinha(input);
    if (e.length) erros.push(`${l.nome || codigo} / ${l.evento}: ${e.join(' ')}`);
    else out.push(gerarLinha(input));
  }
  if (!out.length && !erros.length) erros.push('Nenhum lançamento com valor maior que zero.');
  return { erros, linhas: out, conteudo: out.length ? out.join('\r\n') + '\r\n' : '' };
}
