import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type ReciboData, type ReciboLinha, calcularTotaisRecibo } from '@/types/recibo';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { numberToWords } from '@/utils/numberToWords';

const MARGIN = 25;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function competenciaExtenso(competencia: string): string {
  const meses = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const parts = competencia.split('/');
  if (parts.length === 2) {
    const mes = parseInt(parts[0], 10);
    return `${meses[mes] || parts[0]} de ${parts[1]}`;
  }
  return competencia;
}

function dataExtenso(dateStr: string): string {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

export function generateReciboPDF(recibo: ReciboData) {
  const doc = new jsPDF('p', 'mm', 'a4');

  const { proventos, descontos, fgtsValor, totalLiquido } = calcularTotaisRecibo(
    recibo.linhas,
    recibo.calcularFGTS,
    recibo.aliquotaFGTS
  );

  // Emitido por (topo)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`Emitido por: ${recibo.emitidoPor}`, PAGE_WIDTH / 2, MARGIN, { align: 'center' });

  // Título
  let y = MARGIN + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RECIBO DE PAGAMENTO', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 10;

  // Parágrafo principal
  const docLabel = recibo.clienteTipo === 'PJ' ? 'CNPJ' : 'CPF';
  const entityLabel = recibo.clienteTipo === 'PJ' ? 'empresa' : 'empregador';
  const paragrafo = `Recebi da ${entityLabel} ${recibo.clienteNome || '[EMPREGADOR]'}, ${docLabel} sob número ${recibo.clienteDoc || `[${docLabel}]`} o valor de ${formatCurrency(totalLiquido)} (${numberToWords(totalLiquido)}) referente ao pagamento do salário de ${competenciaExtenso(recibo.competencia) || '[COMPETÊNCIA]'}. Conforme a planilha abaixo demonstra.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(paragrafo, CONTENT_WIDTH);
  doc.text(lines, MARGIN, y, { maxWidth: CONTENT_WIDTH });
  y += lines.length * 5 + 6;

  // Tabela de verbas
  const tableRows: any[][] = recibo.linhas.map((l) => [
    l.descricao,
    l.pd,
    l.ref,
    formatCurrency(l.valor),
  ]);

  // Linha FGTS se ativo
  if (recibo.calcularFGTS && fgtsValor > 0) {
    tableRows.push(['FGTS', 'P', `${recibo.aliquotaFGTS}%`, formatCurrency(fgtsValor)]);
  }

  // Total
  tableRows.push([
    { content: 'TOTAL', styles: { fontStyle: 'bold' as const } },
    '',
    '',
    { content: formatCurrency(totalLiquido), styles: { fontStyle: 'bold' as const } },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['DESCRIÇÃO', 'P/D', 'REF.', 'VALOR']],
    body: tableRows,
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 40, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Data e local
  if (y + 30 > 280) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${recibo.cidadeUF}, ${dataExtenso(recibo.dataEmissao)}.`, MARGIN, y);
  y += 20;

  // Assinatura
  const sigX = MARGIN + 15;
  doc.setLineWidth(0.3);
  doc.line(sigX, y, sigX + 100, y);
  y += 5;
  doc.setFontSize(10);
  doc.text(recibo.recebedorNome || '[NOME DO RECEBEDOR]', sigX, y);

  doc.save(`recibo-${recibo.competencia.replace('/', '-')}.pdf`);
}

export function generateReciboTexto(recibo: ReciboData): string {
  const { fgtsValor, totalLiquido } = calcularTotaisRecibo(
    recibo.linhas,
    recibo.calcularFGTS,
    recibo.aliquotaFGTS
  );

  const docLabel = recibo.clienteTipo === 'PJ' ? 'CNPJ' : 'CPF';
  const entityLabel = recibo.clienteTipo === 'PJ' ? 'empresa' : 'empregador';

  let text = `Emitido por: ${recibo.emitidoPor}\n\n`;
  text += `RECIBO DE PAGAMENTO\n\n`;
  text += `Recebi da ${entityLabel} ${recibo.clienteNome || '[EMPREGADOR]'}, ${docLabel} sob número ${recibo.clienteDoc || `[${docLabel}]`} o valor de ${formatCurrency(totalLiquido)} (${numberToWords(totalLiquido)}) referente ao pagamento do salário de ${competenciaExtenso(recibo.competencia) || '[COMPETÊNCIA]'}. Conforme a planilha abaixo demonstra.\n\n`;

  text += `DESCRIÇÃO | P/D | REF. | VALOR\n`;
  text += `${'—'.repeat(50)}\n`;

  for (const l of recibo.linhas) {
    text += `${l.descricao} | ${l.pd} | ${l.ref} | ${formatCurrency(l.valor)}\n`;
  }

  if (recibo.calcularFGTS && fgtsValor > 0) {
    text += `FGTS | P | ${recibo.aliquotaFGTS}% | ${formatCurrency(fgtsValor)}\n`;
  }

  text += `${'—'.repeat(50)}\n`;
  text += `TOTAL = ${formatCurrency(totalLiquido)}\n\n`;
  text += `${recibo.cidadeUF}, ${dataExtenso(recibo.dataEmissao)}.\n\n`;
  text += `______________________________________________\n`;
  text += `${recibo.recebedorNome || '[NOME DO RECEBEDOR]'}\n`;

  return text;
}
