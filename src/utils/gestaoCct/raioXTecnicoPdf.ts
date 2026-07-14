import jsPDF from 'jspdf';
import { loadBranding } from '@/utils/sucessoCliente/perfilPdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';

const hexToRgb = (h: string): [number, number, number] => {
  const clean = (h || '').replace('#', '');
  const v = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
};

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const isEmpty = (v: any): boolean => {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '' || /^n[ãa]o identificado/i.test(v.trim());
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmpty);
  if (typeof v === 'object') return Object.keys(v).length === 0 || Object.values(v).every(isEmpty);
  return false;
};

const humanize = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const stringify = (v: any): string => {
  if (isEmpty(v)) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object' || x === null)) return v.map((x) => String(x)).join(', ');
    return v.map((x) => Object.entries(x).filter(([, val]) => !isEmpty(val)).map(([k, val]) => `${humanize(k)}: ${stringify(val)}`).join(' · ')).join('\n');
  }
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => !isEmpty(val)).map(([k, val]) => `${humanize(k)}: ${stringify(val)}`).join('\n');
  return String(v);
};

const BLOCKS: Array<{ key: string; label: string }> = [
  { key: 'identification', label: 'A) Identificação' },
  { key: 'unions', label: 'B) Sindicatos' },
  { key: 'territorial_base', label: 'C) Base territorial' },
  { key: 'professional_classes', label: 'D) Categorias / classes profissionais' },
  { key: 'economic_clauses', label: 'E) Cláusulas econômicas' },
  { key: 'benefits_summary', label: 'F) Benefícios obrigatórios' },
  { key: 'journey_rules', label: 'G) Jornada de trabalho' },
  { key: 'overtime_rules', label: 'H) Horas extras e adicionais' },
  { key: 'vacation_absence', label: 'I) Férias e afastamentos' },
  { key: 'admission_termination', label: 'J) Admissão e rescisão' },
  { key: 'union_obligations', label: 'K) Obrigações sindicais' },
  { key: 'health_safety', label: 'L) Saúde e segurança' },
  { key: 'penalties', label: 'M) Multas e penalidades' },
];

export async function generateCctRaioXTecnicoPdf(params: { analysis: any }) {
  const { analysis } = params;
  const branding = await loadBranding().catch(() => null);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#E1E8F2';
  const [pr, pg, pb] = hexToRgb(primary);
  const [sr, sg, sb] = hexToRgb(secondary);

  // Header
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 105, 'F');
  await drawBrandLogo(doc, branding?.logo_url, 24, 15, 95, 75, { centerY: true });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Raio-X Técnico da CCT', 100, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(branding?.office_name || 'Departamento Pessoal', 100, 60);
  doc.text(analysis?.title || 'CCT', 100, 76);
  doc.setFontSize(9);
  const status = analysis?.status ? `Status: ${analysis.status}` : '';
  const conf = analysis?.confidence_score != null ? ` · Confiança: ${Number(analysis.confidence_score).toFixed(2)}` : '';
  doc.text(`${status}${conf}`, 100, 90);

  let y = 128;
  const marginX = 40;
  const contentW = W - marginX * 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = 60;
    }
  };

  const sectionTitle = (label: string) => {
    ensureSpace(30);
    doc.setFillColor(sr, sg, sb);
    doc.rect(marginX, y - 14, contentW, 22, 'F');
    doc.setTextColor(pr, pg, pb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(label, marginX + 8, y);
    y += 18;
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const kv = (label: string, value: string) => {
    const wrapped = doc.splitTextToSize(value || '—', contentW - 160);
    ensureSpace(wrapped.length * 12 + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(wrapped, marginX + 150, y);
    y += wrapped.length * 12 + 3;
  };

  const paragraph = (text: string) => {
    const wrapped = doc.splitTextToSize(text, contentW);
    ensureSpace(wrapped.length * 12 + 4);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 12 + 4;
  };

  if (analysis.ai_summary) {
    sectionTitle('Resumo Executivo');
    paragraph(analysis.ai_summary);
    y += 4;
  }

  for (const block of BLOCKS) {
    const data = analysis?.[block.key];
    if (isEmpty(data)) continue;
    sectionTitle(block.label);
    if (typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data).filter(([k, v]) => !isEmpty(v) && k !== 'confidence' && k !== 'source_snippet');
      for (const [k, v] of entries) {
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
          doc.setFont('helvetica', 'bold');
          ensureSpace(16);
          doc.text(`${humanize(k)}:`, marginX, y);
          y += 12;
          doc.setFont('helvetica', 'normal');
          (v as any[]).forEach((item, idx) => {
            const line = Object.entries(item).filter(([, val]) => !isEmpty(val)).map(([kk, val]) => `${humanize(kk)}: ${stringify(val)}`).join(' · ');
            const wrapped = doc.splitTextToSize(`  ${idx + 1}. ${line}`, contentW);
            ensureSpace(wrapped.length * 12 + 3);
            doc.text(wrapped, marginX, y);
            y += wrapped.length * 12 + 2;
          });
          y += 3;
        } else {
          kv(`${humanize(k)}:`, stringify(v));
        }
      }
      const conf = (data as any).confidence;
      const src = (data as any).source_snippet;
      if (conf || src) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        const meta = [conf ? `Confiança: ${conf}` : '', src ? `Trecho: "${String(src).slice(0, 180)}"` : ''].filter(Boolean).join(' · ');
        const wrapped = doc.splitTextToSize(meta, contentW);
        ensureSpace(wrapped.length * 11 + 6);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 11 + 6;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      }
    } else {
      paragraph(stringify(data));
    }
    y += 6;
  }

  const dp = Array.isArray(analysis.dp_attention_points) ? analysis.dp_attention_points : [];
  if (dp.length) {
    sectionTitle('N) Pontos de atenção para DP');
    dp.forEach((p: any) => {
      const text = typeof p === 'string' ? p : JSON.stringify(p);
      const wrapped = doc.splitTextToSize(`• ${text}`, contentW);
      ensureSpace(wrapped.length * 12 + 3);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 12 + 3;
    });
  }

  if (analysis.reviewer_notes) {
    sectionTitle('Notas do Revisor');
    paragraph(String(analysis.reviewer_notes));
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const emitted = new Date().toLocaleDateString('pt-BR');
    doc.text(`${branding?.office_name || ''}  ·  Raio-X técnico emitido em ${emitted}`, marginX, H - 24);
    doc.text(`Página ${i} de ${pageCount}`, W - marginX, H - 24, { align: 'right' });
  }

  const fileName = `raio-x-cct-${(analysis?.title || 'analise').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.pdf`;
  doc.save(fileName);
}