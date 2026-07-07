import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { Annotation } from './types';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}

export function exportCommentsCsv(annotations: Annotation[], originalName: string) {
  const rows = [
    ['Página', 'Tipo', 'Autor', 'Data/Hora', 'Conteúdo'],
    ...annotations
      .slice()
      .sort((a, b) => a.page - b.page)
      .map((a) => [
        String(a.page),
        a.type,
        a.author || '',
        fmtDate(a.createdAt),
        (a.content || a.stampKind || '').replace(/"/g, '""'),
      ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c ?? ''}"`).join(';'))
    .join('\n');
  const bom = '\uFEFF';
  saveAs(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }),
    `RELATORIO_COMENTARIOS_${originalName.replace(/\.pdf$/i, '')}.csv`);
}

export function exportCommentsPdf(annotations: Annotation[], originalName: string) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Relatório de Comentários e Marcações', 14, 16);
  doc.setFontSize(10);
  doc.text(`Arquivo: ${originalName}`, 14, 24);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
  autoTable(doc, {
    startY: 36,
    head: [['Pág.', 'Tipo', 'Autor', 'Data/Hora', 'Conteúdo']],
    body: annotations
      .slice()
      .sort((a, b) => a.page - b.page)
      .map((a) => [
        a.page,
        a.type,
        a.author || '',
        fmtDate(a.createdAt),
        a.content || a.stampKind || '',
      ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [98, 142, 63] },
    columnStyles: { 4: { cellWidth: 80 } },
  });
  doc.save(`RELATORIO_COMENTARIOS_${originalName.replace(/\.pdf$/i, '')}.pdf`);
}