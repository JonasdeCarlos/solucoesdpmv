import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Step1Data, type Step2Data, type Step3Data, type VerbaRescisoria, calcularTotal, MOTIVO_TERMO_TITULO, MOTIVO_TERMO_CORPO, MOTIVO_LABELS } from './calculations';
import { calcularFgtsDetalhado } from './fgtsDetail';
import { formatCurrency, formatDate } from './formatters';
import { numberToWords } from './numberToWords';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addHeader(doc: jsPDF, title: string, compact = false) {
  doc.setFont('helvetica', 'bold');
  const fontSize = compact ? 10 : 13;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(title, CONTENT_WIDTH);
  const startY = MARGIN + (compact ? 3 : 5);
  doc.text(lines, PAGE_WIDTH / 2, startY, { align: 'center' });
  const lineH = compact ? 4 : 6;
  return startY + lines.length * lineH + (compact ? 2 : 4);
}

function addParagraph(doc: jsPDF, text: string, y: number, opts?: { bold?: boolean; fontSize?: number; align?: 'left' | 'center' | 'justify'; compact?: boolean }): number {
  const fontSize = opts?.fontSize ?? 10;
  const compact = opts?.compact ?? false;
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  const lineH = compact ? 3.8 : 5;
  const gap = compact ? 1.5 : 3;
  
  // Check if we need a new page
  if (y + lines.length * lineH > 280) {
    doc.addPage();
    y = MARGIN;
  }
  
  doc.text(lines, opts?.align === 'center' ? PAGE_WIDTH / 2 : MARGIN, y, { align: opts?.align ?? 'justify', maxWidth: CONTENT_WIDTH });
  return y + lines.length * lineH + gap;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function buildVerbasTable(verbas: VerbaRescisoria[], total: number) {
  const verbasNaoZero = verbas.filter(v => v.valor !== 0);
  const hasDebito = verbasNaoZero.some(v => v.tipo === 'debito');

  if (hasDebito) {
    const body = verbasNaoZero.map(v => [
      v.verba, v.referencia,
      v.tipo === 'debito' ? '' : formatCurrency(v.valor),
      v.tipo === 'debito' ? formatCurrency(v.valor) : '',
    ]);
    const totalCreditos = verbasNaoZero
      .filter(v => v.tipo !== 'debito')
      .reduce((s, v) => s + v.valor, 0);
    const totalDebitos = verbasNaoZero
      .filter(v => v.tipo === 'debito')
      .reduce((s, v) => s + v.valor, 0);
    const bold = { fontStyle: 'bold' as const };
    body.push([
      { content: 'TOTAL PROVENTOS', styles: bold } as any, '',
      { content: formatCurrency(totalCreditos), styles: bold } as any,
      { content: '', styles: bold } as any,
    ]);
    body.push([
      { content: 'TOTAL DESCONTOS', styles: bold } as any, '',
      { content: '', styles: bold } as any,
      { content: formatCurrency(totalDebitos), styles: bold } as any,
    ]);
    body.push([
      { content: 'LÍQUIDO A RECEBER', styles: bold } as any, '',
      { content: formatCurrency(Math.max(0, total)), styles: bold } as any,
      { content: total < 0 ? formatCurrency(Math.abs(total)) : '', styles: bold } as any,
    ]);
    return { head: [['VERBA', 'REF', 'CRÉDITO (R$)', 'DÉBITO (R$)']], body, hasDebito };
  } else {
    const body = verbasNaoZero.map(v => [
      v.verba, v.referencia, formatCurrency(v.valor),
    ]);
    body.push([
      { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' as const } } as any, '',
      { content: formatCurrency(total), styles: { fontStyle: 'bold' as const } } as any,
    ]);
    return { head: [['VERBA', 'REF', 'VALOR (R$)']], body, hasDebito };
  }
}

export function generateTermoPDF(step1: Step1Data, step2: Step2Data, step3: Step3Data, verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const total = calcularTotal(verbas);
  const motivoTitulo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toUpperCase() || 'OUTROS') : MOTIVO_TERMO_TITULO[step1.motivo];
  const motivoCorpo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toLowerCase() || 'outros') : MOTIVO_TERMO_CORPO[step1.motivo];
  const tipoEmpregador = step3.empregadorTipo === 'domestico' ? 'empregador doméstico' : 'empresa';
  const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '___/___/______';
  const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '___/___/______';
  const local = step3.localAssinatura || '________________';
  const dataAss = step3.dataAssinatura ? formatDate(new Date(step3.dataAssinatura + 'T12:00:00')) : formatDate(new Date());

  // Title
  let y = addHeader(doc, `TERMO DE RESCISÃO DE CONTRATO DE TRABALHO EM COMUM, NÃO PERSONIFICADO, ${motivoTitulo}.`, true);

  // Horizontal line
  y += 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  // Parties paragraph
  const empregadorNome = step3.empregadorNome || '[NOME DO EMPREGADOR]';
  const empregadorEnd = step3.empregadorEndereco || '[ENDEREÇO]';
  const empregadoNome = step3.empregadoNome || '[NOME DO EMPREGADO]';
  const empregadoCPF = step3.empregadoCPF || '[CPF]';
  const empregadoEnd = step3.empregadoEndereco || '[ENDEREÇO]';
  const empregadorDocPart = step3.empregadorTipo === 'empresa'
    ? `inscrita no CNPJ/MF sob nº ${step3.empregadorCNPJ || '[CNPJ]'}`
    : `inscrito(a) no CPF/MF sob nº ${step3.empregadorCPF || '[CPF]'}`;

  const partiesParagraph = `Pelo presente instrumento e na melhor forma de direito, as partes, de um lado, ${empregadorNome}, ${empregadorDocPart}, residente e domiciliado(a) ${empregadorEnd}, doravante denominado(a) simplesmente EMPREGADOR, e do outro lado, ${empregadoNome}, inscrito(a) no CPF/MF sob nº ${empregadoCPF}, residente e domiciliado(a) ${empregadoEnd}, doravante denominado(a) simplesmente EMPREGADO(A), resolvem rescindir o contrato de trabalho firmado entre as partes, conforme segue.`;

  y = addParagraph(doc, partiesParagraph, y, { fontSize: 9, compact: true });
  y += 1;

  // Contract details section
  y = addParagraph(doc, 'DADOS DO CONTRATO', y, { bold: true, fontSize: 9, compact: true });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_WIDTH / 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Admissão:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAdm, col1X + 22, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Desligamento:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataDesl, col2X + 28, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Salário:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(step1.salarioMensal), col1X + 16, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Motivo:', col2X, y);
  doc.setFont('helvetica', 'normal');
  const motivoLabel = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];
  const motivoLines = doc.splitTextToSize(motivoLabel, CONTENT_WIDTH / 2 - 18);
  doc.text(motivoLines, col2X + 16, y);
  y += Math.max(5, motivoLines.length * 4) + 2;

  // Separator
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 4;

  // Verbas table header
  y = addParagraph(doc, 'DEMONSTRATIVO DE VERBAS RESCISÓRIAS', y, { bold: true, fontSize: 9, compact: true });
  y += 1;

  // Table using autoTable
  const { head, body: tableBody, hasDebito } = buildVerbasTable(verbas, total);

  const colStylesCompact = hasDebito
    ? { 0: { cellWidth: 70 }, 1: { cellWidth: 28, halign: 'center' as const }, 2: { cellWidth: 32, halign: 'right' as const }, 3: { cellWidth: 30, halign: 'right' as const } }
    : { 0: { cellWidth: 80 }, 1: { cellWidth: 35, halign: 'center' as const }, 2: { cellWidth: 45, halign: 'right' as const } };

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body: tableBody,
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
    },
    columnStyles: colStylesCompact,
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Total por extenso
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Total por extenso: ${numberToWords(total)}`, MARGIN, y);
  y += 6;

  // Declaration
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 4;

  const declaration = `Eu, ${empregadoNome}, já qualificado(a) acima, declaro neste ato ter recebido a quantia de ${formatCurrency(total)} (${numberToWords(total)}), referentes à rescisão de contrato de trabalho não personificada, ${motivoCorpo}, com o ${tipoEmpregador} já identificado acima. E por assim estarmos justos e contratados, firmo o presente termo em uma única via que servirá como recibo para o empregador.`;

  y = addParagraph(doc, declaration, y, { fontSize: 8, compact: true });
  y += 8;

  // Signature area
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${local}, ${dataAss}`, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;

  // Two signature columns - centered
  const sigWidth = 55;
  const sigGap = 20;
  const totalSigWidth = sigWidth * 2 + sigGap;
  const sigStartX = (PAGE_WIDTH - totalSigWidth) / 2;
  const sigCol1 = sigStartX;
  const sigCol2 = sigStartX + sigWidth + sigGap;

  doc.setLineWidth(0.3);
  doc.line(sigCol1, y, sigCol1 + sigWidth, y);
  doc.line(sigCol2, y, sigCol2 + sigWidth, y);
  y += 4;

  doc.setFontSize(8);
  doc.text(empregadoNome, sigCol1 + sigWidth / 2, y, { align: 'center' });
  doc.text(empregadorNome, sigCol2 + sigWidth / 2, y, { align: 'center' });
  y += 3;
  doc.setFontSize(7);
  doc.text('EMPREGADO(A)', sigCol1 + sigWidth / 2, y, { align: 'center' });
  doc.text('EMPREGADOR', sigCol2 + sigWidth / 2, y, { align: 'center' });

  addFooterDisclaimer(doc);

  doc.save('termo-rescisao.pdf');
}

export function generateDemonstrativoPDF(verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const total = calcularTotal(verbas);

  let y = addHeader(doc, 'DEMONSTRATIVO DE VERBAS RESCISÓRIAS');
  y += 5;

  const { head, body: tableBody, hasDebito } = buildVerbasTable(verbas, total);
  const colStyles = hasDebito
    ? { 0: { cellWidth: 65 }, 1: { cellWidth: 30, halign: 'center' as const }, 2: { cellWidth: 35, halign: 'right' as const }, 3: { cellWidth: 30, halign: 'right' as const } }
    : { 0: { cellWidth: 75 }, 1: { cellWidth: 40, halign: 'center' as const }, 2: { cellWidth: 45, halign: 'right' as const } };

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: colStyles,
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total por extenso: ${numberToWords(total)}`, MARGIN, y);

  doc.save('demonstrativo-verbas.pdf');
}

export function generateMemoriaPDF(step1: Step1Data, step2: Step2Data, verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  renderMemoriaPages(doc, step1, step2, verbas);
  addFooterDisclaimer(doc);
  doc.save('memoria-de-calculo.pdf');
}

export function generateTermoEMemoriaPDF(step1: Step1Data, step2: Step2Data, step3: Step3Data, verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');

  // --- Parte 1: Termo de Rescisão (reusa lógica do generateTermoPDF, mas sem salvar) ---
  const total = calcularTotal(verbas);
  const motivoTitulo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toUpperCase() || 'OUTROS') : MOTIVO_TERMO_TITULO[step1.motivo];
  const motivoCorpo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toLowerCase() || 'outros') : MOTIVO_TERMO_CORPO[step1.motivo];
  const tipoEmpregador = step3.empregadorTipo === 'domestico' ? 'empregador doméstico' : 'empresa';
  const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '___/___/______';
  const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '___/___/______';
  const local = step3.localAssinatura || '________________';
  const dataAss = step3.dataAssinatura ? formatDate(new Date(step3.dataAssinatura + 'T12:00:00')) : formatDate(new Date());
  const empregadorNome = step3.empregadorNome || '[NOME DO EMPREGADOR]';
  const empregadorEnd = step3.empregadorEndereco || '[ENDEREÇO]';
  const empregadoNome = step3.empregadoNome || '[NOME DO EMPREGADO]';
  const empregadoCPF = step3.empregadoCPF || '[CPF]';
  const empregadoEnd = step3.empregadoEndereco || '[ENDEREÇO]';
  const empregadorDocPart = step3.empregadorTipo === 'empresa'
    ? `inscrita no CNPJ/MF sob nº ${step3.empregadorCNPJ || '[CNPJ]'}`
    : `inscrito(a) no CPF/MF sob nº ${step3.empregadorCPF || '[CPF]'}`;

  let y = addHeader(doc, `TERMO DE RESCISÃO DE CONTRATO DE TRABALHO EM COMUM, NÃO PERSONIFICADO, ${motivoTitulo}.`, true);
  y += 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  const partiesParagraph = `Pelo presente instrumento e na melhor forma de direito, as partes, de um lado, ${empregadorNome}, ${empregadorDocPart}, residente e domiciliado(a) ${empregadorEnd}, doravante denominado(a) simplesmente EMPREGADOR, e do outro lado, ${empregadoNome}, inscrito(a) no CPF/MF sob nº ${empregadoCPF}, residente e domiciliado(a) ${empregadoEnd}, doravante denominado(a) simplesmente EMPREGADO(A), resolvem rescindir o contrato de trabalho firmado entre as partes, conforme segue.`;
  y = addParagraph(doc, partiesParagraph, y, { fontSize: 9, compact: true });
  y += 1;

  y = addParagraph(doc, 'DADOS DO CONTRATO', y, { bold: true, fontSize: 9, compact: true });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Admissão:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAdm, col1X + 22, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Desligamento:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataDesl, col2X + 28, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Salário:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(step1.salarioMensal), col1X + 16, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Motivo:', col2X, y);
  doc.setFont('helvetica', 'normal');
  const motivoLabel = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];
  const motivoLines = doc.splitTextToSize(motivoLabel, CONTENT_WIDTH / 2 - 18);
  doc.text(motivoLines, col2X + 16, y);
  y += Math.max(5, motivoLines.length * 4) + 2;

  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 4;

  y = addParagraph(doc, 'DEMONSTRATIVO DE VERBAS RESCISÓRIAS', y, { bold: true, fontSize: 9, compact: true });
  y += 1;

  const { head, body: tableBody, hasDebito } = buildVerbasTable(verbas, total);
  const colStylesCompact2 = hasDebito
    ? { 0: { cellWidth: 70 }, 1: { cellWidth: 28, halign: 'center' as const }, 2: { cellWidth: 32, halign: 'right' as const }, 3: { cellWidth: 30, halign: 'right' as const } }
    : { 0: { cellWidth: 80 }, 1: { cellWidth: 35, halign: 'center' as const }, 2: { cellWidth: 45, halign: 'right' as const } };

  autoTable(doc, {
    startY: y, margin: { left: MARGIN, right: MARGIN },
    head,
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', cellPadding: 1.5 },
    columnStyles: colStylesCompact2,
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Total por extenso: ${numberToWords(total)}`, MARGIN, y);
  y += 6;

  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  const declaration = `Eu, ${empregadoNome}, já qualificado(a) acima, declaro neste ato ter recebido a quantia de ${formatCurrency(total)} (${numberToWords(total)}), referentes à rescisão de contrato de trabalho não personificada, ${motivoCorpo}, com o ${tipoEmpregador} já identificado acima. E por assim estarmos justos e contratados, firmo o presente termo em uma única via que servirá como recibo para o empregador.`;
  y = addParagraph(doc, declaration, y, { fontSize: 8, compact: true });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${local}, ${dataAss}`, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;
  const sigWidth2 = 55;
  const sigGap2 = 20;
  const totalSigWidth2 = sigWidth2 * 2 + sigGap2;
  const sigStartX2 = (PAGE_WIDTH - totalSigWidth2) / 2;
  const sigCol1b = sigStartX2;
  const sigCol2b = sigStartX2 + sigWidth2 + sigGap2;
  doc.setLineWidth(0.3);
  doc.line(sigCol1b, y, sigCol1b + sigWidth2, y);
  doc.line(sigCol2b, y, sigCol2b + sigWidth2, y);
  y += 4;
  doc.setFontSize(8);
  doc.text(empregadoNome, sigCol1b + sigWidth2 / 2, y, { align: 'center' });
  doc.text(empregadorNome, sigCol2b + sigWidth2 / 2, y, { align: 'center' });
  y += 3;
  doc.setFontSize(7);
  doc.text('EMPREGADO(A)', sigCol1b + sigWidth2 / 2, y, { align: 'center' });
  doc.text('EMPREGADOR', sigCol2b + sigWidth2 / 2, y, { align: 'center' });

  // --- Parte 2: Memória de Cálculo (nova página) ---
  doc.addPage();
  renderMemoriaPages(doc, step1, step2, verbas);

  // Footer em todas as páginas
  addFooterDisclaimer(doc);

  doc.save('termo-e-memoria-de-calculo.pdf');
}

// --- Funções auxiliares extraídas ---

function addFooterDisclaimer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Cálculo estimativo. Pode variar conforme CCT, médias, adicionais, descontos legais e particularidades do contrato.', PAGE_WIDTH / 2, 290, { align: 'center' });
    doc.setTextColor(0);
  }
}

function renderMemoriaPages(doc: jsPDF, step1: Step1Data, step2: Step2Data, verbas: VerbaRescisoria[]) {
  const sal = step1.salarioMensal;
  const total = calcularTotal(verbas);
  const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '—';
  const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '—';
  const motivo = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];

  // Helper: verba exists and has non-zero value
  const verbaAtiva = (id: string) => verbas.some(v => v.id === id && v.valor !== 0);
  const valorVerba = (id: string) => verbas.find(v => v.id === id)?.valor ?? 0;

  let y = addHeader(doc, 'MEMÓRIA DE CÁLCULO — RESCISÃO CLT');
  y += 3;
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_WIDTH / 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Admissão:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAdm, col1X + 25, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Desligamento:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataDesl, col2X + 32, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Salário:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(sal), col1X + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Motivo:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(motivo, col2X + 18, y);
  y += 8;

  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  interface CalcItem { title: string; lines: string[]; }
  const items: CalcItem[] = [];

  if (verbaAtiva('saldo_salario')) {
    const saldoSal = (sal / 30) * step2.diasTrabalhadosMes;
    items.push({ title: 'SALDO DE SALÁRIO', lines: [
      `Verba calculada sobre os dias informados.`,
      `Fórmula: Salário / 30 × dias informados`,
      `${formatCurrency(sal)} / 30 × ${step2.diasTrabalhadosMes} dias = ${formatCurrency(saldoSal)}`,
    ]});
  }

  const decimo = sal * (step2.meses13Proporcional / 12);
  if (verbaAtiva('13_proporcional')) {
    items.push({ title: '13º SALÁRIO PROPORCIONAL', lines: [
      `Fórmula: Salário × (meses / 12)`,
      `${formatCurrency(sal)} × (${step2.meses13Proporcional}/12) = ${formatCurrency(decimo)}`,
    ]});
  }

  const feriasProp = sal * (step2.mesesFeriasProporcional / 12);
  let totalFerias = feriasProp;

  if (verbaAtiva('ferias_proporcionais')) {
    items.push({ title: 'FÉRIAS PROPORCIONAIS', lines: [
      `Fórmula: Salário × (meses / 12)`,
      `${formatCurrency(sal)} × (${step2.mesesFeriasProporcional}/12) = ${formatCurrency(feriasProp)}`,
    ]});
  }

  if (step1.temFeriasVencidas && step1.periodosVencidos > 0 && verbaAtiva('ferias_vencidas')) {
    const fv = sal * step1.periodosVencidos;
    totalFerias += fv;
    items.push({ title: 'FÉRIAS VENCIDAS', lines: [
      `Fórmula: Salário × períodos vencidos`,
      `${formatCurrency(sal)} × ${step1.periodosVencidos} = ${formatCurrency(fv)}`,
    ]});
  }

  if (step2.consideraTercoFerias && verbaAtiva('terco_ferias')) {
    const terco = totalFerias / 3;
    items.push({ title: '1/3 CONSTITUCIONAL SOBRE FÉRIAS', lines: [
      `Fórmula: (Férias proporcionais${step1.temFeriasVencidas ? ' + vencidas' : ''}) / 3`,
      `${formatCurrency(totalFerias)} / 3 = ${formatCurrency(terco)}`,
    ]});
  }

  if (step1.calculaAvisoPrevioIndenizado && verbaAtiva('aviso_previo_indenizado')) {
    const diasAviso = step1.diasAvisoPrevioIndenizado;
    const av = (sal / 30) * diasAviso;
    const mesesProj = diasAviso / 30;
    const avos = Math.round(mesesProj);
    items.push({ title: 'AVISO PRÉVIO INDENIZADO', lines: [
      `Fórmula: Salário / 30 × dias de aviso`,
      `${formatCurrency(sal)} / 30 × ${diasAviso} = ${formatCurrency(av)}`,
    ]});

    if (verbaAtiva('reflexo_aviso_13')) {
      const reflexo13 = (sal / 12) * mesesProj;
      items.push({ title: '13º — PROJEÇÃO AVISO PRÉVIO', lines: [
        `Fórmula: Salário / 12 × meses projeção`,
        `${formatCurrency(sal)} / 12 × ${avos} = ${formatCurrency(reflexo13)}`,
      ]});
    }

    if (verbaAtiva('reflexo_aviso_ferias')) {
      const reflexoFerias = (sal / 12) * mesesProj;
      items.push({ title: 'FÉRIAS — PROJEÇÃO AVISO PRÉVIO', lines: [
        `Fórmula: Salário / 12 × meses projeção`,
        `${formatCurrency(sal)} / 12 × ${avos} = ${formatCurrency(reflexoFerias)}`,
      ]});

      if (step2.consideraTercoFerias && verbaAtiva('reflexo_aviso_terco')) {
        const tercoRef = reflexoFerias / 3;
        items.push({ title: '1/3 FÉRIAS — PROJEÇÃO AVISO PRÉVIO', lines: [
          `${formatCurrency(reflexoFerias)} / 3 = ${formatCurrency(tercoRef)}`,
        ]});
      }
    }
  }

  if (step1.motivo === 'pedido_demissao' && step1.descontaAvisoPrevio && verbaAtiva('desconto_aviso')) {
    const desc = (sal / 30) * step1.diasAvisoDesconto;
    items.push({ title: 'DESCONTO AVISO PRÉVIO (DÉBITO)', lines: [
      `Fórmula: Salário / 30 × dias de aviso`,
      `${formatCurrency(sal)} / 30 × ${step1.diasAvisoDesconto} = -${formatCurrency(desc)}`,
    ]});
  }

  if (step1.calculaFGTS && verbaAtiva('fgts')) {
    if (step2.fgtsManual !== null && step2.fgtsManual > 0) {
      items.push({ title: 'FGTS DO PERÍODO (manual)', lines: [
        `Valor informado: ${formatCurrency(step2.fgtsManual)}`,
      ]});
    } else {
      const fgtsDetail = calcularFgtsDetalhado(
        sal, step1.dataAdmissao, step1.dataDesligamento,
        decimo, step2.incluir13AnosAnteriores, step2.diasTrabalhadosMes,
        step1.fgtsApenasMesRescisao,
      );

      const fgtsLines: string[] = [
        step1.fgtsApenasMesRescisao
          ? `Apenas mês da rescisão (empregador já recolheu meses anteriores)`
          : `Fórmula mensal: Salário / 30 × dias trabalhados`,
        '',
        'Detalhamento mês a mês:',
      ];
      fgtsDetail.meses.forEach(m => {
        fgtsLines.push(`  ${m.mes}: ${m.diasTrabalhados} dias → ${formatCurrency(m.valorBase)}`);
      });
      fgtsLines.push('');
      fgtsLines.push(`Subtotal salarial: ${formatCurrency(fgtsDetail.baseSalarial)}`);
      fgtsLines.push(`+ 13º proporcional: ${formatCurrency(fgtsDetail.baseDecimo)}`);
      if (fgtsDetail.base13Anterior > 0) {
        fgtsLines.push(`+ 13º anos anteriores: ${formatCurrency(fgtsDetail.base13Anterior)}`);
      }
      fgtsLines.push(`Base total: ${formatCurrency(fgtsDetail.baseTotal)}`);
      fgtsLines.push(`FGTS = 8% × ${formatCurrency(fgtsDetail.baseTotal)} = ${formatCurrency(fgtsDetail.fgtsTotal)}`);
      items.push({ title: 'FGTS DO PERÍODO — DETALHAMENTO MÊS A MÊS', lines: fgtsLines });

    }
  }

  // FGTS sobre aviso prévio e reflexos
  if (step1.calculaFGTS && verbaAtiva('fgts_aviso')) {
    const avisoInd = valorVerba('aviso_previo_indenizado');
    const reflex13 = valorVerba('reflexo_aviso_13');
    const reflexFer = valorVerba('reflexo_aviso_ferias');
    const reflexTerco = valorVerba('reflexo_aviso_terco');
    const baseAviso = avisoInd + reflex13 + reflexFer + reflexTerco;
    const fgtsAviso = valorVerba('fgts_aviso');
    items.push({ title: 'FGTS SOBRE AVISO PRÉVIO E REFLEXOS', lines: [
      `Fórmula: 8% × (aviso prévio indenizado + reflexos no 13º, férias e 1/3)`,
      `Base: ${formatCurrency(avisoInd)} + ${formatCurrency(reflex13)} + ${formatCurrency(reflexFer)} + ${formatCurrency(reflexTerco)} = ${formatCurrency(baseAviso)}`,
      `FGTS = 8% × ${formatCurrency(baseAviso)} = ${formatCurrency(fgtsAviso)}`,
    ]});
  }

  // FGTS sobre verbas adicionais
  if (step1.calculaFGTS && verbaAtiva('fgts_outros_creditos')) {
    const creditosFgts = (step2.outrosCreditos || []).filter((c) => c.incideFGTS && c.valor > 0);
    const baseOutros = creditosFgts.reduce((acc, c) => acc + c.valor, 0);
    const fgtsOutros = valorVerba('fgts_outros_creditos');
    const linhas: string[] = [`Fórmula: 8% × soma das verbas adicionais com incidência de FGTS`];
    creditosFgts.forEach((c) => {
      linhas.push(`• ${(c.descricao || 'Verba adicional')}: ${formatCurrency(c.valor)}`);
    });
    linhas.push(`Base: ${formatCurrency(baseOutros)}`);
    linhas.push(`FGTS = 8% × ${formatCurrency(baseOutros)} = ${formatCurrency(fgtsOutros)}`);
    items.push({ title: 'FGTS SOBRE VERBAS ADICIONAIS', lines: linhas });
  }

  // Multa FGTS
  if (step1.calculaFGTS && step1.calculaMultaFGTS && step1.percentualMultaFGTS > 0 && verbaAtiva('multa_fgts')) {
    const fgtsPer = valorVerba('fgts');
    const fgtsAv = valorVerba('fgts_aviso');
    const fgtsAd = valorVerba('fgts_outros_creditos');
    const baseMulta = fgtsPer + fgtsAv + fgtsAd;
    const multa = valorVerba('multa_fgts');
    items.push({ title: 'MULTA FGTS', lines: [
      `Fórmula: ${step1.percentualMultaFGTS}% × (FGTS período + FGTS aviso + FGTS verbas adicionais)`,
      `Base: ${formatCurrency(fgtsPer)} + ${formatCurrency(fgtsAv)} + ${formatCurrency(fgtsAd)} = ${formatCurrency(baseMulta)}`,
      `= ${step1.percentualMultaFGTS}% × ${formatCurrency(baseMulta)} = ${formatCurrency(multa)}`,
    ]});
  }

  step2.outrosCreditos.forEach((c, idx) => {
    if (c.valor > 0 && verbaAtiva(`outros_creditos_${idx}`)) {
      items.push({ title: (c.descricao || 'OUTROS CRÉDITOS').toUpperCase(), lines: [formatCurrency(c.valor)] });
    }
  });
  step2.outrosDescontos.forEach((d, idx) => {
    if (d.valor > 0 && verbaAtiva(`outros_descontos_${idx}`)) {
      items.push({ title: (d.descricao || 'OUTROS DESCONTOS').toUpperCase() + ' (DÉBITO)', lines: [`-${formatCurrency(d.valor)}`] });
    }
  });

  items.forEach((item, idx) => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${idx + 1}) ${item.title}`, MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    item.lines.forEach(line => {
      y = checkPageBreak(doc, y, 6);
      doc.text(`   ${line}`, MARGIN, y);
      y += 5;
    });
    y += 3;
  });

  y = checkPageBreak(doc, y, 15);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`TOTAL GERAL: ${formatCurrency(total)}`, MARGIN, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Por extenso: ${numberToWords(total)}`, MARGIN, y);
}
