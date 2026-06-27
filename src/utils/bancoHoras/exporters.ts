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
  distMes?: { competencia: string; verde: number; amarelo: number; laranja: number; vermelho: number }[];
  topPos?: { nome: string; codigo?: string; minutes: number }[];
  topNeg?: { nome: string; codigo?: string; minutes: number }[];
  logoMonteVerdeDataUrl?: string;
  logoEmpresaDataUrl?: string;
  periodo?: {
    inicio: string;
    fim: string;
    dias: number;
    faixa: 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'alerta';
  };
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

function drawBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  title: string,
  data: { label: string; value: number }[],
  color: [number, number, number],
  valueSuffix = '',
) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(57, 52, 33);
  doc.text(title, x, y);
  const cy = y + 3, ch = h - 3;
  const padL = 12, padB = 10, padT = 4, padR = 2;
  const plotX = x + padL, plotY = cy + padT;
  const plotW = w - padL - padR, plotH = ch - padT - padB;
  doc.setDrawColor(200); doc.setLineWidth(0.2);
  doc.line(plotX, plotY, plotX, plotY + plotH);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120);
  for (let i = 0; i <= 4; i++) {
    const v = max * (i / 4);
    const ty = plotY + plotH - (i / 4) * plotH;
    doc.setDrawColor(235); doc.line(plotX, ty, plotX + plotW, ty);
    doc.text(`${v.toFixed(0)}${valueSuffix}`, plotX - 1, ty + 1.2, { align: 'right' });
  }
  const n = data.length || 1;
  const slot = plotW / n;
  const bw = slot * 0.7;
  const gap = slot * 0.3;
  data.forEach((d, i) => {
    const bx = plotX + i * slot + gap / 2;
    const bh = (Math.abs(d.value) / max) * plotH;
    const by = plotY + plotH - bh;
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(bx, by, bw, bh, 'F');
    doc.setTextColor(80); doc.setFontSize(6);
    doc.text(d.label, bx + bw / 2, plotY + plotH + 3, { align: 'center' });
  });
  doc.setTextColor(0);
}

function drawStackedBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  title: string,
  data: { label: string; verde: number; amarelo: number; laranja: number; vermelho: number }[],
) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(57, 52, 33);
  doc.text(title, x, y);
  const cy = y + 3, ch = h - 3;
  const padL = 12, padB = 10, padT = 4, padR = 2;
  const plotX = x + padL, plotY = cy + padT;
  const plotW = w - padL - padR, plotH = ch - padT - padB;
  doc.setDrawColor(200); doc.setLineWidth(0.2);
  doc.line(plotX, plotY, plotX, plotY + plotH);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
  const max = Math.max(1, ...data.map((d) => d.verde + d.amarelo + d.laranja + d.vermelho));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120);
  for (let i = 0; i <= 4; i++) {
    const v = max * (i / 4);
    const ty = plotY + plotH - (i / 4) * plotH;
    doc.setDrawColor(235); doc.line(plotX, ty, plotX + plotW, ty);
    doc.text(v.toFixed(0), plotX - 1, ty + 1.2, { align: 'right' });
  }
  const n = data.length || 1;
  const slot = plotW / n;
  const bw = slot * 0.7;
  const gap = slot * 0.3;
  const order = ['verde', 'amarelo', 'laranja', 'vermelho'] as const;
  data.forEach((d, i) => {
    const bx = plotX + i * slot + gap / 2;
    let acc = 0;
    order.forEach((f) => {
      const val = (d as any)[f] as number;
      if (val <= 0) return;
      const segH = (val / max) * plotH;
      const by = plotY + plotH - acc - segH;
      const [r, g, b] = FAIXA_RGB[f];
      doc.setFillColor(r, g, b);
      doc.rect(bx, by, bw, segH, 'F');
      acc += segH;
    });
    doc.setTextColor(80); doc.setFontSize(6);
    doc.text(d.label, bx + bw / 2, plotY + plotH + 3, { align: 'center' });
  });
  doc.setTextColor(0);
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

function detectFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  if (!m) return 'PNG';
  const t = m[1].toLowerCase();
  if (t === 'jpg' || t === 'jpeg') return 'JPEG';
  if (t === 'webp') return 'WEBP';
  return 'PNG';
}

export async function exportPdf(rows: ReportRow[], meta: ReportMeta, _filename?: string): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Cabeçalho: Monte Verde à esquerda, empresa à direita, título no centro
  const headerY = 8;
  // Monte Verde — logo maior e proporcional (~1.76:1)
  const mvW = 52;
  const mvH = 28;
  // Logo da empresa — mesma altura para simetria visual
  const empH = 24;
  const empMaxW = 52;
  const logoMV = meta.logoMonteVerdeDataUrl || (await loadMonteVerdeLogo());
  if (logoMV) {
    try { doc.addImage(logoMV, detectFormat(logoMV), 14, headerY, mvW, mvH); } catch {}
  }
  if (meta.logoEmpresaDataUrl) {
    try {
      // mantém aspecto do logo do cliente; cabe dentro de empMaxW x empH
      const props = (doc as any).getImageProperties?.(meta.logoEmpresaDataUrl);
      let w = empMaxW, h = empH;
      if (props && props.width && props.height) {
        const ratio = props.width / props.height;
        if (ratio >= empMaxW / empH) { w = empMaxW; h = empMaxW / ratio; }
        else { h = empH; w = empH * ratio; }
      }
      const x = pw - 14 - w;
      const y0 = headerY + (empH - h) / 2;
      doc.addImage(meta.logoEmpresaDataUrl, detectFormat(meta.logoEmpresaDataUrl), x, y0, w, h);
    } catch {}
  }

  doc.setTextColor(57, 52, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(meta.titulo, pw / 2, headerY + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const sub = [meta.empresaLabel, meta.competenciaLabel].filter(Boolean).join(' • ');
  if (sub) doc.text(sub, pw / 2, headerY + 18, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pw / 2, headerY + 23, { align: 'center' });
  doc.setTextColor(0);

  let y = headerY + mvH + 4;

  // KPIs
  if (meta.kpis) {
    const k = meta.kpis;
    const boxW = (pw - 28) / 3;
    const boxH = 26;
    // Caixa 1 — colaboradores
    doc.setDrawColor(220); doc.setFillColor(245, 247, 242);
    doc.roundedRect(14, y, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7); doc.setTextColor(100);
    doc.text('COLABORADORES NO MÊS', 17, y + 5);
    doc.setFontSize(14); doc.setTextColor(57, 52, 33); doc.setFont('helvetica', 'bold');
    doc.text(String(k.totalColabs), 17, y + 15);
    doc.setFont('helvetica', 'normal');
    // Caixa 2 — saldo consolidado
    const x2 = 14 + boxW + 2;
    doc.setDrawColor(220); doc.setFillColor(245, 247, 242);
    doc.roundedRect(x2, y, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7); doc.setTextColor(100);
    doc.text('SALDO CONSOLIDADO', x2 + 3, y + 5);
    doc.setFontSize(14); doc.setTextColor(57, 52, 33); doc.setFont('helvetica', 'bold');
    doc.text(formatHHMM(k.saldoConsolidadoMin), x2 + 3, y + 15);
    doc.setFont('helvetica', 'normal');
    // Caixa 3 — distribuição por faixa (uma linha por faixa para caber no box)
    const x3 = 14 + (boxW + 2) * 2;
    doc.setDrawColor(220); doc.setFillColor(245, 247, 242);
    doc.roundedRect(x3, y, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7); doc.setTextColor(100);
    doc.text('DISTRIBUIÇÃO POR FAIXA', x3 + 3, y + 5);
    doc.setFontSize(7); doc.setTextColor(60);
    const faixas = ['verde', 'amarelo', 'laranja', 'vermelho'] as const;
    const total = (k.distFaixa.verde || 0) + (k.distFaixa.amarelo || 0) + (k.distFaixa.laranja || 0) + (k.distFaixa.vermelho || 0);
    faixas.forEach((f, i) => {
      const cy = y + 10 + i * 4;
      const [r, g, b] = FAIXA_RGB[f];
      doc.setFillColor(r, g, b);
      doc.rect(x3 + 3, cy - 2.5, 2.8, 2.8, 'F');
      doc.setTextColor(60);
      const n = k.distFaixa[f] || 0;
      const pct = total ? ` (${Math.round((n * 100) / total)}%)` : '';
      doc.text(`${FAIXA_LABEL[f]}: ${n}${pct}`, x3 + 7.5, cy);
    });
    doc.setTextColor(0);
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

  // Gráficos visuais — Evolução e Distribuição por faixa/mês
  if ((meta.evolucao && meta.evolucao.length > 0) || (meta.distMes && meta.distMes.length > 0)) {
    const chartH = 55;
    if (y + chartH > ph - 20) { doc.addPage(); y = 14; }
    const half = (pw - 28 - 4) / 2;
    if (meta.evolucao && meta.evolucao.length > 0) {
      const evoData = meta.evolucao.map((e) => ({
        label: competenciaLabel(e.competencia),
        value: Math.round((e.saldoMin / 60) * 10) / 10,
      }));
      drawBarChart(doc, 14, y, half, chartH, 'Evolução do saldo total (horas)', evoData, [98, 142, 63], 'h');
    }
    if (meta.distMes && meta.distMes.length > 0) {
      const dmData = meta.distMes.map((d) => ({
        label: d.competencia.includes('/') ? d.competencia : competenciaLabel(d.competencia),
        verde: d.verde, amarelo: d.amarelo, laranja: d.laranja, vermelho: d.vermelho,
      }));
      drawStackedBarChart(doc, 14 + half + 4, y, half, chartH, 'Distribuição por faixa / mês', dmData);
    }
    y += chartH + 8;
  }

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

  // Top 10 positivos / negativos lado a lado, com legenda explicativa
  if ((meta.topPos && meta.topPos.length > 0) || (meta.topNeg && meta.topNeg.length > 0)) {
    const half = (pw - 28 - 4) / 2;
    // Reserva espaço para a seção inteira; se não couber, vai para nova página
    const sectionH = 14 + 6 * Math.max(meta.topPos?.length || 0, meta.topNeg?.length || 0) + 6;
    if (y + sectionH > ph - 20) { doc.addPage(); y = 14; }
    // Título da seção
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(57, 52, 33);
    doc.text('Ranking de colaboradores — Top 10 por saldo do mês', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      'Lista os 10 colaboradores com maior saldo credor (horas a receber/folgar) e os 10 com maior saldo devedor (horas a compensar).',
      14, y + 4,
    );
    doc.setTextColor(0);
    // Subtítulos das duas colunas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 197, 94);
    doc.text('Top 10 — Saldo positivo (credor)', 14, y + 12);
    doc.setTextColor(239, 68, 68);
    doc.text('Top 10 — Saldo negativo (devedor)', 14 + half + 4, y + 12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    const yStart = y + 14;
    if (meta.topPos && meta.topPos.length > 0) {
      autoTable(doc, {
        startY: yStart,
        head: [['#', 'Colaborador', 'Saldo']],
        body: meta.topPos.slice(0, 10).map((t, i) => [String(i + 1), `${t.codigo ? t.codigo + ' — ' : ''}${t.nome}`, formatHHMM(t.minutes)]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [34, 197, 94] },
        margin: { left: 14, right: 14 + half + 4 },
        tableWidth: half,
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
  return doc.output('arraybuffer') as ArrayBuffer;
}

export function rowFaixaLabel(minutes: number): string {
  return classifyFaixa(minutes);
}
export const FAIXA_DESC = FAIXA_LABEL;
