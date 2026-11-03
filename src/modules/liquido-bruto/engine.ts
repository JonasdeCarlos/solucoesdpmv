/**
 * Motor puro do módulo Líquido → Bruto.
 * Toda a aritmética é feita em centavos (inteiros); cada desconto é arredondado
 * para 2 casas com ROUND_HALF_UP.
 */

export interface FaixaTabela {
  faixa: number;
  /** null = acima da última faixa */
  limite_superior: number | null;
  /** fração (0,075 = 7,5%) */
  aliquota: number;
  parcela_deduzir: number;
}

export interface ParametrosIrrf {
  deducao_dependente: number;
  desconto_simplificado: number;
  redutor_limite_isencao: number;
  redutor_valor_max: number;
  redutor_limite_final: number;
  redutor_constante: number;
  redutor_coeficiente: number;
}

export interface TabelasLegais {
  vigencia_inicio: string;
  inss: FaixaTabela[];
  irrf: FaixaTabela[];
  parametros: ParametrosIrrf;
}

export type TipoValor = 'percentual' | 'fixo';

export interface DescontoVariavel {
  ativo: boolean;
  tipo: TipoValor;
  /** percentual em pontos (1 = 1%) ou valor em R$ */
  valor: number;
}

export interface OutroDesconto {
  descricao: string;
  tipo: TipoValor;
  valor: number;
}

export interface ParametrosSimulacao {
  dependentes: number;
  assistencial: DescontoVariavel;
  vt: { ativo: boolean; custo: number };
  pensao: DescontoVariavel;
  outros: { ativo: boolean; itens: OutroDesconto[] };
}

export type RegimeIrrf = 'legal' | 'simplificado';

export interface ResultadoLiquido {
  bruto: number;
  inss: number;
  inssFaixa: number;
  inssAliquotaNominal: number;
  inssAliquotaEfetiva: number;
  baseInss: number;
  baseIrrfLegal: number;
  baseIrrfSimplificada: number;
  impostoLegal: number;
  impostoSimplificado: number;
  regimeIrrf: RegimeIrrf;
  impostoBruto: number;
  reducaoLei15270: number;
  irrf: number;
  assistencial: number;
  vt: number;
  pensao: number;
  outros: { descricao: string; valor: number }[];
  totalDescontos: number;
  liquido: number;
  aliquotaEfetivaTotal: number;
}

export interface ResultadoBruto extends ResultadoLiquido {
  liquidoAlvo: number;
  diferencaArredondamento: number;
}

// ---------- helpers em centavos ----------
const EPS = 1e-7;
/** arredonda um valor em centavos (pode ter fração) para inteiro, ROUND_HALF_UP */
const rhu = (cents: number) => (cents >= 0 ? Math.floor(cents + 0.5 + EPS) : -Math.floor(-cents + 0.5 + EPS));
export const toCents = (v: number) => rhu((v || 0) * 100);
const fromCents = (c: number) => c / 100;

function faixaDe(tabela: FaixaTabela[], baseC: number): FaixaTabela {
  const ord = [...tabela].sort((a, b) => a.faixa - b.faixa);
  for (const f of ord) {
    if (f.limite_superior == null || baseC <= toCents(f.limite_superior)) return f;
  }
  return ord[ord.length - 1];
}

/** imposto/contribuição em centavos = base × alíquota − parcela, arredondado */
function aplicarTabela(tabela: FaixaTabela[], baseC: number): { valorC: number; faixa: FaixaTabela } {
  if (baseC <= 0) return { valorC: 0, faixa: [...tabela].sort((a, b) => a.faixa - b.faixa)[0] };
  const f = faixaDe(tabela, baseC);
  const v = rhu(baseC * f.aliquota - toCents(f.parcela_deduzir));
  return { valorC: Math.max(0, v), faixa: f };
}

export function tetoInss(t: TabelasLegais): number {
  const lims = t.inss.map((f) => f.limite_superior || 0);
  return Math.max(...lims);
}

function descVar(d: DescontoVariavel, brutoC: number): number {
  if (!d.ativo) return 0;
  return d.tipo === 'percentual' ? rhu((brutoC * (d.valor || 0)) / 100) : toCents(d.valor);
}

/** soma dos percentuais sobre o bruto (assistencial + pensão + outros %) */
export function somaPercentuais(p: ParametrosSimulacao): number {
  let s = 0;
  if (p.assistencial.ativo && p.assistencial.tipo === 'percentual') s += p.assistencial.valor || 0;
  if (p.pensao.ativo && p.pensao.tipo === 'percentual') s += p.pensao.valor || 0;
  if (p.outros.ativo) for (const o of p.outros.itens) if (o.tipo === 'percentual') s += o.valor || 0;
  return s;
}

function calcularLiquidoC(brutoC: number, p: ParametrosSimulacao, t: TabelasLegais): ResultadoLiquido {
  const pi = t.parametros;
  // 1. INSS
  const baseInssC = Math.min(brutoC, toCents(tetoInss(t)));
  const inss = aplicarTabela(t.inss, baseInssC);

  // 5. Pensão (necessária para a base legal do IRRF)
  const pensaoC = descVar(p.pensao, brutoC);

  // 2. IRRF
  const baseLegalC = brutoC - inss.valorC - (p.dependentes || 0) * toCents(pi.deducao_dependente) - pensaoC;
  const baseSimpC = brutoC - toCents(pi.desconto_simplificado);
  const impLegalC = aplicarTabela(t.irrf, baseLegalC).valorC;
  const impSimpC = aplicarTabela(t.irrf, baseSimpC).valorC;
  const regime: RegimeIrrf = impSimpC < impLegalC ? 'simplificado' : 'legal';
  const impostoC = Math.min(impLegalC, impSimpC);

  let reducaoC = 0;
  if (brutoC <= toCents(pi.redutor_limite_isencao)) reducaoC = impostoC;
  else if (brutoC <= toCents(pi.redutor_limite_final))
    reducaoC = Math.max(0, rhu(toCents(pi.redutor_constante) - brutoC * pi.redutor_coeficiente));
  reducaoC = Math.min(reducaoC, impostoC);
  const irrfC = Math.max(0, impostoC - reducaoC);

  // 3, 4, 6
  const assistC = descVar(p.assistencial, brutoC);
  // VT: 6% do bruto; se o custo do VT for informado e menor, desconta só o custo
  const vt6C = rhu(brutoC * 0.06);
  const vtC = p.vt.ativo ? (toCents(p.vt.custo) > 0 ? Math.min(vt6C, toCents(p.vt.custo)) : vt6C) : 0;
  const outros = p.outros.ativo
    ? p.outros.itens.map((o) => ({
        descricao: o.descricao || 'Outro desconto',
        c: o.tipo === 'percentual' ? rhu((brutoC * (o.valor || 0)) / 100) : toCents(o.valor),
      }))
    : [];
  const outrosC = outros.reduce((s, o) => s + o.c, 0);

  const totalC = inss.valorC + irrfC + assistC + vtC + pensaoC + outrosC;
  const liqC = brutoC - totalC;

  return {
    bruto: fromCents(brutoC),
    inss: fromCents(inss.valorC),
    inssFaixa: inss.faixa.faixa,
    inssAliquotaNominal: inss.faixa.aliquota,
    inssAliquotaEfetiva: brutoC > 0 ? inss.valorC / brutoC : 0,
    baseInss: fromCents(baseInssC),
    baseIrrfLegal: fromCents(baseLegalC),
    baseIrrfSimplificada: fromCents(baseSimpC),
    impostoLegal: fromCents(impLegalC),
    impostoSimplificado: fromCents(impSimpC),
    regimeIrrf: regime,
    impostoBruto: fromCents(impostoC),
    reducaoLei15270: fromCents(reducaoC),
    irrf: fromCents(irrfC),
    assistencial: fromCents(assistC),
    vt: fromCents(vtC),
    pensao: fromCents(pensaoC),
    outros: outros.map((o) => ({ descricao: o.descricao, valor: fromCents(o.c) })),
    totalDescontos: fromCents(totalC),
    liquido: fromCents(liqC),
    aliquotaEfetivaTotal: brutoC > 0 ? totalC / brutoC : 0,
  };
}

export function calcularLiquido(bruto: number, p: ParametrosSimulacao, t: TabelasLegais): ResultadoLiquido {
  return calcularLiquidoC(toCents(bruto), p, t);
}

export class ErroSimulacao extends Error {}

export function calcularBruto(liquidoAlvo: number, p: ParametrosSimulacao, t: TabelasLegais): ResultadoBruto {
  const alvoC = toCents(liquidoAlvo);
  if (alvoC <= 0) throw new ErroSimulacao('Informe o salário líquido desejado.');
  if (somaPercentuais(p) >= 60)
    throw new ErroSimulacao('A soma dos descontos percentuais (assistencial, pensão e outros) chega a 60% ou mais do bruto. Revise os percentuais.');

  let lo = 1;
  let hi = alvoC * 3 + 1_000_000;
  if (calcularLiquidoC(hi, p, t).liquido * 100 < alvoC)
    throw new ErroSimulacao('Não foi possível atingir esse líquido com os descontos informados. Revise os descontos fixos.');
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (toCents(calcularLiquidoC(mid, p, t).liquido) >= alvoC) hi = mid;
    else lo = mid + 1;
  }
  const r = calcularLiquidoC(lo, p, t);
  return { ...r, liquidoAlvo: fromCents(alvoC), diferencaArredondamento: fromCents(toCents(r.liquido) - alvoC) };
}

export const parametrosVazios = (): ParametrosSimulacao => ({
  dependentes: 0,
  assistencial: { ativo: false, tipo: 'percentual', valor: 0 },
  vt: { ativo: false, custo: 0 },
  pensao: { ativo: false, tipo: 'percentual', valor: 0 },
  outros: { ativo: false, itens: [] },
});

/** escolhe a tabela de maior vigência ≤ competência (yyyy-mm-01) */
export function escolherVigencia(vigencias: string[], competencia: string): string | null {
  const v = vigencias.filter((d) => d <= competencia).sort();
  return v.length ? v[v.length - 1] : null;
}
