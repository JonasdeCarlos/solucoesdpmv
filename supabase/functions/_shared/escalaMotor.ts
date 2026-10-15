// Motor único da Escala de Revezamento — usado pelo front (interno e público) e pela edge escala-publica.
// Sem imports: precisa rodar em Vite e em Deno.

export type TipoDia = 'T' | 'F' | 'FC' | 'A';
export type Categoria = 'COMERCIO' | 'DEMAIS_AUTORIZADAS' | 'AUTORIZACAO_TRANSITORIA_OU_CCT';

export interface EscalaFuncionario {
  id: string;
  codigo: string;
  nome: string;
  cargo: string;
  sexo: 'M' | 'F';
  art386_ativo: boolean;
  art386_justificativa_desativacao: string;
  ultima_folga_anterior: string | null;
  ultimo_domingo_folga_anterior: string | null;
  hora_entrada: string;
  hora_saida: string;
  dias: Record<string, TipoDia>;
}

export interface RegrasCct {
  n_domingos_max?: number | null;
  /** Opcional: semanas máximas entre domingos de folga da mulher (art. 386 CLT = 2). */
  domingo_mulher_semanas?: number | null;
  max_consecutivos?: number | null;
  prazo_folga_feriado?: number | null;
  clausula_feriados?: boolean;
}

export interface EscalaParams {
  regime: string;
  data_inicio: string;
  data_fim: string;
  categoria_atividade: Categoria;
  atividade_anexo_iv: string;
  fundamento_trabalho_domingo: string;
  cct_vigente: boolean;
  cct_registro: string;
  cct_vigencia: string;
  regras_cct: RegrasCct;
  prazo_folga_compensatoria_feriado: number;
  n_domingos: number;
  minimo_diario: number;
  feriados: { data: string; nome: string }[];
  setor: string;
  responsavel_nome: string;
}

export interface Violacao {
  id: string;
  severidade: 'BLOQUEIO' | 'ALERTA';
  descricao: string;
  fundamento: string;
  funcionario?: string;
  datas?: string;
  mensagem: string;
}

export const ATIVIDADES_ANEXO_IV = [
  'nenhuma',
  'Hotéis',
  'Restaurantes, bares e similares',
  'Padarias e confeitarias',
  'Farmácias e drogarias',
  'Postos de combustíveis',
  'Salões de beleza e barbearias',
  'Turismo, agências e locadoras',
  'Lavanderias',
  'Mercados, supermercados e hipermercados',
  'Feiras livres e mercados municipais',
  'Comércio de flores e coroas',
  'Comércio em portos, aeroportos, estradas e estações',
  'Comércio em hotéis',
  'Comércio de artigos regionais em estâncias',
  'Comércio em geral (lojas, shoppings)',
];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  COMERCIO: 'Comércio (Anexo IV, item II)',
  DEMAIS_AUTORIZADAS: 'Demais atividades autorizadas (Anexo IV)',
  AUTORIZACAO_TRANSITORIA_OU_CCT: 'Autorização transitória ou CCT',
};

export const TIPO_LABEL: Record<TipoDia, string> = { T: 'Trabalho', F: 'Folga', FC: 'Folga compensatória de feriado', A: 'Afastado/férias' };

// ---------- datas ----------
const toD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toS = (d: Date) => d.toISOString().slice(0, 10);
export const addDias = (s: string, n: number) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
export const diaSemana = (s: string) => toD(s).getUTCDay(); // 0 = domingo
export const fmtBR = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fmtBRAno = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export function listarDias(ini: string, fim: string): string[] {
  const out: string[] = [];
  if (!ini || !fim || ini > fim) return out;
  for (let d = ini; d <= fim && out.length < 400; d = addDias(d, 1)) out.push(d);
  return out;
}
const diffDias = (a: string, b: string) => Math.round((toD(b).getTime() - toD(a).getTime()) / 86400000);
const hm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim()); return m ? Number(m[1]) + Number(m[2]) / 60 : null; };

export const nMaxCategoria = (p: EscalaParams) => {
  const base = p.categoria_atividade === 'COMERCIO' ? 3 : 7;
  const cct = p.regras_cct?.n_domingos_max;
  return cct && cct > 0 ? Math.min(base, cct) : base;
};
export const maxConsecutivos = (p: EscalaParams) => {
  const c = p.regras_cct?.max_consecutivos;
  return c && c > 0 ? Math.min(6, c) : 6;
};
export const prazoFeriado = (p: EscalaParams) => {
  const c = p.regras_cct?.prazo_folga_feriado;
  return c && c > 0 ? c : (p.prazo_folga_compensatoria_feriado || 7);
};
export const semMulher = (p: EscalaParams) => Math.max(2, Math.floor(Number(p.regras_cct?.domingo_mulher_semanas) || 2));

export const nEfetivo = (p: EscalaParams) => Math.max(1, Math.min(p.n_domingos || 1, nMaxCategoria(p)));
export const is12x36 = (p: EscalaParams) => /12\s*x\s*36/i.test(p.regime || '');
const descanso = (t?: TipoDia) => t === 'F' || t === 'FC' || t === 'A';
const feriadoSet = (p: EscalaParams) => new Set((p.feriados || []).map((f) => f.data));
const podeTrabalharFeriado = (p: EscalaParams) =>
  p.categoria_atividade === 'COMERCIO'
    ? (p.atividade_anexo_iv && p.atividade_anexo_iv !== 'nenhuma') || (p.cct_vigente && !!p.regras_cct?.clausula_feriados)
    : !!p.fundamento_trabalho_domingo?.trim();

const FUND = {
  R01: 'art. 7º, XV, CF; art. 67 CLT; Lei 605/1949, art. 1º',
  R02: 'OJ 410 SDI-1 TST',
  R03: 'Lei 10.101/2000, art. 6º, p.u. / Portaria MTP 671/2021',
  R04: 'art. 386 CLT',
  R05: 'art. 68 CLT',
  R06: 'art. 70 CLT; Lei 605/1949, arts. 8º e 9º; Lei 10.101/2000, art. 6º-A; Portaria MTE 1.316/2026',
  R06b: 'Súmula 146 TST',
  R07: 'Súmula 146 TST',
  R08: 'arts. 66 e 67 CLT; Súmula 110 TST',
  R09: 'regra operacional',
  R10: 'art. 67, parágrafo único, CLT',
};

function v(id: string, sev: Violacao['severidade'], descricao: string, fundamento: string, funcionario?: string, datas?: string): Violacao {
  const mensagem = [`${id} ${descricao}`, fundamento, funcionario, datas].filter(Boolean).join(' – ');
  return { id, severidade: sev, descricao, fundamento, funcionario, datas, mensagem };
}
const rotulo = (f: EscalaFuncionario, i: number) => (f.nome ? `${f.codigo ? f.codigo + ' ' : ''}${f.nome}` : `Func. ${String(i + 1).padStart(2, '0')}`);

// ---------- validador ----------
export interface Resultado {
  violacoes: Violacao[];
  bloqueios: Violacao[];
  alertas: Violacao[];
  domingosTrabalhados: Record<string, number>;
  porCelula: Record<string, string[]>; // `${funcId}|${data}` -> ids
}

export function validarEscala(p: EscalaParams, funcs: EscalaFuncionario[], opts: { pdfFinal?: boolean; cliente?: { nome?: string; cnpj?: string } } = {}): Resultado {
  const out: Violacao[] = [];
  if (semMulher(p) > 2) out.push(v('R04', 'ALERTA', `Escala domingo da mulher ampliada para ${semMulher(p)} semanas — o art. 386 da CLT prevê folga dominical quinzenal (a cada 2 semanas). Risco trabalhista: exige respaldo em CCT/ACT.`, FUND.R04));
  const porCelula: Record<string, string[]> = {};
  const marca = (fid: string, d: string, id: string) => { const k = `${fid}|${d}`; (porCelula[k] ||= []).includes(id) || porCelula[k].push(id); };
  const domingosTrabalhados: Record<string, number> = {};

  if (is12x36(p)) {
    out.push(v('R00', 'BLOQUEIO', 'Escala 12x36 fora do motor (DSR e feriados já compensados)', 'art. 59-A, p.u., CLT'));
    return fin();
  }
  const dias = listarDias(p.data_inicio, p.data_fim);
  if (!dias.length) { out.push(v('R00', 'BLOQUEIO', 'Período da escala inválido', '—')); return fin(); }
  const fer = feriadoSet(p);
  const maxC = maxConsecutivos(p);
  const nMax = nMaxCategoria(p);
  const N = p.n_domingos || 0;
  if (N > nMax) out.push(v('R03', 'BLOQUEIO', `N de ${N} domingos acima do máximo de ${nMax} para a categoria`, FUND.R03));
  if (N < 1) out.push(v('R03', 'BLOQUEIO', 'Informe o N de domingos (mínimo 1)', FUND.R03));
  const nUse = Math.max(1, Math.min(N || 1, nMax));
  const domingos = dias.filter((d) => diaSemana(d) === 0);

  // R05 (geral)
  const algumDomingoT = funcs.some((f) => domingos.some((d) => (f.dias[d] || 'T') === 'T'));
  if (algumDomingoT && !p.fundamento_trabalho_domingo?.trim())
    out.push(v('R05', 'BLOQUEIO', 'Domingo trabalhado sem fundamento de autorização', FUND.R05));

  // R09 cobertura
  if (p.minimo_diario > 0) {
    for (const d of dias) {
      const n = funcs.filter((f) => (f.dias[d] || 'T') === 'T').length;
      if (n < p.minimo_diario) out.push(v('R09', 'ALERTA', `Cobertura de ${n} abaixo do mínimo de ${p.minimo_diario}`, FUND.R09, undefined, fmtBR(d)));
    }
  }

  funcs.forEach((f, i) => {
    const nome = rotulo(f, i);
    const t = (d: string) => f.dias[d] || 'T';

    // R01 — semanas seg–dom completas no período
    for (const d of dias) {
      if (diaSemana(d) !== 1) continue;
      const sem = listarDias(d, addDias(d, 6));
      if (sem[6] > p.data_fim) break;
      if (!sem.some((x) => t(x) === 'F' || t(x) === 'A')) {
        out.push(v('R01', 'BLOQUEIO', 'Semana sem folga semanal', FUND.R01, nome, `${fmtBR(sem[0])} a ${fmtBR(sem[6])}`));
        sem.forEach((x) => marca(f.id, x, 'R01'));
      }
    }

    // R02 — dias consecutivos
    let streak = 0; let ini = p.data_inicio;
    if (f.ultima_folga_anterior && f.ultima_folga_anterior < p.data_inicio) {
      streak = diffDias(f.ultima_folga_anterior, p.data_inicio) - 1;
      ini = addDias(f.ultima_folga_anterior, 1);
    } else {
      streak = 1; ini = addDias(p.data_inicio, -1);
      out.push(v('R02', 'ALERTA', 'Última folga anterior não informada (assumido dia anterior trabalhado)', FUND.R02, nome));
    }
    let reportado = false;
    for (const d of dias) {
      if (t(d) === 'T') {
        streak++;
        if (streak > maxC && !reportado) {
          out.push(v('R02', 'BLOQUEIO', `Excedeu ${maxC} dias consecutivos`, FUND.R02, nome, `${fmtBR(ini > p.data_inicio ? ini : p.data_inicio)} a ${fmtBR(d)}`));
          reportado = true;
        }
        if (streak > maxC) marca(f.id, d, 'R02');
      } else { streak = 0; ini = addDias(d, 1); reportado = false; }
    }

    // R03 / R04 — domingos
    const art386 = f.sexo === 'F' && f.art386_ativo;
    if (f.sexo === 'F' && !f.art386_ativo) {
      if (!f.art386_justificativa_desativacao?.trim()) out.push(v('R04', 'BLOQUEIO', 'Art. 386 desativado sem justificativa', FUND.R04, nome));
      else out.push(v('R04', 'ALERTA', `art. 386 CLT não aplicado – justificativa: ${f.art386_justificativa_desativacao.trim()}`, FUND.R04, nome));
    }
    let dStreak = 0;
    if (f.ultimo_domingo_folga_anterior && f.ultimo_domingo_folga_anterior < p.data_inicio) {
      dStreak = Math.max(0, Math.floor((diffDias(f.ultimo_domingo_folga_anterior, p.data_inicio) - 1) / 7));
    } else {
      dStreak = 1;
      out.push(v('R03', 'ALERTA', 'Último domingo de folga anterior não informado (assumido domingo anterior trabalhado)', FUND.R03, nome));
    }
    const limite = art386 ? semMulher(p) : nUse;
    const idR = art386 ? 'R04' : 'R03';
    let cont = 0; let iniDom = '';
    for (const d of domingos) {
      if (t(d) === 'T') {
        cont++;
        if (!iniDom) iniDom = d;
        dStreak++;
        if (dStreak >= limite) {
          out.push(v(idR, 'BLOQUEIO', art386 ? (semMulher(p) > 2 ? `Sem folga em ${limite} domingos consecutivos (escala da mulher ampliada)` : 'Dois domingos seguidos sem folga (regime quinzenal)') : `Sem folga em ${limite} domingos consecutivos`, art386 ? FUND.R04 : FUND.R03, nome, `até ${fmtBR(d)}`));
          marca(f.id, d, idR);
        }
      } else { dStreak = 0; iniDom = ''; }
    }
    domingosTrabalhados[f.id] = cont;
    if (cont > 0) out.push(v('R07', 'ALERTA', `${cont} domingo(s) trabalhado(s) no período`, FUND.R07, nome));

    // R06 — feriados
    const prazo = prazoFeriado(p);
    for (const d of dias) {
      if (!fer.has(d) || t(d) !== 'T') continue;
      if (!podeTrabalharFeriado(p)) {
        out.push(v('R06', 'BLOQUEIO', 'Escalado em feriado sem autorização (Anexo IV/CCT/fundamento)', FUND.R06, nome, fmtBR(d)));
        marca(f.id, d, 'R06');
      }
      const janela = listarDias(addDias(d, 1), addDias(d, prazo));
      const temFC = janela.some((x) => f.dias[x] === 'FC');
      const fimPeriodo = addDias(d, prazo) > p.data_fim && !temFC;
      if (!temFC) {
        out.push(v('R06', 'ALERTA', fimPeriodo ? 'Feriado trabalhado: prazo da folga compensatória passa do fim do período – conferir' : 'Feriado trabalhado sem folga compensatória – pagamento em dobro (Súmula 146 TST)', FUND.R06b, nome, fmtBR(d)));
        marca(f.id, d, 'R06');
      }
    }

    // R08 — 35h
    const ent = hm(f.hora_entrada); const sai = hm(f.hora_saida);
    if (ent != null && sai != null) {
      const noturna = sai <= ent;
      for (const d of dias) {
        if (t(d) !== 'F') continue;
        const prev = addDias(d, -1); const next = addDias(d, 1);
        const prevT = prev >= p.data_inicio ? t(prev) === 'T' : true;
        const nextT = next <= p.data_fim ? t(next) === 'T' : true;
        if (noturna && prevT) {
          out.push(v('R08', 'BLOQUEIO', 'Jornada noturna avança sobre o dia de folga (folga não é dia civil inteiro)', FUND.R08, nome, fmtBR(d)));
          marca(f.id, d, 'R08');
          continue;
        }
        if (prevT && nextT) {
          const desc = (24 - sai) + 24 + ent;
          if (desc < 35) { out.push(v('R08', 'ALERTA', `Intervalo de ${desc.toFixed(1)}h, abaixo de 35h`, FUND.R08, nome, fmtBR(d))); marca(f.id, d, 'R08'); }
        }
      }
    }
  });

  // R10 — quadro (só para PDF final)
  if (opts.pdfFinal) {
    if (!opts.cliente?.nome) out.push(v('R10', 'BLOQUEIO', 'Quadro sem razão social', FUND.R10));
    if (!opts.cliente?.cnpj) out.push(v('R10', 'BLOQUEIO', 'Quadro sem CNPJ', FUND.R10));
    if (!p.setor?.trim()) out.push(v('R10', 'BLOQUEIO', 'Quadro sem setor', FUND.R10));
    if (!p.responsavel_nome?.trim()) out.push(v('R10', 'BLOQUEIO', 'Quadro sem responsável pela assinatura', FUND.R10));
  }
  if (!funcs.length) out.push(v('R00', 'BLOQUEIO', 'Cadastre ao menos um funcionário', '—'));

  return fin();
  function fin(): Resultado {
    return { violacoes: out, bloqueios: out.filter((x) => x.severidade === 'BLOQUEIO'), alertas: out.filter((x) => x.severidade === 'ALERTA'), domingosTrabalhados, porCelula };
  }
}

// ---------- gerador ----------
// Prioridade: R02 > R01 > R04 > R03 > R06a > R08 > R09 > R06b > R11.
// Construtivo com reparo: nunca sacrifica R01–R06 para atender cobertura.
export interface Geracao { funcionarios: EscalaFuncionario[]; conflitos: string[] }

export function gerarEscala(p: EscalaParams, funcsIn: EscalaFuncionario[]): Geracao {
  const conflitos: string[] = [];
  if (is12x36(p)) return { funcionarios: funcsIn, conflitos: ['Escala 12x36 fora do motor (art. 59-A, p.u., CLT). Nada foi gerado.'] };
  const dias = listarDias(p.data_inicio, p.data_fim);
  const fer = feriadoSet(p);
  const maxC = maxConsecutivos(p);
  const N = nEfetivo(p);
  const domingos = dias.filter((d) => diaSemana(d) === 0);
  const feriadoOk = podeTrabalharFeriado(p);
  const domingoOk = !!p.fundamento_trabalho_domingo?.trim();
  const funcs = funcsIn.map((f) => ({ ...f, dias: {} as Record<string, TipoDia> }));
  // mantém afastamentos
  funcsIn.forEach((f, i) => Object.entries(f.dias || {}).forEach(([d, t]) => { if (t === 'A') funcs[i].dias[d] = 'A'; }));
  const cobertura = (d: string) => funcs.filter((f) => (f.dias[d] || 'T') === 'T').length;

  // 1) Domingos por turmas (R03/R04/R11)
  const gerais = funcs.filter((f) => !(f.sexo === 'F' && f.art386_ativo));
  const mulheres = funcs.filter((f) => f.sexo === 'F' && f.art386_ativo);
  const turmas = (lista: typeof funcs, T: number) => lista.forEach((f, idx) => {
    // respeita o histórico: quantos domingos já trabalhou desde a última folga dominical
    let ja = 1;
    if (f.ultimo_domingo_folga_anterior && f.ultimo_domingo_folga_anterior < p.data_inicio)
      ja = Math.max(0, Math.floor((diffDias(f.ultimo_domingo_folga_anterior, p.data_inicio) - 1) / 7));
    const primeiro = Math.max(0, Math.min(T - 1 - ja, (idx % T)));
    domingos.forEach((d, k) => {
      if (f.dias[d] === 'A') return;
      const folga = !domingoOk || (k >= primeiro && (k - primeiro) % T === 0);
      f.dias[d] = folga ? 'F' : 'T';
    });
  });
  turmas(gerais, N);
  turmas(mulheres, semMulher(p));

  // 2) Feriados
  for (const d of dias) if (fer.has(d) && !feriadoOk) funcs.forEach((f) => { if (!f.dias[d]) f.dias[d] = 'F'; });

  // 3) Folga semanal (R01) + reparo de consecutivos (R02)
  funcs.forEach((f, fi) => {
    const t = (d: string) => f.dias[d] || 'T';
    for (const d of dias) {
      if (diaSemana(d) !== 1) continue;
      const sem = listarDias(d, addDias(d, 6)).filter((x) => x <= p.data_fim);
      if (sem.some((x) => t(x) === 'F' || t(x) === 'A')) continue;
      const cand = sem.filter((x) => diaSemana(x) !== 0 && t(x) === 'T' && !fer.has(x));
      if (!cand.length) continue;
      // maior cobertura primeiro; desempate rotativo (R11)
      const rot = (fi + Math.floor(diffDias(p.data_inicio, d) / 7)) % 6;
      cand.sort((a, b) => cobertura(b) - cobertura(a) || ((diaSemana(a) + 6 - rot) % 6) - ((diaSemana(b) + 6 - rot) % 6));
      f.dias[cand[0]] = 'F';
    }
    // partial first week (antes da 1ª segunda)
    let streak = 1;
    if (f.ultima_folga_anterior && f.ultima_folga_anterior < p.data_inicio) streak = diffDias(f.ultima_folga_anterior, p.data_inicio) - 1;
    for (let i = 0; i < dias.length; i++) {
      const d = dias[i];
      if (t(d) !== 'T') { streak = 0; continue; }
      if (streak + 1 > maxC) {
        // tenta antecipar a folga da semana para hoje
        const semFim = addDias(d, (7 - diaSemana(d)) % 7);
        const futura = dias.slice(i + 1).find((x) => x <= semFim && f.dias[x] === 'F' && diaSemana(x) !== 0);
        if (futura) delete f.dias[futura];
        f.dias[d] = 'F';
        streak = 0;
        // ao remover a futura, a contagem segue naturalmente
      } else streak++;
    }
  });

  // 4) Folga compensatória de feriado (R06b)
  const prazo = prazoFeriado(p);
  funcs.forEach((f) => {
    for (const d of dias) {
      if (!fer.has(d) || (f.dias[d] || 'T') !== 'T') continue;
      const janela = listarDias(addDias(d, 1), addDias(d, prazo)).filter((x) => x <= p.data_fim && (f.dias[x] || 'T') === 'T' && !fer.has(x) && diaSemana(x) !== 0);
      if (!janela.length) continue;
      janela.sort((a, b) => cobertura(b) - cobertura(a));
      f.dias[janela[0]] = 'FC';
    }
  });

  // preenche T
  funcs.forEach((f) => dias.forEach((d) => { if (!f.dias[d]) f.dias[d] = 'T'; }));

  // 5) Cobertura (R09) — só informa
  if (p.minimo_diario > 0) {
    const falta = dias.filter((d) => cobertura(d) < p.minimo_diario);
    if (falta.length) {
      const sugerido = Math.ceil(p.minimo_diario * 7 / 6) + 1;
      conflitos.push(`R09 Cobertura mínima de ${p.minimo_diario} não atingida em ${falta.length} dia(s) (${falta.slice(0, 6).map(fmtBR).join(', ')}${falta.length > 6 ? '…' : ''}). Sugestão: ter ao menos ${Math.max(sugerido, funcs.length + 1)} funcionários ou reduzir o mínimo diário.`);
    }
  }
  if (!domingoOk && domingos.length) conflitos.push('R05 Sem fundamento para trabalho aos domingos: todos os domingos foram marcados como folga.');
  if (!feriadoOk && fer.size) conflitos.push('R06 Atividade sem autorização para feriados: feriados marcados como folga.');
  const res = validarEscala(p, funcs);
  res.bloqueios.forEach((b) => conflitos.push(b.mensagem));
  return { funcionarios: funcs, conflitos };
}

export function rodapeFundamentos(p: EscalaParams, funcs: EscalaFuncionario[]): string {
  const art386 = funcs.some((f) => f.sexo === 'F' && f.art386_ativo);
  return [
    `Categoria: ${CATEGORIA_LABEL[p.categoria_atividade] || p.categoria_atividade}`,
    `N = ${nEfetivo(p)} domingo(s) (máx. ${nMaxCategoria(p)})`,
    `Art. 386 CLT: ${art386 ? 'ativo' : 'inativo'}`,
    `Domingos/feriados: ${p.fundamento_trabalho_domingo || 'sem fundamento informado'}`,
    p.atividade_anexo_iv && p.atividade_anexo_iv !== 'nenhuma' ? `Anexo IV: ${p.atividade_anexo_iv}` : '',
    p.cct_vigente ? `CCT ${p.cct_registro} ${p.cct_vigencia}`.trim() : '',
    'Fundamentos: art. 67 CLT; Lei 605/1949; art. 7º XV CF; OJ 410 SDI-1 TST',
  ].filter(Boolean).join(' · ');
}
