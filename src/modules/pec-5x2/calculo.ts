// Motor de cálculo da Necessidade de Contratação (PEC 5x2). Funções puras.
export type Nivel = 'baixo' | 'normal' | 'alto' | 'pico';
export type Regime = 'sem' | 'semanal' | 'mensal' | 'banco';
export interface Marco { id: string; nome: string; data: string; jornada: number; dias: number }
export interface Faixa { ini: string; fim: string; postos: number }
export interface DiaFunc { aberto: boolean; turnos: { ini: string; fim: string }[]; postos_diretos?: number | null }
export interface Parametros {
  marcos: Marco[];
  regime_compensacao_padrao: Regime;
  limite_diario_padrao: number;
  multiplicadores_intensidade: Record<Nivel, number>;
  indices_reposicao: { ativo: boolean; ferias: number; absenteismo: number; arredondar: boolean };
}
export interface Setor {
  id?: string; nome: string; funcionarios_atuais: number;
  funcionarios_por_sexo?: { M?: number; F?: number };
  parciais?: { qtd: number; horas: number };
  funcionamento?: Record<string, DiaFunc>; // "0"=dom..."6"
  postos?: Faixa[];
  intensidade_dias?: Record<string, Nivel>;
  regime_compensacao?: Regime | null; limite_diario?: number | null; insalubre?: boolean;
  datas_especiais?: { data: string; nivel: Nivel; observacao?: string }[];
}

export const MARCOS_PADRAO: Marco[] = [
  { id: 'atual', nome: 'Atual (6x1)', data: '', jornada: 44, dias: 6 },
  { id: 'm1', nome: 'Marco 1 (5x2)', data: '2026-12-15', jornada: 42, dias: 5 },
  { id: 'm2', nome: 'Marco 2 (5x2)', data: '2027-12-15', jornada: 40, dias: 5 },
];
export const PARAMS_PADRAO: Parametros = {
  marcos: MARCOS_PADRAO, regime_compensacao_padrao: 'sem', limite_diario_padrao: 8,
  multiplicadores_intensidade: { baixo: 0.75, normal: 1, alto: 1.25, pico: 1.5 },
  indices_reposicao: { ativo: true, ferias: 8.33, absenteismo: 0, arredondar: true },
};
export const REGIME_LABEL: Record<Regime, string> = {
  sem: 'Sem compensação (8h/dia)', semanal: 'Compensação semanal (art. 59 §2º)',
  mensal: 'Compensação mensal (art. 59 §6º)', banco: 'Banco de horas (art. 59 §§2º/5º)',
};
const ORDEM: Nivel[] = ['baixo', 'normal', 'alto', 'pico'];
export const DIAS = ['1', '2', '3', '4', '5', '6', '0'];
export const DIA_LABEL: Record<string, string> = { '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb' };

export const horas = (ini: string, fim: string) => {
  const m = (s: string) => { const [h, mi] = (s || '0:0').split(':').map(Number); return (h || 0) * 60 + (mi || 0); };
  let d = m(fim) - m(ini); if (d < 0) d += 1440; return d / 60;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export const modoB = (s: Setor) => !!s.postos?.length && DIAS.some((d) => s.funcionamento?.[d]?.aberto);

export interface Resultado {
  marco: Marco; modo: 'A' | 'B'; regime: Regime; limite: number;
  horasDemandadas: number; horasDisponiveis: number; saldo: number;
  necHoras: number; necCobertura: number; necessidade: number; arredondada: number; gap: number; atual: number;
  jornadaEfetiva: number; parcialSugerido: number | null; alertas: string[]; memoria: string[];
  postosDia: Record<string, number>;
}

/** Calcula um setor em um marco. comp=false força "sem compensação". */
export function calcular(s: Setor, p: Parametros, marco: Marco, comp: boolean, pico = false): Resultado {
  const regime: Regime = comp ? (s.regime_compensacao || p.regime_compensacao_padrao) : 'sem';
  const limiteCfg = Math.min(10, s.limite_diario ?? p.limite_diario_padrao);
  const limite = regime === 'sem' ? 8 : Math.max(8, limiteCfg);
  const memoria: string[] = []; const alertas: string[] = [];
  const parc = s.parciais || { qtd: 0, horas: 0 };
  const horasParc = (parc.qtd || 0) * (parc.horas || 0);
  const atual = (s.funcionarios_atuais || 0) + (parc.qtd || 0);
  const implicita = marco.jornada / marco.dias;
  const jornadaEfetiva = Math.min(marco.jornada, limite * marco.dias);
  if (regime === 'sem' && implicita > 8)
    alertas.push(`Sem compensação, ${marco.jornada}h em ${marco.dias} dias = ${fmtH(implicita)}/dia, acima de 8h. Jornada útil limitada a ${jornadaEfetiva}h/semana.`);
  memoria.push(`Jornada do marco: ${marco.jornada}h em ${marco.dias} dias (${fmtH(implicita)}/dia); regime ${REGIME_LABEL[regime]}, limite ${limite}h/dia → jornada útil ${r2(jornadaEfetiva)}h/semana.`);

  let horasDem = 0, necCob = 0; const postosDia: Record<string, number> = {};
  const B = modoB(s);
  if (!B) {
    horasDem = (s.funcionarios_atuais || 0) * 44 + horasParc;
    memoria.push(`Modo A: horas demandadas = ${s.funcionarios_atuais} × 44h + ${horasParc}h parciais = ${r2(horasDem)}h/semana.`);
  } else {
    const nivelPico = (s.datas_especiais || []).reduce<Nivel | null>((acc, d) => (!acc || ORDEM.indexOf(d.nivel) > ORDEM.indexOf(acc) ? d.nivel : acc), null);
    let abertos = 0, maxPostos = 0;
    for (const d of DIAS) {
      const f = s.funcionamento?.[d]; if (!f?.aberto) continue; abertos++;
      let nv: Nivel = s.intensidade_dias?.[d] || 'normal';
      if (pico && nivelPico && ORDEM.indexOf(nivelPico) > ORDEM.indexOf(nv)) nv = nivelPico;
      const mult = p.multiplicadores_intensidade[nv] ?? 1;
      let hDia = 0, maxDia = 0;
      for (const fx of s.postos || []) {
        const ps = f.postos_diretos != null && f.postos_diretos > 0 ? f.postos_diretos : Math.ceil((fx.postos || 0) * mult);
        hDia += horas(fx.ini, fx.fim) * ps; maxDia = Math.max(maxDia, ps);
      }
      postosDia[d] = maxDia; horasDem += hDia; maxPostos = Math.max(maxPostos, maxDia);
      memoria.push(`${DIA_LABEL[d]} (${nv}, ×${mult}): ${r2(hDia)}h, até ${maxDia} postos simultâneos.`);
    }
    necCob = (maxPostos * abertos) / marco.dias;
    memoria.push(`Modo B${pico ? ' – semana de pico' : ''}: horas demandadas = ${r2(horasDem)}h/semana; cobertura = ${maxPostos} postos × ${abertos} dias ÷ ${marco.dias} = ${r2(necCob)}.`);
  }
  const necHoras = horasDem / jornadaEfetiva;
  let nec = Math.max(necHoras, necCob);
  memoria.push(`Necessidade por horas = ${r2(horasDem)} ÷ ${r2(jornadaEfetiva)} = ${r2(necHoras)}${B ? `; maior critério = ${r2(nec)}` : ''}.`);
  const ir = p.indices_reposicao;
  if (ir.ativo) {
    const pct = (ir.ferias || 0) + (ir.absenteismo || 0);
    nec = nec * (1 + pct / 100);
    memoria.push(`Reposição de ausências ${r2(pct)}% → ${r2(nec)} FTE.`);
  }
  const arred = Math.ceil(nec - 1e-9);
  const frac = nec - Math.floor(nec);
  const parcialSugerido = frac > 0.01 && frac < 0.75 ? Math.max(1, Math.round(frac * marco.jornada)) : null;
  const horasDisp = (s.funcionarios_atuais || 0) * jornadaEfetiva + horasParc;
  if (s.insalubre && regime !== 'sem')
    alertas.push('Setor insalubre com compensação: depende de licença prévia da autoridade competente (art. 60 CLT; Súmula 85, VI, TST).');
  if (regime !== 'sem' && horasDem > atual * jornadaEfetiva + horasParc && arred <= atual)
    alertas.push('Demanda depende de horas extras habituais além da compensação: a habitualidade descaracteriza o acordo (Súmula 85, IV, TST).');
  return {
    marco, modo: B ? 'B' : 'A', regime, limite, horasDemandadas: r2(horasDem), horasDisponiveis: r2(horasDisp), saldo: r2(horasDisp - horasDem),
    necHoras: r2(necHoras), necCobertura: r2(necCob), necessidade: r2(nec), arredondada: arred, gap: arred - atual, atual,
    jornadaEfetiva: r2(jornadaEfetiva), parcialSugerido, alertas, memoria, postosDia,
  };
}

export function fmtH(h: number) { const t = Math.round(h * 60); return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, '0')}`; }

export interface LinhaDia { rotulo: string; nivel: Nivel; mult: number; horas: number; postosMax: number; pessoas: number; escalados: number; deficit: number; obs?: string; explicacao: string }
/** Necessidade detalhada por dia da semana e por data especial (Modo B). */
export function necessidadePorDia(s: Setor, p: Parametros, marco: Marco, comp = true): LinhaDia[] {
  if (!modoB(s)) return [];
  const r = calcular(s, p, marco, comp);
  const jornadaDia = Math.min(r.limite, marco.jornada / marco.dias);
  const abertos = DIAS.filter((d) => s.funcionamento?.[d]?.aberto);
  const escalados = abertos.length ? Math.floor((r.arredondada * marco.dias) / abertos.length) : 0;
  const linha = (d: string, nv: Nivel, rotulo: string, obs?: string): LinhaDia => {
    const f = s.funcionamento![d]; const mult = p.multiplicadores_intensidade[nv] ?? 1;
    let h = 0, mx = 0; const partes: string[] = [];
    const direto = f.postos_diretos != null && f.postos_diretos > 0;
    for (const fx of s.postos || []) {
      const ps = direto ? f.postos_diretos! : Math.ceil((fx.postos || 0) * mult);
      const hf = horas(fx.ini, fx.fim);
      h += hf * ps; mx = Math.max(mx, ps);
      partes.push(direto ? `${fx.ini}–${fx.fim}: ${ps} postos (informado direto) × ${fmtH(hf)} = ${fmtH(hf * ps)}`
        : `${fx.ini}–${fx.fim}: ${fx.postos} postos${mult !== 1 ? ` × ${mult} (${nv}) = ${r2(fx.postos * mult)} → ${ps}` : ''} × ${fmtH(hf)} = ${fmtH(hf * ps)}`);
    }
    const turnos = (f.turnos || []).map((x) => `${x.ini}–${x.fim}`).join(' e ');
    const porHoras = Math.ceil(h / jornadaDia - 1e-9);
    const pessoas = Math.max(mx, porHoras);
    const motivo = porHoras >= mx
      ? `${fmtH(h)} de trabalho ÷ ${fmtH(jornadaDia)} por pessoa/dia = ${r2(h / jornadaDia)} → ${pessoas} pessoas`
      : `${fmtH(h)} ÷ ${fmtH(jornadaDia)} = ${porHoras}, mas são ${mx} postos ao mesmo tempo → ${pessoas} pessoas`;
    const explicacao = `Funcionamento ${turnos || '—'}. ${partes.join('; ')}. ${motivo}${mult !== 1 ? ` (movimento ${nv}: postos multiplicados por ${mult})` : ''}.`;
    return { rotulo, nivel: nv, mult, horas: r2(h), postosMax: mx, pessoas, escalados, deficit: Math.max(0, pessoas - escalados), obs, explicacao };
  };
  const out = abertos.map((d) => linha(d, s.intensidade_dias?.[d] || 'normal', DIA_LABEL[d]));
  for (const de of s.datas_especiais || []) {
    if (!de.data) continue;
    const wd = String(new Date(de.data + 'T12:00:00').getDay());
    if (!s.funcionamento?.[wd]?.aberto) continue;
    out.push(linha(wd, de.nivel, `${de.data.split('-').reverse().join('/')} (${DIA_LABEL[wd]})`, de.observacao));
  }
  return out;
}
