import { type FeriadoExtendido, type FeriadoNacionalOverride, type DsrVerbaDetalhe, type VerbaDsr, type ProvisionEntry, type DsrMonthlyResult } from '@/types/dsr';

// ── Páscoa (Meeus/Jones/Butcher) ──
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface FeriadoNacionalCalculado {
  chave: string;
  nome: string;
  data: string; // YYYY-MM-DD
}

export function feriadosNacionaisDoAno(ano: number): FeriadoNacionalCalculado[] {
  const pascoa = calcularPascoa(ano);
  return [
    { chave: 'confraternizacao', nome: 'Confraternização Universal', data: fmtDate(new Date(ano, 0, 1)) },
    { chave: 'tiradentes', nome: 'Tiradentes', data: fmtDate(new Date(ano, 3, 21)) },
    { chave: 'trabalho', nome: 'Dia do Trabalho', data: fmtDate(new Date(ano, 4, 1)) },
    { chave: 'independencia', nome: 'Independência', data: fmtDate(new Date(ano, 8, 7)) },
    { chave: 'aparecida', nome: 'N. Sra. Aparecida', data: fmtDate(new Date(ano, 9, 12)) },
    { chave: 'finados', nome: 'Finados', data: fmtDate(new Date(ano, 10, 2)) },
    { chave: 'republica', nome: 'Proclamação da República', data: fmtDate(new Date(ano, 10, 15)) },
    { chave: 'consciencia_negra', nome: 'Consciência Negra', data: fmtDate(new Date(ano, 10, 20)) },
    { chave: 'natal', nome: 'Natal', data: fmtDate(new Date(ano, 11, 25)) },
    { chave: 'carnaval_seg', nome: 'Segunda de Carnaval', data: fmtDate(addDays(pascoa, -48)) },
    { chave: 'carnaval_ter', nome: 'Terça de Carnaval', data: fmtDate(addDays(pascoa, -47)) },
    { chave: 'sexta_santa', nome: 'Sexta-feira Santa', data: fmtDate(addDays(pascoa, -2)) },
    { chave: 'pascoa', nome: 'Páscoa', data: fmtDate(pascoa) },
    { chave: 'corpus_christi', nome: 'Corpus Christi', data: fmtDate(addDays(pascoa, 60)) },
  ];
}

export interface ContagemDiasMes {
  diasUteis: number;
  diasDsr: number;
  domingos: number;
  feriadosNaoUteis: number;
  feriadosListados: { data: string; nome: string; escopo: string; contaDsr: boolean }[];
}

export interface OpcoesContagem {
  considerarSabadoUtil?: boolean;
  considerarDomingoDsr?: boolean;
  considerarFeriadoDsr?: boolean;
}

/**
 * Conta dias úteis e DSR de um mês.
 * @param competencia formato YYYY-MM
 */
export function contarDiasMes(
  competencia: string,
  feriadosMunicipais: FeriadoExtendido[],
  overridesNacionais: FeriadoNacionalOverride[],
  opts: OpcoesContagem = {}
): ContagemDiasMes {
  const considerarSabadoUtil = opts.considerarSabadoUtil ?? true;
  const considerarDomingoDsr = opts.considerarDomingoDsr ?? true;
  const considerarFeriadoDsr = opts.considerarFeriadoDsr ?? true;

  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const totalDias = new Date(ano, mes, 0).getDate();

  // Indexar feriados nacionais ativos (não-pontoFacultativo) do ano
  const nacionais = feriadosNacionaisDoAno(ano);
  const overrideMap = new Map(overridesNacionais.filter((o) => o.ano === ano).map((o) => [o.chave, o]));
  const nacionaisAtivos = nacionais.filter((f) => !overrideMap.get(f.chave)?.pontoFacultativo);

  // Indexar feriados municipais que contam como dia não útil dentro do mês
  const municipaisMes = feriadosMunicipais.filter((f) => {
    const [fAno, fMes] = f.data.split('-');
    return Number(fAno) === ano && Number(fMes) === mes;
  });

  let diasUteis = 0;
  let domingos = 0;
  let diasDsr = 0;
  let feriadosNaoUteis = 0;
  const feriadosListados: ContagemDiasMes['feriadosListados'] = [];

  for (let dia = 1; dia <= totalDias; dia++) {
    const d = new Date(ano, mes - 1, dia);
    const dow = d.getDay(); // 0=dom, 6=sab
    const dataStr = fmtDate(d);

    // Verificar feriados (nacionais ativos + municipais que contam como não útil)
    const feriadoNacional = nacionaisAtivos.find((f) => f.data === dataStr);
    const feriadoMunicipal = municipaisMes.find((f) => f.data === dataStr && f.contaDiaNaoUtil);

    let contaComoFeriadoNaoUtil = false;
    let contaFeriadoComoDsr = false;
    if (feriadoNacional) {
      contaComoFeriadoNaoUtil = true;
      contaFeriadoComoDsr = true;
      feriadosListados.push({ data: dataStr, nome: feriadoNacional.nome, escopo: 'nacional', contaDsr: true });
    } else if (feriadoMunicipal) {
      contaComoFeriadoNaoUtil = true;
      contaFeriadoComoDsr = feriadoMunicipal.contaDsr;
      feriadosListados.push({
        data: dataStr,
        nome: feriadoMunicipal.nome,
        escopo: feriadoMunicipal.escopo,
        contaDsr: feriadoMunicipal.contaDsr,
      });
    }

    if (dow === 0) {
      domingos++;
      // Domingo nunca é dia útil
      if (considerarDomingoDsr) diasDsr++;
      continue;
    }

    if (contaComoFeriadoNaoUtil) {
      feriadosNaoUteis++;
      // Feriado nunca é dia útil
      if (considerarFeriadoDsr && contaFeriadoComoDsr) diasDsr++;
      continue;
    }

    if (dow === 6 && !considerarSabadoUtil) {
      // sábado não conta como útil nem como DSR
      continue;
    }

    diasUteis++;
  }

  return { diasUteis, diasDsr, domingos, feriadosNaoUteis, feriadosListados };
}

export function baseDoLancamento(e: ProvisionEntry): number {
  if (e.tipoLancamento === 'qtd_x_valor') {
    return (Number(e.quantidade) || 0) * (Number(e.valorUnitario) || 0);
  }
  return Number(e.valor) || 0;
}

/**
 * Calcula a apuração DSR de uma competência.
 */
export function apurarDsr(
  empresaNome: string,
  competencia: string,
  verbas: VerbaDsr[],
  lancamentos: ProvisionEntry[],
  feriadosMunicipais: FeriadoExtendido[],
  overridesNacionais: FeriadoNacionalOverride[],
  opts: OpcoesContagem = {}
): { resultado: DsrMonthlyResult; erro?: string } {
  // Agrupar lançamentos por verba (somar bases)
  const verbaMap = new Map(verbas.map((v) => [v.id, v]));
  // Agrupar por colaborador+verba para separar o cálculo individualmente
  const baseMap = new Map<string, { verbaId: string; colaborador: string; base: number }>();
  lancamentos
    .filter((l) => l.competencia === competencia && (!empresaNome || l.empresaNome === empresaNome))
    .forEach((l) => {
      const colab = (l.colaborador || '').trim() || '— sem colaborador —';
      const key = `${l.verbaId}::${colab}`;
      const cur = baseMap.get(key);
      if (cur) {
        cur.base += baseDoLancamento(l);
      } else {
        baseMap.set(key, { verbaId: l.verbaId, colaborador: colab, base: baseDoLancamento(l) });
      }
    });

  // Para cada verba com base > 0, calcular contagem específica (cada verba pode customizar domingo/feriado)
  const detalhes: DsrVerbaDetalhe[] = [];
  let totalBase = 0;
  let totalDsr = 0;
  let erroGeral: string | undefined;

  // Contagem global (para exibição no header da apuração)
  const contagemGlobal = contarDiasMes(competencia, feriadosMunicipais, overridesNacionais, opts);

  for (const { verbaId, colaborador, base } of baseMap.values()) {
    const verba = verbaMap.get(verbaId);
    if (!verba) continue;
    totalBase += base;

    if (!verba.incideDsr) {
      detalhes.push({
        verbaId,
        codigo: verba.codigo,
        nome: verba.nome,
        colaborador,
        base,
        diasUteis: contagemGlobal.diasUteis,
        diasDsr: 0,
        dsr: 0,
        total: base,
        formula: 'Verba não incide DSR',
      });
      continue;
    }

    // Contagem com regras da verba
    const cont = contarDiasMes(competencia, feriadosMunicipais, overridesNacionais, {
      ...opts,
      considerarDomingoDsr: verba.consideraDomingoDsr,
      considerarFeriadoDsr: verba.consideraFeriadoDsr,
    });

    if (cont.diasUteis === 0) {
      erroGeral = `Mês ${competencia} possui 0 dias úteis. Cálculo bloqueado.`;
      detalhes.push({
        verbaId,
        codigo: verba.codigo,
        nome: verba.nome,
        colaborador,
        base,
        diasUteis: 0,
        diasDsr: cont.diasDsr,
        dsr: 0,
        total: base,
        formula: 'ERRO: 0 dias úteis no mês',
      });
      continue;
    }

    const dsr = (base / cont.diasUteis) * cont.diasDsr;
    totalDsr += dsr;
    detalhes.push({
      verbaId,
      codigo: verba.codigo,
      nome: verba.nome,
      colaborador,
      base,
      diasUteis: cont.diasUteis,
      diasDsr: cont.diasDsr,
      dsr,
      total: base + dsr,
      formula: `DSR = (${base.toFixed(2)} ÷ ${cont.diasUteis}) × ${cont.diasDsr} = ${dsr.toFixed(2)}`,
    });
  }

  return {
    resultado: {
      empresaNome,
      competencia,
      diasUteis: contagemGlobal.diasUteis,
      diasDsr: contagemGlobal.diasDsr,
      domingos: contagemGlobal.domingos,
      feriadosNaoUteis: contagemGlobal.feriadosNaoUteis,
      detalheVerbas: detalhes,
      totalBase,
      totalDsr,
    },
    erro: erroGeral,
  };
}

export function exportarCsvApuracao(r: DsrMonthlyResult): string {
  const linhas: string[] = [];
  linhas.push(`Apuração DSR;Competência ${r.competencia};Empresa ${r.empresaNome || '-'}`);
  linhas.push(`Dias úteis;${r.diasUteis};Dias DSR;${r.diasDsr};Domingos;${r.domingos};Feriados não úteis;${r.feriadosNaoUteis}`);
  linhas.push('');
  linhas.push('Código;Verba;Colaborador;Base;DU;DSR(dias);DSR(R$);Total;Memória');
  r.detalheVerbas.forEach((v) => {
    linhas.push(
      `${v.codigo};${v.nome};${v.colaborador || ''};${v.base.toFixed(2)};${v.diasUteis};${v.diasDsr};${v.dsr.toFixed(2)};${v.total.toFixed(2)};${v.formula}`,
    );
  });
  linhas.push('');
  linhas.push(`Total base;${r.totalBase.toFixed(2)}`);
  linhas.push(`Total DSR;${r.totalDsr.toFixed(2)}`);
  linhas.push(`Total geral;${(r.totalBase + r.totalDsr).toFixed(2)}`);
  return linhas.join('\n');
}