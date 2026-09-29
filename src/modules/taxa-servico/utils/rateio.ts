export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export interface RateioItem { funcionario_id: string; pontos: number }
export interface RateioResult { funcionario_id: string; pontos: number; valor_comissao: number }

/** Rateia o líquido por pontos; resíduo de centavos vai para a maior pontuação. */
export function ratear(liquido: number, itens: RateioItem[]) {
  const validos = itens.filter((i) => i.pontos > 0);
  const totalPontos = validos.reduce((s, i) => s + i.pontos, 0);
  if (!totalPontos || liquido <= 0) {
    return { totalPontos, valorPonto: 0, itens: itens.map((i) => ({ ...i, valor_comissao: 0 })), soma: 0, diferenca: round2(liquido) };
  }
  const valorPonto = liquido / totalPontos;
  const liquidoCent = Math.round(liquido * 100);
  const res: RateioResult[] = itens.map((i) => ({
    ...i,
    valor_comissao: i.pontos > 0 ? Math.round(i.pontos * valorPonto * 100) / 100 : 0,
  }));
  const somaCent = res.reduce((s, r) => s + Math.round(r.valor_comissao * 100), 0);
  const residuo = liquidoCent - somaCent;
  if (residuo !== 0) {
    let idx = -1;
    res.forEach((r, k) => { if (r.pontos > 0 && (idx < 0 || r.pontos > res[idx].pontos)) idx = k; });
    res[idx].valor_comissao = (Math.round(res[idx].valor_comissao * 100) + residuo) / 100;
  }
  const soma = res.reduce((s, r) => s + Math.round(r.valor_comissao * 100), 0) / 100;
  return { totalPontos, valorPonto, itens: res, soma, diferenca: round2(liquido - soma) };
}

export interface AjusteInput { valor_comissao: number; rendimento_bruto_extrato: number | null; valor_bruto_alvo: number | null }
export interface AjusteResult { diferenca: number | null; valor_ajustado: number; alerta: string | null }

/** Sempre parte da comissão original (idempotente). */
export function calcularAjuste(i: AjusteInput): AjusteResult {
  if (i.rendimento_bruto_extrato == null || i.valor_bruto_alvo == null) {
    return {
      diferenca: null,
      valor_ajustado: round2(i.valor_comissao),
      alerta: i.rendimento_bruto_extrato == null ? 'Sem extrato — mantido valor original' : 'Sem bruto alvo — mantido valor original',
    };
  }
  const diferenca = round2(i.rendimento_bruto_extrato - i.valor_bruto_alvo);
  let ajustado = round2(i.valor_comissao - diferenca);
  let alerta: string | null = null;
  if (ajustado < 0) { ajustado = 0; alerta = 'Redução excede a taxa de serviço do funcionário'; }
  else if (i.valor_bruto_alvo > i.rendimento_bruto_extrato) alerta = 'Acréscimo sobre a comissão original';
  return { diferenca, valor_ajustado: ajustado, alerta };
}
