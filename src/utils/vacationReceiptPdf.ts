import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/utils/formatters';
import { type VacationReceiptData, type VacationCalculationResult } from '@/types/vacationReceipt';

const PAGE_WIDTH = 210;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDateBR(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function cleanFilePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function hasValue(value: string | number | undefined | null): boolean {
  if (typeof value === 'number') return Math.abs(value) > 0.004;
  return Boolean(String(value || '').trim());
}

export function createVacationReceiptFileName(data: VacationReceiptData): string {
  const employee = cleanFilePart(data.employeeName || 'empregado');
  const start = data.leaveStart || new Date().toISOString().split('T')[0];
  return `recibo-ferias-${employee}-${start}.pdf`;
}

export function generateVacationReceiptPDF(data: VacationReceiptData, result: VacationCalculationResult, mode: 'save' | 'blob' = 'save') {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RECIBO DE FÉRIAS', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const employer = [`Empregador: ${data.companyName || '{{empresa_razao_social}}'}`, hasValue(data.companyDoc) ? `CNPJ/CPF: ${data.companyDoc}` : ''].filter(Boolean).join(' — ');
  const employee = [`Empregado: ${data.employeeName || '{{empregado_nome}}'}`, hasValue(data.employeeCpf) ? `CPF: ${data.employeeCpf}` : ''].filter(Boolean).join(' — ');
  doc.text(employer, MARGIN, y, { maxWidth: CONTENT_WIDTH });
  y += 6;
  doc.text(employee, MARGIN, y, { maxWidth: CONTENT_WIDTH });
  y += 6;
  const meta = [[data.role, 'Cargo/Função'], [data.registration, 'Matrícula'], [data.pis, 'PIS'], [data.department, 'Setor']]
    .filter(([value]) => hasValue(value))
    .map(([value, label]) => `${label}: ${value}`);
  if (meta.length) {
    doc.text(meta.join('   |   '), MARGIN, y, { maxWidth: CONTENT_WIDTH });
    y += 6;
  }
  y += 4;

  const paragraph = `Recebi de ${data.companyName || '{{empresa_razao_social}}'} a importância líquida de ${formatCurrency(result.netTotal)}, referente às férias ${data.vacationType.toLowerCase()} do período aquisitivo de ${formatDateBR(data.acquisitionStart)} a ${formatDateBR(data.acquisitionEnd)}, com gozo de ${formatDateBR(data.leaveStart)} a ${formatDateBR(data.leaveEnd)} e retorno em ${formatDateBR(data.returnDate)}.`;
  doc.setFontSize(10);
  const paragraphLines = doc.splitTextToSize(paragraph, CONTENT_WIDTH);
  doc.text(paragraphLines, MARGIN, y, { maxWidth: CONTENT_WIDTH, align: 'justify' });
  y += paragraphLines.length * 5 + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Campo', 'Informação']],
    body: [
      ['Período aquisitivo', `${formatDateBR(data.acquisitionStart)} a ${formatDateBR(data.acquisitionEnd)}`],
      ['Período de gozo', `${formatDateBR(data.leaveStart)} a ${formatDateBR(data.leaveEnd)} (${data.vacationDays} dias)`],
      ['Dias de gozo efetivo', `${result.effectiveLeaveDays} dias`],
      ['Data de retorno', formatDateBR(data.returnDate)],
      ['Forma/Data de pagamento', `${data.payMethod} — ${formatDateBR(data.payDate)}`],
      ...(data.vacationType === 'Fracionadas' && data.fractionDescription ? [['Descrição do fracionamento', data.fractionDescription]] : []),
    ],
    styles: { fontSize: 8.5, cellPadding: 2.4, textColor: [0, 0, 0], lineColor: [210, 210, 210], lineWidth: 0.15 },
    headStyles: { fillColor: [98, 142, 63], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: CONTENT_WIDTH - 48 } },
  });

  y = (doc as any).lastAutoTable.finalY + 7;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Demonstrativo', 'Valor']],
    body: [
      ['Salário base mensal', formatCurrency(data.salaryBase)],
      ['Médias de variáveis', formatCurrency(data.avgVariables)],
      ['Outras verbas incorporáveis', formatCurrency(data.otherPayItems)],
      ['Remuneração base para férias', formatCurrency(result.baseRemuneration)],
      ['Valor das férias', formatCurrency(result.vacationValue)],
      ['1/3 constitucional', formatCurrency(result.oneThirdValue)],
      ...(data.abonoEnabled ? [['Abono pecuniário', formatCurrency(result.abonoValue)], ['1/3 sobre abono', formatCurrency(result.abonoOneThirdValue)]] : []),
      ...(data.discountsValue > 0 ? [['Descontos' + (data.discountsDesc ? ` — ${data.discountsDesc}` : ''), `- ${formatCurrency(data.discountsValue)}`]] : []),
      ['TOTAL BRUTO', formatCurrency(result.grossTotal)],
      ['VALOR LÍQUIDO', formatCurrency(result.netTotal)],
    ].filter((row) => !row[0].includes('TOTAL') && !row[0].includes('VALOR LÍQUIDO') ? row[1] !== formatCurrency(0) : true),
    styles: { fontSize: 9, cellPadding: 2.6, textColor: [0, 0, 0], lineColor: [210, 210, 210], lineWidth: 0.15 },
    headStyles: { fillColor: [57, 52, 33], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 105 }, 1: { halign: 'right', cellWidth: CONTENT_WIDTH - 105 } },
    didParseCell: (hook) => {
      const label = String(hook.row.raw?.[0] || '');
      if (label.includes('TOTAL') || label.includes('VALOR LÍQUIDO')) hook.cell.styles.fontStyle = 'bold';
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Memória de cálculo', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const memo = [
    `RB = ${formatCurrency(data.salaryBase)} + ${formatCurrency(data.avgVariables)} + ${formatCurrency(data.otherPayItems)} = ${formatCurrency(result.baseRemuneration)}`,
    `VF = RB ÷ 30 × ${data.vacationDays} = ${formatCurrency(result.vacationValue)}`,
    `T = VF ÷ 3 = ${formatCurrency(result.oneThirdValue)}`,
    data.abonoEnabled ? `VA = RB ÷ 30 × ${data.abonoDays} = ${formatCurrency(result.abonoValue)}; TA = VA ÷ 3 = ${formatCurrency(result.abonoOneThirdValue)}` : 'Abono pecuniário: não informado',
    `Líquido = ${formatCurrency(result.grossTotal)} - ${formatCurrency(data.discountsValue)} = ${formatCurrency(result.netTotal)}`,
  ];
  doc.text(memo, MARGIN, y);
  y += memo.length * 4.5 + 14;

  if (y > 255) {
    doc.addPage();
    y = 35;
  }
  doc.text(`${data.signaturePlace || '{{local_assinatura}}'}, ${formatDateBR(data.signatureDate)}.`, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 18;
  doc.line(55, y, 155, y);
  y += 5;
  doc.text(data.employeeName || '{{empregado_nome}}', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;
  doc.line(55, y, 155, y);
  y += 5;
  doc.text(`${data.responsibleName || '{{responsavel_nome}}'}${data.responsibleRole ? ` — ${data.responsibleRole}` : ''}`, PAGE_WIDTH / 2, y, { align: 'center' });

  const fileName = createVacationReceiptFileName(data);
  if (mode === 'blob') return { blob: doc.output('blob'), fileName };
  doc.save(fileName);
  return { fileName };
}
