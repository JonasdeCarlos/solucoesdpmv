import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';

export async function generateFeedbackPdf(params: {
  empresa: string;
  tipo: 'feedback' | 'cobranca' | 'alinhamento';
  employee_name: string;
  employee_role?: string | null;
  manager_name?: string | null;
  tom?: string | null;
  texto: string;
}) {
  const branding = await loadBranding();
  const { empresa, tipo, employee_name, employee_role, manager_name, tom, texto } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
  const [pr,pg,pb] = hex(primary);

  let y = 40;
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,95,'F');
  await drawBrandLogo(doc, branding?.logo_url, 20, 12, 85, 70, { centerY: true });
  doc.setTextColor(255,255,255); doc.setFontSize(16);
  const titulo = tipo === 'feedback' ? 'FEEDBACK AO COLABORADOR'
    : tipo === 'cobranca' ? 'ALINHAMENTO E COBRANÇA'
    : 'DOCUMENTO DE ALINHAMENTO';
  doc.text(titulo, 80, 40);
  doc.setFontSize(10); doc.text(`Empresa: ${empresa}`, 80, 60);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 80, 73);

  y = 110;
  doc.setTextColor(0,0,0);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('Identificação', 40, y); y += 16;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(`Colaborador: ${employee_name}${employee_role ? ` — ${employee_role}` : ''}`, 40, y); y += 14;
  if (manager_name) { doc.text(`Gestor responsável: ${manager_name}`, 40, y); y += 14; }
  if (tom) { doc.text(`Tom do alinhamento: ${tom}`, 40, y); y += 14; }
  y += 6;

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text('Conteúdo', 40, y); y += 16;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);

  const lines = doc.splitTextToSize(texto || '', W - 80);
  for (const ln of lines) {
    if (y > H - 180) { doc.addPage(); y = 40; }
    doc.text(ln, 40, y); y += 13;
  }

  // espaço de assinatura
  const sigY = Math.max(y + 40, H - 150);
  doc.setDrawColor(120,120,120);
  doc.line(60, sigY, 260, sigY);
  doc.line(W - 260, sigY, W - 60, sigY);
  doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text('Assinatura do Colaborador', 60, sigY + 12);
  doc.text(employee_name, 60, sigY + 26);
  doc.text('Assinatura do Gestor', W - 260, sigY + 12);
  if (manager_name) doc.text(manager_name, W - 260, sigY + 26);

  doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text(`${branding?.office_name || 'Sucesso do Cliente — DP'} • Gerado em ${new Date().toLocaleString('pt-BR')}`, 40, H - 30);

  doc.save(`${tipo}-${employee_name.replace(/\s+/g,'_')}.pdf`);
}