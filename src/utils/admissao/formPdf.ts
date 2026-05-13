import jsPDF from 'jspdf';
import { FormSchema, FormField } from './formSchema';

function parseHHMM(s: string): number | null {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function dayMinutes(marcacoes: string[]): number {
  let total = 0;
  for (let i = 0; i + 1 < marcacoes.length; i += 2) {
    const a = parseHHMM(marcacoes[i]);
    const b = parseHHMM(marcacoes[i + 1]);
    if (a == null || b == null) continue;
    let diff = b - a;
    if (diff < 0) diff += 24 * 60;
    total += diff;
  }
  return total;
}

function fmtValue(field: FormField, value: any): string {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Não informado';
    return value.join(', ');
  }
  if (field.type === 'date' && typeof value === 'string') {
    try {
      const [y, m, d] = value.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
    } catch {}
  }
  return String(value);
}

export interface FormPdfMeta {
  title: string;
  companyName?: string;
  companyCnpj?: string;
  employeeName?: string;
  submittedAt?: string;
}

export function buildFormPdf(
  schema: FormSchema,
  answers: Record<string, any>,
  meta: FormPdfMeta
): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  const ensureSpace = (h: number) => {
    if (y + h > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(meta.title, MARGIN, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const metaLines: string[] = [];
  if (meta.companyName) metaLines.push(`Empresa: ${meta.companyName}${meta.companyCnpj ? ' — CNPJ: ' + meta.companyCnpj : ''}`);
  if (meta.employeeName) metaLines.push(`Colaborador: ${meta.employeeName}`);
  if (meta.submittedAt) metaLines.push(`Data de envio: ${meta.submittedAt}`);
  for (const ml of metaLines) {
    ensureSpace(14);
    doc.text(ml, MARGIN, y);
    y += 14;
  }
  y += 6;
  doc.setDrawColor(180);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 16;

  for (const section of schema.sections) {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(section.title || 'Seção', MARGIN, y);
    y += 16;
    if (section.description) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(section.description, CONTENT_W);
      ensureSpace(lines.length * 12 + 4);
      doc.text(lines, MARGIN, y);
      y += lines.length * 12 + 2;
    }

    for (const field of section.fields) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const labelLines = doc.splitTextToSize(
        `${field.label}${field.required ? ' *' : ''}`,
        CONTENT_W
      );
      ensureSpace(labelLines.length * 12 + 4);
      doc.text(labelLines, MARGIN, y);
      y += labelLines.length * 12 + 2;

      doc.setFont('helvetica', 'normal');
      let displayValue: string;
      if (field.type === 'file') {
        const arr = answers[field.field_key];
        const count = Array.isArray(arr) ? arr.length : 0;
        displayValue = count > 0 ? `${count} arquivo(s) anexado(s) — ver dossiê` : 'Não informado';
      } else if (field.type === 'work_schedule') {
        const v = answers[field.field_key];
        const dias = Array.isArray(v?.dias) ? v.dias : [];
        if (!dias.length) {
          displayValue = 'Não informado';
        } else {
          let weekTotal = 0;
          const renderLines: string[] = [];
          for (const d of dias) {
            const marc = Array.isArray(d?.marcacoes) ? d.marcacoes : [];
            if (!d?.ativo) {
              renderLines.push(`${d?.dia ?? '-'}: Folga`);
              continue;
            }
            const mins = dayMinutes(marc);
            weekTotal += mins;
            const marcTxt = marc.length
              ? marc.map((m: string) => (m && /^\d{2}:\d{2}$/.test(m) ? m : '--:--')).join('  ')
              : '—';
            renderLines.push(`${d?.dia ?? '-'}: ${marcTxt}   Total: ${fmtMin(mins)}`);
          }
          renderLines.push(`Total semanal: ${fmtMin(weekTotal)}`);
          // Render line-by-line for guaranteed multi-line layout
          doc.setFont('courier', 'normal');
          doc.setFontSize(9);
          for (const ln of renderLines) {
            const wrapped = doc.splitTextToSize(ln, CONTENT_W);
            ensureSpace(wrapped.length * 11 + 2);
            const isTotal = ln.startsWith('Total semanal');
            if (isTotal) doc.setFont('courier', 'bold');
            doc.text(wrapped, MARGIN, y);
            if (isTotal) doc.setFont('courier', 'normal');
            y += wrapped.length * 11;
          }
          y += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          continue;
        }
      } else {
        displayValue = fmtValue(field, answers[field.field_key]);
      }
      const valLines = doc.splitTextToSize(displayValue, CONTENT_W);
      ensureSpace(valLines.length * 12 + 8);
      doc.text(valLines, MARGIN, y);
      y += valLines.length * 12 + 8;
    }
    y += 6;
  }

  // Footer page numbers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, PAGE_H - 16, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function buildCoverPdf(opts: {
  title: string;
  companyName?: string;
  companyCnpj?: string;
  employeeName?: string;
  employeeCpf?: string;
  submittedAt?: string;
  templateName?: string;
  status?: string;
  attachments: { label: string; pages: number }[];
}): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 50;
  let y = MARGIN + 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(opts.title, PAGE_W / 2, y, { align: 'center' });
  y += 36;

  doc.setDrawColor(98, 142, 63); // Monte Verde green
  doc.setLineWidth(2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const rows: [string, string][] = [];
  if (opts.companyName) rows.push(['Empresa', opts.companyName]);
  if (opts.companyCnpj) rows.push(['CNPJ', opts.companyCnpj]);
  if (opts.employeeName) rows.push(['Colaborador', opts.employeeName]);
  if (opts.employeeCpf) rows.push(['CPF', opts.employeeCpf]);
  if (opts.templateName) rows.push(['Formulário', opts.templateName]);
  if (opts.submittedAt) rows.push(['Data de envio', opts.submittedAt]);
  if (opts.status) rows.push(['Status', opts.status]);

  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, MARGIN + 110, y);
    y += 18;
  }

  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Documentos anexados', MARGIN, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (opts.attachments.length === 0) {
    doc.text('Nenhum documento anexado.', MARGIN, y);
  } else {
    opts.attachments.forEach((a, i) => {
      const line = `${i + 1}. ${a.label} — ${a.pages} página(s)`;
      const wrapped = doc.splitTextToSize(line, PAGE_W - MARGIN * 2);
      doc.text(wrapped, MARGIN, y);
      y += wrapped.length * 12 + 2;
    });
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Monte Verde Contabilidade — Dossiê de Admissão', PAGE_W / 2, PAGE_H - 30, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
}