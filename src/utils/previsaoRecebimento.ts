import { contarDiasMes } from '@/utils/dsrCalculations';
import type { FeriadoExtendido, FeriadoNacionalOverride } from '@/types/dsr';

export type TipoVerbaPrevisao = 'hora_extra' | 'adicional_noturno' | 'valor_fixo';

export interface VerbaPrevisao {
  id: string;
  descricao: string;
  tipo: TipoVerbaPrevisao;
  /** quantidade em horas centesimais (para tipos por hora) */
  horas: number;
  /** texto digitado HH:MM (apenas UI) */
  horasInput: string;
  /** percentual adicional (50, 100, 20...) */
  percentual: number;
  /** valor fixo mensal (para tipo valor_fixo) */
  valor: number;
  incideDsr: boolean;
}

export interface LinhaPrevisaoVerba {
  id: string;
  descricao: string;
  detalhe: string;
  base: number;
  dsr: number;
  total: number;
}

export interface PrevisaoMes {
  competencia: string;
  diasUteis: number;
  diasDsr: number;
  domingos: number;
  feriadosNaoUteis: number;
  feriadosDetalhe: { data: string; nome: string; escopo: string; contaDsr: boolean }[];
  salarioBase: number;
  verbas: LinhaPrevisaoVerba[];
  totalVerbas: number;
  totalDsr: number;
  totalBruto: number;
  erro?: string;
}

export interface ConfigLocalPrevisao {
  /** município da empresa (para feriados municipais) */
  municipio: string;
  uf: string;
  /** ids de feriados de escopo sindical selecionados */
  sindicaisSelecionados: string[];
}

const norm = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/**
 * Filtra o calendário de feriados conforme o município da empresa e os
 * feriados sindicais expressamente selecionados.
 */
export function filtrarFeriadosPrevisao(
  feriados: FeriadoExtendido[],
  cfg: ConfigLocalPrevisao,
): FeriadoExtendido[] {
  const cidade = norm(cfg.municipio);
  const uf = norm(cfg.uf);
  const sind = new Set(cfg.sindicaisSelecionados || []);

  return feriados.filter((f) => {
    if (f.escopo === 'sindical') return sind.has(f.id);
    if (f.escopo === 'municipal') {
      if (!cidade) return false;
      if (norm(f.municipio) !== cidade) return false;
      if (uf && norm(f.uf) && norm(f.uf) !== uf) return false;
      return true;
    }
    if (f.escopo === 'estadual') return !uf || !norm(f.uf) || norm(f.uf) === uf;
    return true; // nacional / interno
  });
}

/** Converte "7:20" ou "7,33" ou "7.33" em horas centesimais. */
export function parseHoras(input: string): number {
  const s = (input || '').trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const [h, m] = s.split(':');
    const hh = Number(h) || 0;
    const mm = Number(m) || 0;
    return hh + mm / 60;
  }
  return Number(s.replace(',', '.')) || 0;
}

export function formatHoras(horas: number): string {
  const total = Math.round(horas * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function criarVerbaPrevisao(): VerbaPrevisao {
  return {
    id: crypto.randomUUID(),
    descricao: 'Hora extra domingo 100%',
    tipo: 'hora_extra',
    horas: 0,
    horasInput: '',
    percentual: 100,
    valor: 0,
    incideDsr: true,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface OpcoesPrevisao {
  salarioBase: number;
  jornadaMensal: number;
  considerarSabadoUtil: boolean;
}

export function calcularPrevisaoMes(
  competencia: string,
  verbas: VerbaPrevisao[],
  opts: OpcoesPrevisao,
  feriados: FeriadoExtendido[],
  overrides: FeriadoNacionalOverride[],
): PrevisaoMes {
  const cont = contarDiasMes(competencia, feriados, overrides, {
    considerarSabadoUtil: opts.considerarSabadoUtil,
  });
  const valorHora = opts.jornadaMensal > 0 ? opts.salarioBase / opts.jornadaMensal : 0;

  const linhas: LinhaPrevisaoVerba[] = [];
  let totalVerbas = 0;
  let totalDsr = 0;
  let erro: string | undefined;

  for (const v of verbas) {
    let base = 0;
    let detalhe = '';

    if (v.tipo === 'valor_fixo') {
      base = round2(v.valor);
      detalhe = 'Valor informado';
    } else if (v.tipo === 'hora_extra') {
      base = round2(v.horas * valorHora * (1 + v.percentual / 100));
      detalhe = `${formatHoras(v.horas)} × ${valorHora.toFixed(4)} × ${(1 + v.percentual / 100).toFixed(2)}`;
    } else {
      base = round2(v.horas * valorHora * (v.percentual / 100));
      detalhe = `${formatHoras(v.horas)} × ${valorHora.toFixed(4)} × ${(v.percentual / 100).toFixed(2)}`;
    }

    let dsr = 0;
    if (v.incideDsr && base > 0) {
      if (cont.diasUteis === 0) {
        erro = `Competência ${competencia} sem dias úteis — DSR não calculado.`;
      } else {
        dsr = round2((base / cont.diasUteis) * cont.diasDsr);
        detalhe += ` | DSR = (${base.toFixed(2)} ÷ ${cont.diasUteis}) × ${cont.diasDsr}`;
      }
    }

    totalVerbas += base;
    totalDsr += dsr;
    linhas.push({ id: v.id, descricao: v.descricao || '(sem descrição)', detalhe, base, dsr, total: round2(base + dsr) });
  }

  return {
    competencia,
    diasUteis: cont.diasUteis,
    diasDsr: cont.diasDsr,
    salarioBase: round2(opts.salarioBase),
    verbas: linhas,
    totalVerbas: round2(totalVerbas),
    totalDsr: round2(totalDsr),
    totalBruto: round2(opts.salarioBase + totalVerbas + totalDsr),
    erro,
  };
}

export function calcularPrevisaoAno(
  ano: number,
  verbas: VerbaPrevisao[],
  opts: OpcoesPrevisao,
  feriados: FeriadoExtendido[],
  overrides: FeriadoNacionalOverride[],
): PrevisaoMes[] {
  return Array.from({ length: 12 }, (_, i) =>
    calcularPrevisaoMes(`${ano}-${String(i + 1).padStart(2, '0')}`, verbas, opts, feriados, overrides),
  );
}

export function exportarCsvPrevisao(meses: PrevisaoMes[]): string {
  const linhas = ['Competência;DU;Dias DSR;Salário base;Verbas;DSR;Bruto previsto'];
  meses.forEach((m) => {
    linhas.push(
      [
        m.competencia,
        m.diasUteis,
        m.diasDsr,
        m.salarioBase.toFixed(2).replace('.', ','),
        m.totalVerbas.toFixed(2).replace('.', ','),
        m.totalDsr.toFixed(2).replace('.', ','),
        m.totalBruto.toFixed(2).replace('.', ','),
      ].join(';'),
    );
  });
  return linhas.join('\n');
}
