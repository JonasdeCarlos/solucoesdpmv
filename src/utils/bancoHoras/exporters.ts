import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatHHMM, classifyFaixa, FAIXA_LABEL, competenciaLabel } from './calc';

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

export function exportPdf(rows: ReportRow[], titulo: string, filename: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text('Monte Verde Contabilidade', 14, 14);
  doc.setFontSize(11);
  doc.text(titulo, 14, 21);
  doc.setFontSize(8);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 27);

  autoTable(doc, {
    startY: 32,
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
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const f = String(data.cell.raw);
        if (f === 'verde') data.cell.styles.fillColor = [220, 252, 231];
        if (f === 'amarelo') data.cell.styles.fillColor = [254, 249, 195];
        if (f === 'laranja') data.cell.styles.fillColor = [255, 237, 213];
        if (f === 'vermelho') data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  doc.setFontSize(7);
  doc.text(
    'Cálculo baseado nos saldos extraídos automaticamente dos PDFs de cartão ponto. Confira os dados antes de utilizar.',
    14, doc.internal.pageSize.getHeight() - 8,
  );
  doc.save(filename);
}

export function rowFaixaLabel(minutes: number): string {
  return classifyFaixa(minutes);
}
export const FAIXA_DESC = FAIXA_LABEL;
