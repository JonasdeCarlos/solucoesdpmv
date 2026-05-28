import jsPDF from 'jspdf';
import type { Holiday, OfficeBranding } from './types';

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