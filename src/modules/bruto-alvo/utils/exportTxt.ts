// Wrapper próprio sobre o gerador do Domínio da Taxa de Serviço (sem alterá-lo).
// Exporta somente REFERÊNCIAS de horas no formato hhh:mm (ex.: 38:02 → 000003802) ou centesimal.
import { gerarLinha, validarLinha } from '@/modules/taxa-servico/utils/dominioLayout';
import type { Formato, Rubrica } from './motor';

export function referenciaCampo(unidades: number, f: Formato): number {
  if (f === 'hhmm') return Math.floor(unidades / 60) + (unidades % 60) / 100;
  return unidades / 100;
}

export function gerarTxt(
  funcs: { codigo: string; unidades: Record<string, number> }[], rubricas: Rubrica[], formato: Formato,
  competenciaAAAAMM: string, tipoProcesso: string, codigoEmpresa: string | null,
) {
  const erros: string[] = [];
  const linhas: string[] = [];
  const exportaveis = rubricas.filter((r) => r.ativo && r.tipo === 'variavel' && r.exporta);
  for (const r of exportaveis) if (!String(r.codigo_rubrica_dominio || '').trim()) erros.push(`Rubrica "${r.descricao}" sem código Domínio.`);
  if (erros.length) return { erros, linhas, conteudo: '' };
  for (const f of funcs) for (const r of exportaveis) {
    const u = f.unidades[r.verba] || 0;
    if (u <= 0) continue;
    const input = { codigoEmpregado: f.codigo, competencia: competenciaAAAAMM, rubrica: String(r.codigo_rubrica_dominio), tipoProcesso, valor: referenciaCampo(u, formato), codigoEmpresa };
    const e = validarLinha(input);
    if (e.length) erros.push(...e); else linhas.push(gerarLinha(input));
  }
  return { erros, linhas, conteudo: linhas.length ? linhas.join('\r\n') + '\r\n' : '' };
}
