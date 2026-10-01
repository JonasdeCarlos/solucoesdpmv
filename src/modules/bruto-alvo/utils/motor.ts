// Motor do Fechamento por Bruto Alvo — espelho da folha do Domínio.
export type Formato = 'hhmm' | 'centesimal';
export type Modo = 'horas_fixas' | 'percentual' | 'ajuste';
export type Criterio = 'mais_proximo' | 'nunca_ultrapassar';

export interface Rubrica {
  verba: string;
  descricao: string;
  tipo: 'quinquenio' | 'fixa' | 'variavel';
  fator: number;
  valor_fixo?: number | null;
  percentual_salario?: number | null;
  gera_dsr: boolean;
  integra_base_hora: boolean;
  /** Variáveis: o quinquênio entra na hora-base desta rubrica? */
  quinquenio_integra?: boolean;
  exporta: boolean;
  ativo: boolean;
  codigo_rubrica_dominio?: string | null;
  ordem?: number;
}

export interface ItemCfg { verba: string; modo: Modo; percentual?: number | null; unidades?: number | null; horas_ponto?: number | null }

export interface Params {
  salario: number;
  admissao: string | null; // AAAA-MM-DD
  competencia: string; // AAAA-MM
  diasUteis: number;
  diasDsr: number;
  divisor: number;
  formato: Formato;
  tetoQuinquenio?: number | null;
  rubricas: Rubrica[];
}

export interface LinhaVar { verba: string; descricao: string; unidades: number; horas: number; hhmm: string; valor: number; gera_dsr: boolean; horas_ponto?: number | null }
export interface Resultado {
  anos: number; percQuinq: number; valorQuinq: number;
  fixas: { verba: string; descricao: string; valor: number }[];
  horaBase: number; horaBaseSemQuinq: number; variaveis: LinhaVar[]; dsrNoturno: number; dsrExtras: number; bruto: number;
}

export const DEFAULT_RUBRICAS: Rubrica[] = [
  { verba: 'QUINQUENIO', descricao: 'Quinquênio', tipo: 'quinquenio', fator: 0, gera_dsr: false, integra_base_hora: true, exporta: false, ativo: true, ordem: 0 },
  { verba: 'AD_NOT', descricao: 'AD. NOT', tipo: 'variavel', fator: 0.2, gera_dsr: true, integra_base_hora: false, quinquenio_integra: false, exporta: true, ativo: true, ordem: 1 },
  { verba: 'HE60', descricao: 'H. EXTRA 60%', tipo: 'variavel', fator: 1.6, gera_dsr: true, integra_base_hora: false, quinquenio_integra: true, exporta: true, ativo: true, ordem: 2 },
  { verba: 'HE120', descricao: 'H. EXTRA 120%', tipo: 'variavel', fator: 2.2, gera_dsr: true, integra_base_hora: false, quinquenio_integra: true, exporta: true, ativo: true, ordem: 3 },
  { verba: 'HE120_DOM', descricao: 'H. EXTRA 120% Domingo', tipo: 'variavel', fator: 2.2, gera_dsr: true, integra_base_hora: false, quinquenio_integra: true, exporta: true, ativo: true, ordem: 4 },
];

export const DEFAULT_MODELO: ItemCfg[] = [
  { verba: 'AD_NOT', modo: 'percentual', percentual: 15 },
  { verba: 'HE120', modo: 'percentual', percentual: 15 },
  { verba: 'HE120_DOM', modo: 'percentual', percentual: 15 },
  { verba: 'HE60', modo: 'ajuste' },
];

export const r2 = (v: number) => Math.round((v + Math.sign(v) * 1e-9) * 100) / 100;
export const isNoturno = (verba: string) => verba === 'AD_NOT';

export function horasDe(unidades: number, f: Formato) { return f === 'hhmm' ? unidades / 60 : unidades / 100; }
export function hhmm(minutos: number) { const m = Math.round(minutos); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
export function unidadesParaMinutos(u: number, f: Formato) { return f === 'hhmm' ? u : Math.round(u * 0.6); }
/** HH:MM ou decimal digitado → unidades do formato */
export function parseHoras(s: string, f: Formato): number {
  const t = String(s || '').trim();
  if (!t) return 0;
  let h: number;
  if (t.includes(':')) { const [a, b] = t.split(':'); h = Number(a) + Number(b || 0) / 60; } else h = Number(t.replace(',', '.'));
  if (!isFinite(h)) return 0;
  return f === 'hhmm' ? Math.round(h * 60) : Math.round(h * 100);
}

export function anosCompletos(admissao: string, competencia: string) {
  const [y, m] = competencia.split('-').map(Number);
  const fim = new Date(y, m, 0);
  const a = new Date(admissao + 'T00:00:00');
  let anos = fim.getFullYear() - a.getFullYear();
  if (fim.getMonth() < a.getMonth() || (fim.getMonth() === a.getMonth() && fim.getDate() < a.getDate())) anos--;
  return Math.max(0, anos);
}
export function percQuinquenio(anos: number, teto?: number | null) {
  const p = Math.floor(anos / 5) * 5;
  return teto != null && teto > 0 ? Math.min(p, teto) : p;
}

export function calcular(p: Params, unidades: Record<string, number>, horasPonto: Record<string, number | null | undefined> = {}): Resultado {
  const ativas = p.rubricas.filter((r) => r.ativo);
  const quinq = ativas.find((r) => r.tipo === 'quinquenio');
  const anos = p.admissao ? anosCompletos(p.admissao, p.competencia) : 0;
  const percQ = quinq ? percQuinquenio(anos, p.tetoQuinquenio) : 0;
  const valorQ = r2(p.salario * percQ / 100);
  const fixas = ativas.filter((r) => r.tipo === 'fixa').map((r) => ({
    verba: r.verba, descricao: r.descricao, integra: r.integra_base_hora,
    valor: r2(r.valor_fixo ? Number(r.valor_fixo) : p.salario * Number(r.percentual_salario || 0) / 100),
  }));
  const baseHora = p.salario + (quinq?.integra_base_hora ? valorQ : 0) + fixas.filter((f) => f.integra).reduce((s, f) => s + f.valor, 0);
  const horaBase = baseHora / (p.divisor || 220);
  const horaSemQ = (baseHora - (quinq?.integra_base_hora ? valorQ : 0)) / (p.divisor || 220);
  const hbDe = (r: Rubrica) => (r.quinquenio_integra === false ? horaSemQ : horaBase);
  const variaveis: LinhaVar[] = ativas.filter((r) => r.tipo === 'variavel').sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((r) => {
    const u = Math.max(0, Math.round(unidades[r.verba] || 0));
    const horas = horasDe(u, p.formato);
    return { verba: r.verba, descricao: r.descricao, unidades: u, horas, hhmm: hhmm(unidadesParaMinutos(u, p.formato)), valor: r2(horas * hbDe(r) * r.fator), gera_dsr: r.gera_dsr, horas_ponto: horasPonto[r.verba] };
  });
  const du = p.diasUteis || 1;
  const somaN = variaveis.filter((v) => v.gera_dsr && isNoturno(v.verba)).reduce((s, v) => s + v.valor, 0);
  const somaE = variaveis.filter((v) => v.gera_dsr && !isNoturno(v.verba)).reduce((s, v) => s + v.valor, 0);
  const dsrNoturno = r2(somaN / du * p.diasDsr);
  const dsrExtras = r2(somaE / du * p.diasDsr);
  const bruto = r2(p.salario + valorQ + fixas.reduce((s, f) => s + f.valor, 0) + variaveis.reduce((s, v) => s + v.valor, 0) + dsrNoturno + dsrExtras);
  return { anos, percQuinq: percQ, valorQuinq: valorQ, fixas: fixas.map(({ integra, ...f }) => f), horaBase, horaBaseSemQuinq: horaSemQ, variaveis, dsrNoturno, dsrExtras, bruto };
}

export interface Reverso { unidades: Record<string, number>; resultado: Resultado; diferenca: number; erro?: string }

export function reverso(p: Params, itens: ItemCfg[], alvo: number, criterio: Criterio = 'mais_proximo'): Reverso {
  const base = calcular(p, {});
  const fixo = base.bruto; // salário + quinquênio + fixas
  const unidades: Record<string, number> = {};
  const ponto: Record<string, number | null | undefined> = {};
  itens.forEach((i) => { ponto[i.verba] = i.horas_ponto; });
  if (alvo < fixo) return { unidades, resultado: base, diferenca: r2(fixo - alvo), erro: 'Alvo menor que o fixo do funcionário' };
  const saldo = alvo - fixo;
  const rub = (v: string) => p.rubricas.find((r) => r.verba === v && r.ativo && r.tipo === 'variavel');
  const hb = (r: Rubrica, x: Resultado) => (r.quinquenio_integra === false ? x.horaBaseSemQuinq : x.horaBase);
  const fatorDsr = (r: Rubrica) => 1 + (r.gera_dsr ? p.diasDsr / (p.diasUteis || 1) : 0);
  const porU = p.formato === 'hhmm' ? 60 : 100;
  for (const i of itens) {
    const r = rub(i.verba); if (!r) continue;
    if (i.modo === 'horas_fixas') unidades[i.verba] = Math.round(i.unidades || 0);
    else if (i.modo === 'percentual') {
      const h = (saldo * (Number(i.percentual) || 0) / 100) / (hb(r, base) * r.fator * fatorDsr(r) || 1);
      unidades[i.verba] = Math.max(0, Math.round(h * porU));
    }
  }
  const aj = itens.find((i) => i.modo === 'ajuste' && rub(i.verba));
  let res = calcular(p, unidades, ponto);
  if (aj) {
    const r = rub(aj.verba)!;
    const falta = alvo - res.bruto;
    let u = Math.max(0, Math.round((falta / (hb(r, res) * r.fator * fatorDsr(r) || 1)) * porU));
    const avalia = (x: number) => calcular(p, { ...unidades, [aj.verba]: x }, ponto).bruto;
    const ok = (b: number) => criterio === 'mais_proximo' || b <= alvo + 1e-9;
    const score = (b: number) => (ok(b) ? Math.abs(b - alvo) : Infinity);
    let best = u, bestS = score(avalia(u));
    for (let it = 0; it < 120; it++) {
      const cands = [best - 1, best + 1].filter((x) => x >= 0);
      let melhorou = false;
      for (const c of cands) { const s = score(avalia(c)); if (s < bestS) { best = c; bestS = s; melhorou = true; } }
      if (!melhorou) break;
    }
    if (bestS === Infinity) { while (best > 0 && avalia(best) > alvo) best--; bestS = score(avalia(best)); }
    unidades[aj.verba] = best;
    // Refino fino: o passo de 1 minuto da verba de ajuste pode ser maior que a tolerância;
    // combina ±2 minutos do ajuste com ±40 minutos da verba percentual de menor fator.
    const fina = itens.filter((i) => i.modo === 'percentual' && rub(i.verba)).map((i) => rub(i.verba)!).sort((a, b) => a.fator - b.fator)[0];
    if (fina && bestS > 0.005) {
      const u0 = unidades[fina.verba] || 0;
      let bA = best, bF = u0;
      for (let da = -2; da <= 2; da++) for (let df = -40; df <= 40; df++) {
        const a = best + da, f = u0 + df; if (a < 0 || f < 0) continue;
        const s = score(calcular(p, { ...unidades, [aj.verba]: a, [fina.verba]: f }, ponto).bruto);
        if (s < bestS - 1e-9) { bestS = s; bA = a; bF = f; }
      }
      unidades[aj.verba] = bA; unidades[fina.verba] = bF;
    }
    res = calcular(p, unidades, ponto);
  }
  return { unidades, resultado: res, diferenca: r2(res.bruto - alvo) };
}

/** Sugere dias úteis / DSR (domingos + feriados fora de domingo). */
export function sugerirDias(competencia: string, feriados: string[]) {
  const [y, m] = competencia.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  let dsr = 0;
  for (let d = 1; d <= n; d++) {
    const dt = new Date(y, m - 1, d);
    const iso = `${competencia}-${String(d).padStart(2, '0')}`;
    if (dt.getDay() === 0 || feriados.includes(iso)) dsr++;
  }
  return { diasUteis: n - dsr, diasDsr: dsr };
}
