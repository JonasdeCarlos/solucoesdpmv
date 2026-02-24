import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CprbConsolidatedResult } from './cprbCalculations';
import { DasConsolidatedResult } from './dasCalculations';
import { CprbPremissas } from '@/components/cprb/CprbStep1Premissas';
import { formatCurrency } from './formatters';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addHeader(doc: jsPDF, title: string, y?: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const startY = y ?? MARGIN + 5;
  const lines = doc.splitTextToSize(title, CONTENT_WIDTH);
  doc.text(lines, PAGE_WIDTH / 2, startY, { align: 'center' });
  return startY + lines.length * 5 + 4;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, MARGIN, y);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 1.5, PAGE_WIDTH - MARGIN, y + 1.5);
  return y + 6;
}

function addText(doc: jsPDF, text: string, y: number, opts?: { bold?: boolean; fontSize?: number }): number {
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(opts?.fontSize ?? 9);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  y = checkPageBreak(doc, y, lines.length * 4);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 4 + 2;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addKeyValue(doc: jsPDF, key: string, value: string, y: number, x?: number): number {
  const xPos = x ?? MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${key}:`, xPos, y);
  doc.setFont('helvetica', 'normal');
  doc.text(value, xPos + doc.getTextWidth(`${key}: `) + 1, y);
  return y;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text(
      'Simulação para apoio gerencial. Validar enquadramento legal, CNAE e regras vigentes antes de qualquer decisão tributária.',
      PAGE_WIDTH / 2, 290, { align: 'center' }
    );
    doc.text(`Página ${i} de ${pageCount}`, PAGE_WIDTH - MARGIN, 290, { align: 'right' });
    doc.setTextColor(0);
  }
}

function renderRelatorioCprb(
  doc: jsPDF,
  premissas: CprbPremissas,
  result: CprbConsolidatedResult,
  dasResult: DasConsolidatedResult | null
) {
  let y = addHeader(doc, 'RELATÓRIO COMPARATIVO — CPRB x FOLHA');

  // Dados da empresa
  y = addSectionTitle(doc, 'DADOS DA EMPRESA', y);
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  addKeyValue(doc, 'Empresa', premissas.empresaNome || '—', y);
  addKeyValue(doc, 'CNPJ', premissas.cnpj || '—', y, col2X);
  y += 5;
  addKeyValue(doc, 'CNAE', premissas.cnae || '—', y);
  addKeyValue(doc, 'Regime', 'Simples Nacional', y, col2X);
  y += 5;
  addKeyValue(doc, 'Competência', premissas.competenciaInicial, y);
  addKeyValue(doc, 'Horizonte', `${premissas.horizonteMeses} meses`, y, col2X);
  y += 8;

  // Premissas econômicas
  y = addSectionTitle(doc, 'PREMISSAS DA SIMULAÇÃO', y);
  addKeyValue(doc, 'Receita Total', formatCurrency(premissas.receitaTotal), y);
  addKeyValue(doc, 'Folha Total', formatCurrency(premissas.folhaTotal), y, col2X);
  y += 5;
  addKeyValue(doc, 'Área (m²)', String(premissas.areaM2Total || '—'), y);
  addKeyValue(doc, 'Crescimento/mês', `${(premissas.percentualCrescimento * 100).toFixed(1)}%`, y, col2X);
  y += 5;

  const encargos: string[] = [];
  if (premissas.incluirFerias) encargos.push('Férias');
  if (premissas.incluirTercoFerias) encargos.push('1/3 Férias');
  if (premissas.incluirDecimoTerceiro) encargos.push('13º');
  if (premissas.incluirFgts) encargos.push('FGTS');
  if (premissas.incluirMultaFgts) encargos.push(`Multa FGTS (${(premissas.percentualMultaFgts * 100).toFixed(0)}%)`);
  if (premissas.incluirRatFap) encargos.push(`RAT/FAP (${(premissas.aliquotaRatFap * 100).toFixed(1)}%)`);
  if (premissas.incluirTerceiros) encargos.push(`Terceiros (${(premissas.aliquotaTerceiros * 100).toFixed(1)}%)`);
  y = addText(doc, `Encargos ativos: ${encargos.join(', ') || 'Nenhum'}`, y);
  y += 3;

  // Resultado comparativo
  y = addSectionTitle(doc, 'RESULTADO COMPARATIVO', y);
  const vantagemLabel = result.vantajosidade === 'cprb' ? 'CPRB MAIS VANTAJOSA'
    : result.vantajosidade === 'folha' ? 'FOLHA MAIS VANTAJOSA' : 'EMPATE TÉCNICO';
  y = addText(doc, `Vantajosidade: ${vantagemLabel}`, y, { bold: true, fontSize: 11 });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Indicador', 'Cenário CPRB', 'Cenário Folha']],
    body: [
      ['Custo Tributário (12m)', formatCurrency(result.totalCustoCprb), formatCurrency(result.totalCustoFolha)],
      ['Custo Mão de Obra (12m)', formatCurrency(result.custoMaoObraTotalCprb), formatCurrency(result.custoMaoObraTotalFolha)],
      ['Custo/m²', formatCurrency(result.custoM2MedioCprb), formatCurrency(result.custoM2MedioFolha)],
      ['Economia', formatCurrency(result.economiaCprb), `${result.economiaPercentual.toFixed(1)}%`],
      ['Índice Receita/Folha', result.indiceReceitaFolha.toFixed(2), ''],
      ['Break-even', result.breakEvenRatio.toFixed(2), ''],
    ],
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // DAS Integration
  if (dasResult && premissas.incluirDasNoM2) {
    y = addSectionTitle(doc, 'SIMULAÇÃO DAS (SIMPLES NACIONAL) — INTEGRADO', y);
    const areaM2 = premissas.areaM2Total || 1;
    const custoM2CprbDas = (result.custoMaoObraTotalCprb + dasResult.totalDas) / areaM2;
    const custoM2FolhaDas = (result.custoMaoObraTotalFolha + dasResult.totalDas) / areaM2;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Indicador', 'Valor']],
      body: [
        ['DAS Estimado (12m)', formatCurrency(dasResult.totalDas)],
        ['Alíquota Efetiva Média', `${(dasResult.aliquotaEfetivaMedia * 100).toFixed(2)}%`],
        ['Anexo', premissas.dasAnexo],
        ['RBT12 Inicial', formatCurrency(premissas.dasRbt12Inicial)],
        ['Custo/m² CPRB + DAS', formatCurrency(Math.round(custoM2CprbDas * 100) / 100)],
        ['Custo/m² Folha + DAS', formatCurrency(Math.round(custoM2FolhaDas * 100) / 100)],
      ],
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Ressalvas
  y = addSectionTitle(doc, 'RISCOS E RESSALVAS', y);
  const ressalvas = [
    'Simulação para apoio à decisão. Validar enquadramento CNAE/atividade e interpretação tributária com contador/consultoria.',
    'Os valores projetados dependem das premissas informadas e podem divergir da realidade.',
    'A opção pela CPRB é irretratável para o ano-calendário e deve ser exercida conforme legislação vigente.',
    'A reoneração gradual segue os percentuais da Lei 14.973/2024 e pode sofrer alterações legislativas.',
  ];
  ressalvas.forEach((r) => {
    y = addText(doc, `• ${r}`, y);
  });

  return y;
}

function renderMemoriaCalculo(
  doc: jsPDF,
  premissas: CprbPremissas,
  result: CprbConsolidatedResult,
  dasResult: DasConsolidatedResult | null
) {
  let y = addHeader(doc, 'MEMÓRIA DE CÁLCULO — COMPARATIVO CPRB x FOLHA');

  // Tabela mensal CPRB
  y = addSectionTitle(doc, 'SIMULAÇÃO MENSAL — CPRB x FOLHA', y);
  y = addText(doc, `Receita total: ${formatCurrency(premissas.receitaTotal)} | Folha total: ${formatCurrency(premissas.folhaTotal)} | Horizonte: ${premissas.horizonteMeses} meses`, y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Comp.', 'Receita', 'Folha', 'CPRB s/ Receita', 'Folha (trans.)', 'Total CPRB', 'Total Folha', 'Diferença']],
    body: [
      ...result.monthly.map((m) => [
        m.competencia,
        formatCurrency(m.receitaMes),
        formatCurrency(m.folhaMes),
        formatCurrency(m.cprbValor),
        formatCurrency(m.contribFolhaTransicao),
        formatCurrency(m.custoCenarioCprb),
        formatCurrency(m.custoCenarioFolha),
        formatCurrency(m.diferencaAbsoluta),
      ]),
      [
        { content: 'TOTAL', styles: { fontStyle: 'bold' as const } },
        { content: formatCurrency(result.totalReceitaProjetada), styles: { fontStyle: 'bold' as const } },
        { content: formatCurrency(result.totalFolhaProjetada), styles: { fontStyle: 'bold' as const } },
        '', '',
        { content: formatCurrency(result.totalCustoCprb), styles: { fontStyle: 'bold' as const } },
        { content: formatCurrency(result.totalCustoFolha), styles: { fontStyle: 'bold' as const } },
        { content: formatCurrency(result.economiaCprb), styles: { fontStyle: 'bold' as const } },
      ],
    ],
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Custo mão de obra por m²
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, 'CUSTO DE MÃO DE OBRA POR m²', y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Comp.', 'Folha', 'Custo MO CPRB', 'Custo MO Folha', 'R$/m² CPRB', 'R$/m² Folha']],
    body: result.monthly.map((m) => [
      m.competencia,
      formatCurrency(m.folhaMes),
      formatCurrency(m.custoMaoObraCprb),
      formatCurrency(m.custoMaoObraFolha),
      formatCurrency(m.custoM2Cprb),
      formatCurrency(m.custoM2Folha),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Encargos gerenciais
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, 'COMPOSIÇÃO DOS ENCARGOS GERENCIAIS', y);

  const encargosItems: [string, string][] = [];
  if (premissas.incluirFerias) encargosItems.push(['Férias (1/12)', '8,33%']);
  if (premissas.incluirTercoFerias) encargosItems.push(['1/3 Férias', '2,78%']);
  if (premissas.incluirDecimoTerceiro) encargosItems.push(['13º Salário (1/12)', '8,33%']);
  if (premissas.incluirFgts) encargosItems.push(['FGTS Mensal', '8,00%']);
  if (premissas.incluirMultaFgts) encargosItems.push(['Multa FGTS', `${(premissas.percentualMultaFgts * 100).toFixed(0)}% × FGTS × rotatividade`]);
  if (premissas.incluirRatFap) encargosItems.push(['RAT/FAP', `${(premissas.aliquotaRatFap * 100).toFixed(1)}%`]);
  if (premissas.incluirTerceiros) encargosItems.push(['Terceiros (Sist. S)', `${(premissas.aliquotaTerceiros * 100).toFixed(1)}%`]);

  if (encargosItems.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Componente', '% sobre Folha']],
      body: encargosItems,
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Fórmulas
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, 'FÓRMULAS APLICADAS', y);
  y = addText(doc, 'Cenário CPRB:', y, { bold: true });
  y = addText(doc, 'CPRB = Receita × Alíquota CPRB × % Transição CPRB', y);
  y = addText(doc, 'Contrib. Folha = Folha × % Transição Folha', y);
  y = addText(doc, 'Total CPRB = CPRB + Contrib. Folha', y);
  y += 2;
  y = addText(doc, 'Cenário Folha:', y, { bold: true });
  y = addText(doc, 'Total Folha = Folha × Alíquota Patronal (20%)', y);
  y += 2;
  y = addText(doc, 'Custo Mão de Obra = Folha + Encargos Gerenciais + Custo Tributário', y);
  y = addText(doc, 'Custo/m² = Custo Mão de Obra ÷ Área (m²)', y);
  y += 2;
  y = addText(doc, `Break-even R/F = (Alíq. Patronal − % Trans. Folha) ÷ (Alíq. CPRB × % Trans. CPRB) = ${result.breakEvenRatio.toFixed(2)}`, y);

  // DAS memory
  if (dasResult && premissas.incluirDasNoM2) {
    doc.addPage();
    y = addHeader(doc, 'MEMÓRIA DE CÁLCULO — DAS (SIMPLES NACIONAL)');

    y = addSectionTitle(doc, 'FÓRMULA DO DAS', y);
    y = addText(doc, 'Alíquota Efetiva = ((RBT12 × Alíquota Nominal) − Parcela a Deduzir) ÷ RBT12', y, { bold: true });
    y = addText(doc, 'DAS Estimado = Receita do Mês × Alíquota Efetiva', y, { bold: true });
    y += 3;

    y = addSectionTitle(doc, 'SIMULAÇÃO MENSAL DO DAS', y);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Comp.', 'Receita', 'RBT12', 'Faixa', 'Alíq. Nominal', 'Parc. Deduzir', 'Alíq. Efetiva', 'DAS']],
      body: dasResult.monthly.map((m) => {
        const main = m.porAnexo[0];
        return [
          m.competencia,
          formatCurrency(m.receitaMes),
          formatCurrency(m.rbt12),
          String(main?.faixaAplicada || '—'),
          main ? `${(main.aliquotaNominal * 100).toFixed(2)}%` : '—',
          main ? formatCurrency(main.parcelaDeduzir) : '—',
          `${(m.aliquotaEfetivaPonderada * 100).toFixed(2)}%`,
          formatCurrency(m.dasTotal),
        ];
      }),
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Custo/m² consolidado com DAS
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, 'CUSTO POR m² CONSOLIDADO (COM DAS)', y);
    const areaM2 = premissas.areaM2Total || 1;
    const custoM2CprbDas = (result.custoMaoObraTotalCprb + dasResult.totalDas) / areaM2;
    const custoM2FolhaDas = (result.custoMaoObraTotalFolha + dasResult.totalDas) / areaM2;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Indicador', 'Sem DAS', 'Com DAS']],
      body: [
        ['Custo/m² CPRB', formatCurrency(result.custoM2MedioCprb), formatCurrency(Math.round(custoM2CprbDas * 100) / 100)],
        ['Custo/m² Folha', formatCurrency(result.custoM2MedioFolha), formatCurrency(Math.round(custoM2FolhaDas * 100) / 100)],
        ['DAS Total (12m)', '—', formatCurrency(dasResult.totalDas)],
      ],
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  return y;
}

export function generateCprbRelatorioPDF(
  premissas: CprbPremissas,
  result: CprbConsolidatedResult,
  dasResult: DasConsolidatedResult | null
) {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Page 1+: Relatório
  renderRelatorioCprb(doc, premissas, result, dasResult);

  // New pages: Memória de Cálculo
  doc.addPage();
  renderMemoriaCalculo(doc, premissas, result, dasResult);

  addFooter(doc);

  const nomeEmpresa = premissas.empresaNome ? premissas.empresaNome.replace(/\s+/g, '-').toLowerCase() : 'simulacao';
  doc.save(`relatorio-cprb-${nomeEmpresa}-${premissas.competenciaInicial}.pdf`);
}
