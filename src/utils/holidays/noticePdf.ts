import jsPDF from 'jspdf';
import type { Holiday, OfficeBranding } from './types';
import { TIPO_LABELS, TIPO_COLORS, type HolidayTipo } from './types';

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fmtBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    return { dataUrl, w: img.width, h: img.height };
  } catch { return null; }
}

export async function generateNoticePdf(opts: {
  title: string;
  body: string;
  holidays: Holiday[];
  branding: OfficeBranding | null;
}): Promise<Blob> {
  const { title, body, holidays, branding } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const primary = hexToRgb(branding?.primary_color || '#628E3F');
  const secondary = hexToRgb(branding?.secondary_color || '#E1E8F2');
  const textCol = hexToRgb(branding?.text_color || '#393421');

  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(secondary[0], secondary[1], secondary[2]);
  doc.rect(0, 28, W, 6, 'F');

  if (branding?.logo_url) {
    const img = await loadImage(branding.logo_url);
    if (img) {
      const ratio = img.w / img.h;
      const h = 18;
      const w = h * ratio;
      try { doc.addImage(img.dataUrl, 'PNG', 12, 5, w, h); } catch { /* noop */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(branding?.office_name || 'Monte Verde Contabilidade', W - 12, 18, { align: 'right' });

  doc.setTextColor(textCol[0], textCol[1], textCol[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, 12, 50, { maxWidth: W - 24 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(body, W - 24);
  doc.text(lines, 12, 64);

  let y = 64 + lines.length * 5 + 6;
  if (holidays.length > 0 && y < H - 50) {
    doc.setFillColor(secondary[0], secondary[1], secondary[2]);
    doc.rect(12, y, W - 24, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(textCol[0], textCol[1], textCol[2]);
    doc.text('Data', 14, y + 5);
    doc.text('Evento', 50, y + 5);
    doc.text('Tipo', W - 50, y + 5);
    y += 10;
    doc.setFont('helvetica', 'normal');
    for (const h of holidays) {
      if (y > H - 30) { doc.addPage(); y = 20; }
      doc.text(fmtBR(h.data), 14, y);
      const nameLines = doc.splitTextToSize(h.nome, 110);
      doc.text(nameLines, 50, y);
      doc.text(h.is_optional ? 'Ponto Fac.' : 'Feriado', W - 50, y);
      y += Math.max(6, nameLines.length * 5);
    }
  }

  const c = branding?.contacts || {};
  const footerY = H - 18;
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, footerY, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  const footerParts = [c.phone, c.email, c.site, c.address].filter(Boolean) as string[];
  if (footerParts.length) doc.text(footerParts.join(' • '), W / 2, footerY + 10, { align: 'center' });
  else doc.text(branding?.office_name || 'Monte Verde Contabilidade', W / 2, footerY + 10, { align: 'center' });

  return doc.output('blob');
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export async function generateHolidayTablePdf(opts: {
  year: number;
  municipios: string[];
  holidays: Holiday[];
  branding: OfficeBranding | null;
}): Promise<Blob> {
  const { year, municipios, holidays, branding } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const primary = hexToRgb(branding?.primary_color || '#628E3F');
  const secondary = hexToRgb(branding?.secondary_color || '#E1E8F2');
  const textCol = hexToRgb(branding?.text_color || '#393421');

  // Header band
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(secondary[0], secondary[1], secondary[2]);
  doc.rect(0, 32, W, 5, 'F');

  if (branding?.logo_url) {
    const img = await loadImage(branding.logo_url);
    if (img) {
      const ratio = img.w / img.h;
      const h = 22; const w = h * ratio;
      try { doc.addImage(img.dataUrl, 'PNG', 10, 5, w, h); } catch { /* noop */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`Calendário de Feriados ${year}`, W - 10, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const mLabel = municipios.length ? municipios.join(' · ') : 'Todos os municípios';
  doc.text(mLabel.length > 80 ? mLabel.slice(0, 78) + '…' : mLabel, W - 10, 24, { align: 'right' });
  doc.text(branding?.office_name || 'Monte Verde Contabilidade', W - 10, 29, { align: 'right' });

  // Sort holidays by date
  const sorted = [...holidays].sort((a, b) => a.data.localeCompare(b.data));

  let y = 46;
  doc.setTextColor(textCol[0], textCol[1], textCol[2]);

  // Legend
  doc.setFontSize(8);
  let lx = 10;
  for (const t of Object.keys(TIPO_LABELS) as HolidayTipo[]) {
    const c = hexToRgb(TIPO_COLORS[t]);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(lx + 1.5, y - 1, 1.4, 'F');
    doc.setTextColor(textCol[0], textCol[1], textCol[2]);
    doc.text(TIPO_LABELS[t], lx + 4, y);
    lx += doc.getTextWidth(TIPO_LABELS[t]) + 10;
  }
  y += 4;

  // Group by month
  const byMonth: Record<number, Holiday[]> = {};
  for (let i = 1; i <= 12; i++) byMonth[i] = [];
  for (const h of sorted) {
    const m = Number(h.data.slice(5, 7));
    if (byMonth[m]) byMonth[m].push(h);
  }

  const ensureSpace = (need: number) => {
    if (y + need > H - 25) {
      doc.addPage();
      y = 20;
    }
  };

  for (let m = 1; m <= 12; m++) {
    const items = byMonth[m];
    if (!items.length) continue;
    ensureSpace(14);
    // Month band
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(10, y, W - 20, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${MONTHS[m - 1]} / ${year}`, 13, y + 5);
    doc.text(String(items.length), W - 13, y + 5, { align: 'right' });
    y += 9;

    // Column headers
    doc.setFillColor(secondary[0], secondary[1], secondary[2]);
    doc.rect(10, y, W - 20, 6, 'F');
    doc.setTextColor(textCol[0], textCol[1], textCol[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Data', 13, y + 4);
    doc.text('Dia', 32, y + 4);
    doc.text('Evento', 52, y + 4);
    doc.text('Tipo', 130, y + 4);
    doc.text('Município/Abrangência', 158, y + 4);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let zebra = false;
    for (const h of items) {
      ensureSpace(7);
      if (zebra) {
        doc.setFillColor(248, 248, 248);
        doc.rect(10, y - 4, W - 20, 6, 'F');
      }
      const c = hexToRgb(TIPO_COLORS[h.tipo as HolidayTipo] || '#999999');
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(11.5, y - 1, 1.2, 'F');
      doc.setTextColor(textCol[0], textCol[1], textCol[2]);
      doc.text(fmtBR(h.data), 14, y);
      doc.text(weekdayOf(h.data), 32, y);
      const nome = h.nome + (h.is_optional ? '  (Ponto Facultativo)' : '');
      doc.text(doc.splitTextToSize(nome, 75)[0] || nome, 52, y);
      doc.text(TIPO_LABELS[h.tipo as HolidayTipo] || h.tipo, 130, y);
      const scope = h.municipio || h.uf || (h.scope_type === 'todos' ? 'Nacional' : h.scope_type);
      doc.text(doc.splitTextToSize(String(scope || '—'), 50)[0] || '—', 158, y);
      y += 6;
      zebra = !zebra;
    }
    y += 3;
  }

  // Footer on each page
  const totalPages = (doc as any).internal.getNumberOfPages();
  const c = branding?.contacts || {};
  const footerParts = [c.phone, c.email, c.site, c.address].filter(Boolean) as string[];
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, H - 14, W, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(footerParts.join(' • ') || (branding?.office_name || ''), W / 2, H - 8, { align: 'center' });
    doc.text(`Página ${p} de ${totalPages}`, W - 10, H - 3, { align: 'right' });
  }

  return doc.output('blob');
}