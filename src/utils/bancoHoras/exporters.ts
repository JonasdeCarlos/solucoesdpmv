import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatHHMM, classifyFaixa, FAIXA_LABEL, competenciaLabel } from './calc';

const FAIXA_RGB: Record<string, [number, number, number]> = {
  verde: [34, 197, 94],
  amarelo: [234, 179, 8],
  laranja: [249, 115, 22],
  vermelho: [239, 68, 68],
};
const FAIXA_BG: Record<string, [number, number, number]> = {
  verde: [220, 252, 231],
  amarelo: [254, 249, 195],
  laranja: [255, 237, 213],
  vermelho: [254, 226, 226],
};

export interface ReportRow {
  empresa: string;
  competencia: string;
  codigo: string;
  nome: string;
  bsaldo: string;
  minutes: number;
  dias: number;
  faixa: string;
  tendencia: string;
  variacao: number | null;
}

export interface ReportMeta {
  titulo: string;
  competenciaLabel?: string;
  empresaLabel?: string;
  kpis?: {
    totalColabs: number;
    saldoConsolidadoMin: number;
    distFaixa: Record<string, number>;
  };
  evolucao?: { competencia: string; saldoMin: number; colabs: number }[];
  topPos?: { nome: string; codigo?: string; minutes: number }[];
  topNeg?: { nome: string; codigo?: string; minutes: number }[];
  logoMonteVerdeDataUrl?: string;
  logoEmpresaDataUrl?: string;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(b);
    });
  } catch {
    return '';
  }
}

export async function loadMonteVerdeLogo(): Promise<string> {
  return fetchAsDataUrl('/images/logo-monte-verde-pdf.png');
}

export function exportCsv(rows: ReportRow[], filename: string) {
  const headers = ['Empresa', 'Competência', 'Código', 'Nome', 'BSALDO', 'Saldo (dias)', 'Faixa', 'Tendência', 'Variação (HH:MM)'];
  const lines = [headers.join(';')];
  for (const r of rows) {
    lines.push([
      `"${r.empresa.replace(/"/g, '""')}"`,
      competenciaLabel(r.competencia),
      r.codigo,
      `"${r.nome.replace(/"/g, '""')}"`,
      r.bsaldo,
      r.dias.toFixed(2).replace('.', ','),
      r.faixa,
      r.tendencia,
      r.variacao != null ? formatHHMM(r.variacao) : '',
    ].join(';'));
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPdf(rows: ReportRow[], meta: ReportMeta, filename: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Cabeçalho: logos + título
  let headerY = 10;
  const logoMV = meta.logoMonteVerdeDataUrl || (await loadMonteVerdeLogo());
  if (logoMV) {
    try { doc.addImage(logoMV, 'PNG', 14, headerY, 36, 18); } catch {}
  }
  if (meta.logoEmpresaDataUrl) {
    try { doc.addImage(meta.logoEmpresaDataUrl, 'PNG', pw - 14 - 36, headerY, 36, 18); } catch {}
  }

  doc.setTextColor(57, 52, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Monte Verde Contabilidade', pw / 2, headerY + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(meta.titulo, pw / 2, headerY + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  const sub = [meta.empresaLabel, meta.competenciaLabel].filter(Boolean).join(' • ');
  if (sub) doc.text(sub, pw / 2, headerY + 17, { align: 'center' });
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, headerY + 21, { align: 'center' });
  doc.setTextColor(0);

  let y = headerY + 28;

  // KPIs
  if (meta.kpis) {
    const k = meta.kpis;
    const boxW = (pw - 28) / 3;
    const boxH = 18;
    const drawBox = (x: number, label: string, value: string) => {
      doc.setDrawColor(220);
      doc.setFillColor(245, 247, 242);
      doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(label, x + 3, y + 5);
      doc.setFontSize(12);
      doc.setTextColor(57, 52, 33);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x + 3, y + 13);
      doc.setFont('helvetica', 'normal');
    };
    drawBox(14, 'COLABORADORES NO MÊS', String(k.totalColabs));
    drawBox(14 + boxW + 2, 'SALDO CONSOLIDADO', formatHHMM(k.saldoConsolidadoMin));
    const dist = `Verde ${k.distFaixa.verde || 0} • Amarelo ${k.distFaixa.amarelo || 0} • Laranja ${k.distFaixa.laranja || 0} • Vermelho ${k.distFaixa.vermelho || 0}`;
    drawBox(14 + (boxW + 2) * 2, 'DISTRIBUIÇÃO POR FAIXA', dist);
    y += boxH + 6;
  }

  // Legenda de cores
  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.text('Legenda de faixas:', 14, y);
  let lx = 40;
  (['verde', 'amarelo', 'laranja', 'vermelho'] as const).forEach((f) => {
    const [r, g, b] = FAIXA_RGB[f];
    doc.setFillColor(r, g, b);
    doc.rect(lx, y - 3, 4, 4, 'F');
    doc.setTextColor(60);
    doc.text(FAIXA_LABEL[f], lx + 6, y);
    lx += 60;
  });
  y += 5;
  doc.setTextColor(0);

  // Memória de cálculo: evolução mensal
  if (meta.evolucao && meta.evolucao.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Memória de cálculo — Evolução do saldo', 'Colaboradores', 'Saldo total (HH:MM)', 'Saldo total (horas)']],
      body: meta.evolucao.map((e) => [
        competenciaLabel(e.competencia),
        String(e.colabs),
        formatHHMM(e.saldoMin),
        (e.saldoMin / 60).toFixed(2).replace('.', ','),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [98, 142, 63] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Top 10 positivos / negativos lado a lado
  if ((meta.topPos && meta.topPos.length > 0) || (meta.topNeg && meta.topNeg.length > 0)) {
    const half = (pw - 28 - 4) / 2;
    const yStart = y;
    if (meta.topPos && meta.topPos.length > 0) {
      autoTable(doc, {
        startY: yStart,
        head: [['#', 'Colaborador', 'Saldo']],
        body: meta.topPos.slice(0, 10).map((t, i) => [String(i + 1), `${t.codigo ? t.codigo + ' — ' : ''}${t.nome}`, formatHHMM(t.minutes)]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [34, 197, 94] },
        margin: { left: 14, right: 14 + half + 4 },
        tableWidth: half,
        didDrawPage: () => {},
      });
    }
    const yAfterPos = (doc as any).lastAutoTable?.finalY ?? yStart;
    if (meta.topNeg && meta.topNeg.length > 0) {
      autoTable(doc, {
        startY: yStart,
        head: [['#', 'Colaborador', 'Saldo']],
        body: meta.topNeg.slice(0, 10).map((t, i) => [String(i + 1), `${t.codigo ? t.codigo + ' — ' : ''}${t.nome}`, formatHHMM(t.minutes)]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: 14 + half + 4, right: 14 },
        tableWidth: half,
      });
    }
    const yAfterNeg = (doc as any).lastAutoTable?.finalY ?? yStart;
    y = Math.max(yAfterPos, yAfterNeg) + 6;
  }

  // Tabela detalhada
  autoTable(doc, {
    startY: y,
    head: [['Empresa', 'Compet.', 'Cód.', 'Colaborador', 'BSALDO', 'Dias', 'Faixa', 'Tend.', 'Variação']],
    body: rows.map((r) => [
      r.empresa,
      competenciaLabel(r.competencia),
      r.codigo,
      r.nome,
      r.bsaldo,
      r.dias.toFixed(2).replace('.', ','),
      r.faixa,
      r.tendencia,
      r.variacao != null ? formatHHMM(r.variacao) : '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [98, 142, 63] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const f = String(data.cell.raw);
        if (FAIXA_BG[f]) data.cell.styles.fillColor = FAIXA_BG[f];
      }
    },
  });

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    'Valores estimativos calculados a partir dos saldos (BSALDO) extraídos automaticamente dos PDFs de cartão ponto. Confira os dados antes de utilizar.',
    14, ph - 6,
  );
  doc.save(filename);
}

export function rowFaixaLabel(minutes: number): string {
  return classifyFaixa(minutes);
}
export const FAIXA_DESC = FAIXA_LABEL;
