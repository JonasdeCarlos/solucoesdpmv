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
    domingos: cont.domingos,
    feriadosNaoUteis: cont.feriadosNaoUteis,
    feriadosDetalhe: cont.feriadosListados,
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

const ESCOPO_LABEL: Record<string, string> = {
  nacional: 'Feriado nacional',
  estadual: 'Feriado estadual',
  municipal: 'Feriado municipal',
  sindical: 'Feriado sindical / convenção',
  interno: 'Feriado interno',
};

const fmtBRLrep = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};
const fmtComp = (c: string) => {
  const [a, m] = c.split('-');
  return `${m}/${a}`;
};

/** Relatório imprimível com o detalhamento do DSR de cada mês. */
export function gerarHtmlPrevisao(
  meses: PrevisaoMes[],
  cfg: ConfigLocalPrevisao,
  opts: OpcoesPrevisao,
  logoUrl?: string,
): string {
  const local = [cfg.municipio, cfg.uf].filter(Boolean).join(' / ') || 'não informado';

  const blocos = meses
    .map((m) => {
      const feriados = m.feriadosDetalhe.length
        ? m.feriadosDetalhe
            .map(
              (f) => `<tr><td>${fmtData(f.data)}</td><td>${f.nome}</td><td>${
                ESCOPO_LABEL[f.escopo] || f.escopo
              }</td><td>${f.contaDsr ? 'Sim' : 'Não'}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="4" class="muted">Sem feriados no mês</td></tr>';

      const verbas = m.verbas
        .map(
          (l) =>
            `<tr><td>${l.descricao}<div class="muted">${l.detalhe}</div></td><td class="r">${fmtBRLrep(
              l.base,
            )}</td><td class="r">${fmtBRLrep(l.dsr)}</td><td class="r">${fmtBRLrep(l.total)}</td></tr>`,
        )
        .join('');

      return `
      <section class="mes">
        <h2>Competência ${fmtComp(m.competencia)}</h2>
        <div class="cards">
          <div><span>Dias úteis</span><b>${m.diasUteis}</b></div>
          <div><span>Domingos</span><b>${m.domingos}</b></div>
          <div><span>Feriados (não úteis)</span><b>${m.feriadosNaoUteis}</b></div>
          <div><span>Dias de DSR</span><b>${m.diasDsr}</b></div>
        </div>
        <h3>Composição dos dias de DSR</h3>
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Conta DSR</th></tr></thead>
          <tbody>
            <tr><td>—</td><td>Domingos do mês</td><td>Repouso semanal</td><td>Sim (${m.domingos})</td></tr>
            ${feriados}
          </tbody>
        </table>
        <h3>Verbas e reflexos</h3>
        <table>
          <thead><tr><th>Verba</th><th class="r">Valor</th><th class="r">Reflexo DSR</th><th class="r">Total</th></tr></thead>
          <tbody>
            <tr><td>Salário base</td><td class="r">${fmtBRLrep(m.salarioBase)}</td><td class="r">—</td><td class="r">${fmtBRLrep(
              m.salarioBase,
            )}</td></tr>
            ${verbas}
            <tr class="tot"><td>Bruto previsto</td><td class="r">${fmtBRLrep(
              m.salarioBase + m.totalVerbas,
            )}</td><td class="r">${fmtBRLrep(m.totalDsr)}</td><td class="r">${fmtBRLrep(m.totalBruto)}</td></tr>
          </tbody>
        </table>
        ${m.erro ? `<p class="erro">⚠️ ${m.erro}</p>` : ''}
      </section>`;
    })
    .join('');

  const totalAno = meses.reduce((a, m) => a + m.totalBruto, 0);

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Previsão de recebimento</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#393421;margin:24px;font-size:12px}
  header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #628E3F;padding-bottom:12px;margin-bottom:16px}
  header img{height:56px}
  h1{font-size:18px;margin:0;color:#628E3F}
  h2{font-size:14px;margin:18px 0 6px;color:#628E3F;border-bottom:1px solid #E1E8F2;padding-bottom:4px}
  h3{font-size:12px;margin:12px 0 4px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th,td{border:1px solid #E1E8F2;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#E1E8F2}
  .r{text-align:right}
  .muted{color:#777;font-size:10px}
  .tot{background:#f3f6ef;font-weight:bold}
  .cards{display:flex;gap:8px;margin:8px 0}
  .cards div{flex:1;border:1px solid #E1E8F2;border-radius:6px;padding:6px;text-align:center}
  .cards span{display:block;font-size:10px;color:#777}
  .cards b{font-size:16px;color:#628E3F}
  .erro{color:#b00}
  .mes{page-break-inside:avoid}
  footer{margin-top:16px;border-top:1px solid #E1E8F2;padding-top:8px;font-size:10px;color:#777}
</style></head><body>
<header>${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ''}<div>
  <h1>Previsão de recebimento — detalhamento do DSR</h1>
  <div class="muted">Município da empresa: ${local} · Salário base ${fmtBRLrep(
    opts.salarioBase,
  )} · Jornada mensal ${opts.jornadaMensal}h · Sábado ${
    opts.considerarSabadoUtil ? 'útil' : 'não útil'
  }</div>
</div></header>
${blocos}
${meses.length > 1 ? `<h2>Total do período: ${fmtBRLrep(totalAno)}</h2>` : ''}
<footer>Gerado em ${new Date().toLocaleString('pt-BR')}</footer>
</body></html>`;
}

export function exportarCsvPrevisao(meses: PrevisaoMes[]): string {
  const linhas = ['Competência;DU;Domingos;Feriados;Dias DSR;Salário base;Verbas;DSR;Bruto previsto'];
  meses.forEach((m) => {
    linhas.push(
      [
        m.competencia,
        m.diasUteis,
        m.domingos,
        m.feriadosNaoUteis,
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
