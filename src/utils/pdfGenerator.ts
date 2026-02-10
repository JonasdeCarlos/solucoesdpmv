import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Step1Data, type Step2Data, type Step3Data, type VerbaRescisoria, calcularTotal, MOTIVO_TERMO_TITULO, MOTIVO_TERMO_CORPO, MOTIVO_LABELS } from './calculations';
import { calcularFgtsDetalhado } from './fgtsDetail';
import { formatCurrency, formatDate } from './formatters';
import { numberToWords } from './numberToWords';

const MARGIN = 25;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addHeader(doc: jsPDF, title: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const lines = doc.splitTextToSize(title, CONTENT_WIDTH);
  doc.text(lines, PAGE_WIDTH / 2, MARGIN + 5, { align: 'center' });
  return MARGIN + 5 + lines.length * 6 + 4;
}

function addParagraph(doc: jsPDF, text: string, y: number, opts?: { bold?: boolean; fontSize?: number; align?: 'left' | 'center' | 'justify' }): number {
  const fontSize = opts?.fontSize ?? 10;
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  
  // Check if we need a new page
  if (y + lines.length * 5 > 280) {
    doc.addPage();
    y = MARGIN;
  }
  
  doc.text(lines, MARGIN, y, { align: opts?.align ?? 'left', maxWidth: CONTENT_WIDTH });
  return y + lines.length * 5 + 3;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function generateTermoPDF(step1: Step1Data, step2: Step2Data, step3: Step3Data, verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const total = calcularTotal(verbas);
  const motivoTitulo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toUpperCase() || 'OUTROS') : MOTIVO_TERMO_TITULO[step1.motivo];
  const motivoCorpo = step1.motivo === 'outros' ? (step1.motivoOutroTexto.toLowerCase() || 'outros') : MOTIVO_TERMO_CORPO[step1.motivo];
  const tipoEmpregador = step3.empregadorTipo === 'domestico' ? 'empregador doméstico' : 'empresa';
  const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '___/___/______';
  const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '___/___/______';
  const hoje = formatDate(new Date());

  // Title
  let y = addHeader(doc, `TERMO DE RESCISÃO DE CONTRATO DE TRABALHO EM COMUM, NÃO PERSONIFICADO, ${motivoTitulo}.`);

  // Horizontal line
  y += 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // Parties paragraph
  const empregadorNome = step3.empregadorNome || '[NOME DO EMPREGADOR]';
  const empregadorCPF = step3.empregadorCPF || '[CPF]';
  const empregadorEnd = step3.empregadorEndereco || '[ENDEREÇO]';
  const empregadoNome = step3.empregadoNome || '[NOME DO EMPREGADO]';
  const empregadoCPF = step3.empregadoCPF || '[CPF]';
  const empregadoEnd = step3.empregadoEndereco || '[ENDEREÇO]';
  const cnpjPart = step3.empregadorTipo === 'empresa' && step3.empregadorCNPJ ? `, inscrita no CNPJ/MF sob nº ${step3.empregadorCNPJ}` : '';

  const partiesParagraph = `Pelo presente instrumento e na melhor forma de direito, as partes, de um lado, ${empregadorNome}, inscrito(a) no CPF/MF sob nº ${empregadorCPF}${cnpjPart}, residente e domiciliado(a) ${empregadorEnd}, doravante denominado(a) simplesmente EMPREGADOR, e do outro lado, ${empregadoNome}, inscrito(a) no CPF/MF sob nº ${empregadoCPF}, residente e domiciliado(a) ${empregadoEnd}, doravante denominado(a) simplesmente EMPREGADO(A), resolvem rescindir o contrato de trabalho firmado entre as partes, conforme segue.`;

  y = addParagraph(doc, partiesParagraph, y);
  y += 3;

  // Contract details section
  y = addParagraph(doc, 'DADOS DO CONTRATO', y, { bold: true, fontSize: 11 });
  y += 1;

  // Two-column layout for contract info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_WIDTH / 2;

  y = checkPageBreak(doc, y, 25);
  
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
  doc.text(formatCurrency(step1.salarioMensal), col1X + 18, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Motivo:', col2X, y);
  doc.setFont('helvetica', 'normal');
  const motivoLabel = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];
  const motivoLines = doc.splitTextToSize(motivoLabel, CONTENT_WIDTH / 2 - 20);
  doc.text(motivoLines, col2X + 18, y);
  y += Math.max(6, motivoLines.length * 5) + 4;

  // Separator
  y = checkPageBreak(doc, y, 5);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  // Verbas table header
  y = addParagraph(doc, 'DEMONSTRATIVO DE VERBAS RESCISÓRIAS', y, { bold: true, fontSize: 11 });
  y += 2;

  // Table using autoTable
  const tableBody = verbas.map(v => [
    v.verba,
    v.referencia,
    v.tipo === 'debito' ? '' : formatCurrency(v.valor),
    v.tipo === 'debito' ? formatCurrency(v.valor) : '',
  ]);

  // Total row
  tableBody.push([
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' as const } } as any,
    '',
    { content: formatCurrency(Math.max(0, total)), styles: { fontStyle: 'bold' as const } } as any,
    { content: total < 0 ? formatCurrency(Math.abs(total)) : '', styles: { fontStyle: 'bold' as const } } as any,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['VERBA', 'REF', 'CRÉDITO (R$)', 'DÉBITO (R$)']],
    body: tableBody,
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
      0: { cellWidth: 65 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Total por extenso
  y = checkPageBreak(doc, y, 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total por extenso: ${numberToWords(total)}`, MARGIN, y);
  y += 10;

  // Declaration
  y = checkPageBreak(doc, y, 30);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  const declaration = `Eu, ${empregadoNome}, já qualificado(a) acima, declaro neste ato ter recebido a quantia de ${formatCurrency(total)} (${numberToWords(total)}), referentes à rescisão de contrato de trabalho não personificada, ${motivoCorpo}, com o ${tipoEmpregador} já identificado acima. E por assim estarmos justos e contratados, firmo o presente termo em uma única via que servirá como recibo para o empregador.`;

  y = addParagraph(doc, declaration, y);
  y += 15;

  // Signature area
  y = checkPageBreak(doc, y, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`________________, ${hoje}`, MARGIN, y);
  y += 20;

  // Two signature columns
  const sigCol1 = MARGIN + 10;
  const sigCol2 = PAGE_WIDTH / 2 + 10;

  doc.setLineWidth(0.3);
  doc.line(sigCol1, y, sigCol1 + 55, y);
  doc.line(sigCol2, y, sigCol2 + 55, y);
  y += 5;

  doc.setFontSize(9);
  doc.text(empregadoNome, sigCol1, y);
  doc.text(empregadorNome, sigCol2, y);
  y += 4;
  doc.setFontSize(8);
  doc.text('EMPREGADO(A)', sigCol1, y);
  doc.text('EMPREGADOR', sigCol2, y);

  // Footer disclaimer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Cálculo estimativo. Pode variar conforme CCT, médias, adicionais, descontos legais e particularidades do contrato.', PAGE_WIDTH / 2, 290, { align: 'center' });
    doc.setTextColor(0);
  }

  doc.save('termo-rescisao.pdf');
}

export function generateDemonstrativoPDF(verbas: VerbaRescisoria[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const total = calcularTotal(verbas);

  let y = addHeader(doc, 'DEMONSTRATIVO DE VERBAS RESCISÓRIAS');
  y += 5;

  const tableBody = verbas.map(v => [
    v.verba,
    v.referencia,
    v.tipo === 'debito' ? '' : formatCurrency(v.valor),
    v.tipo === 'debito' ? formatCurrency(v.valor) : '',
  ]);

  tableBody.push([
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' as const } } as any,
    '',
    { content: formatCurrency(Math.max(0, total)), styles: { fontStyle: 'bold' as const } } as any,
    { content: total < 0 ? formatCurrency(Math.abs(total)) : '', styles: { fontStyle: 'bold' as const } } as any,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['VERBA', 'REF', 'CRÉDITO (R$)', 'DÉBITO (R$)']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' } },
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
  const sal = step1.salarioMensal;
  const total = calcularTotal(verbas);
  const dataAdm = step1.dataAdmissao ? formatDate(step1.dataAdmissao) : '—';
  const dataDesl = step1.dataDesligamento ? formatDate(step1.dataDesligamento) : '—';
  const motivo = step1.motivo === 'outros' ? (step1.motivoOutroTexto || 'Outros') : MOTIVO_LABELS[step1.motivo];

  let y = addHeader(doc, 'MEMÓRIA DE CÁLCULO — RESCISÃO CLT');
  y += 3;
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // Contract info in two columns
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

  // Build calculation items
  interface CalcItem { title: string; lines: string[]; }
  const items: CalcItem[] = [];

  // Saldo
  const saldoSal = (sal / 30) * step2.diasTrabalhadosMes;
  items.push({ title: 'SALDO DE SALÁRIO', lines: [
    `Fórmula: Salário / 30 × dias trabalhados no mês`,
    `${formatCurrency(sal)} / 30 × ${step2.diasTrabalhadosMes} = ${formatCurrency(saldoSal)}`,
  ]});

  // 13º
  const decimo = sal * (step2.meses13Proporcional / 12);
  items.push({ title: '13º SALÁRIO PROPORCIONAL', lines: [
    `Fórmula: Salário × (meses / 12)`,
    `${formatCurrency(sal)} × (${step2.meses13Proporcional}/12) = ${formatCurrency(decimo)}`,
  ]});

  // Férias proporcionais
  const feriasProp = sal * (step2.mesesFeriasProporcional / 12);
  items.push({ title: 'FÉRIAS PROPORCIONAIS', lines: [
    `Fórmula: Salário × (meses / 12)`,
    `${formatCurrency(sal)} × (${step2.mesesFeriasProporcional}/12) = ${formatCurrency(feriasProp)}`,
  ]});

  let totalFerias = feriasProp;

  if (step1.temFeriasVencidas && step1.periodosVencidos > 0) {
    const fv = sal * step1.periodosVencidos;
    totalFerias += fv;
    items.push({ title: 'FÉRIAS VENCIDAS', lines: [
      `Fórmula: Salário × períodos vencidos`,
      `${formatCurrency(sal)} × ${step1.periodosVencidos} = ${formatCurrency(fv)}`,
    ]});
  }

  if (step2.consideraTercoFerias) {
    const terco = totalFerias / 3;
    items.push({ title: '1/3 CONSTITUCIONAL SOBRE FÉRIAS', lines: [
      `Fórmula: (Férias proporcionais${step1.temFeriasVencidas ? ' + vencidas' : ''}) / 3`,
      `${formatCurrency(totalFerias)} / 3 = ${formatCurrency(terco)}`,
    ]});
  }

  if (step1.calculaAvisoPrevioIndenizado) {
    const av = (sal / 30) * step1.diasAvisoPrevioIndenizado;
    items.push({ title: 'AVISO PRÉVIO INDENIZADO', lines: [
      `Fórmula: Salário / 30 × dias de aviso`,
      `${formatCurrency(sal)} / 30 × ${step1.diasAvisoPrevioIndenizado} = ${formatCurrency(av)}`,
    ]});
  }

  if (step1.motivo === 'pedido_demissao' && step1.descontaAvisoPrevio) {
    const desc = (sal / 30) * step1.diasAvisoDesconto;
    items.push({ title: 'DESCONTO AVISO PRÉVIO (DÉBITO)', lines: [
      `Fórmula: Salário / 30 × dias de aviso`,
      `${formatCurrency(sal)} / 30 × ${step1.diasAvisoDesconto} = -${formatCurrency(desc)}`,
    ]});
  }

  if (step1.calculaFGTS) {
    if (step2.fgtsManual !== null && step2.fgtsManual > 0) {
      items.push({ title: 'FGTS DO PERÍODO (manual)', lines: [
        `Valor informado: ${formatCurrency(step2.fgtsManual)}`,
      ]});
    } else {
      const fgtsDetail = calcularFgtsDetalhado(
        sal, step1.dataAdmissao, step1.dataDesligamento,
        decimo, step2.incluir13AnosAnteriores
      );

      const fgtsLines: string[] = [
        `Fórmula mensal: Salário / 30 × dias trabalhados`,
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

      if (step1.calculaMultaFGTS && step1.percentualMultaFGTS > 0) {
        const multa = fgtsDetail.fgtsTotal * (step1.percentualMultaFGTS / 100);
        items.push({ title: 'MULTA FGTS', lines: [
          `${step1.percentualMultaFGTS}% × ${formatCurrency(fgtsDetail.fgtsTotal)} = ${formatCurrency(multa)}`,
        ]});
      }
    }
  }

  if (step2.outrosCreditos > 0) items.push({ title: 'OUTROS CRÉDITOS', lines: [formatCurrency(step2.outrosCreditos)] });
  if (step2.outrosDescontos > 0) items.push({ title: 'OUTROS DESCONTOS (DÉBITO)', lines: [`-${formatCurrency(step2.outrosDescontos)}`] });

  // Render items
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

  // Total
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

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Cálculo estimativo. Pode variar conforme CCT, médias, adicionais, descontos legais e particularidades do contrato.', PAGE_WIDTH / 2, 290, { align: 'center' });
    doc.setTextColor(0);
  }

  doc.save('memoria-de-calculo.pdf');
}
