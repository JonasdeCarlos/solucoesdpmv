import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { JornadaParams, JornadaDiaConfig } from '@/types/jornada';
import type { JornadaAnalise } from '@/types/jornada';
import { minutesToHHMM } from './jornadaCalculations';

interface PdfOptions {
  params: JornadaParams;
  dias: JornadaDiaConfig[];
  analise: JornadaAnalise;
  observacoesAnalista: string;
  dataEmissao: string;
}

export function gerarParecerPdf(opts: PdfOptions): jsPDF {
  const { params, dias, analise, observacoesAnalista, dataEmissao } = opts;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const mx = 15;
  const contentW = pw - mx * 2;
  let y = 15;

  const addFooter = () => {
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Monte Verde Contabilidade – Parecer de Jornada (CLT)', mx, ph - 8);
    doc.text(`Emitido em: ${dataEmissao}`, pw - mx, ph - 8, { align: 'right' });
    doc.setTextColor(0);
  };

  const checkPage = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - 20) {
      addFooter();
      doc.addPage();
      y = 15;
    }
  };

  // HEADER
  doc.setFillColor(98, 142, 63); // #628E3F
  doc.rect(0, 0, pw, 28, 'F');
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PARECER DE VERIFICAÇÃO DE JORNADA (CLT)', pw / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de emissão: ${dataEmissao}`, pw / 2, 20, { align: 'center' });
  doc.setTextColor(0);
  y = 35;

  // IDENTIFICATION
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTIFICAÇÃO', mx, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const idLines = [
    [`Empresa: ${params.empresaNome || '–'}`, `CNPJ: ${params.empresaCnpj || '–'}`],
    [`Colaborador: ${params.colaboradorNome || '–'}`, `Função: ${params.colaboradorFuncao || '–'}`],
    [`Período: ${params.periodoInicio || '–'} a ${params.periodoFim || '–'}`, `Carga Semanal Contratada: ${params.cargaSemanalContratada}`],
  ];

  idLines.forEach(pair => {
    doc.text(pair[0], mx, y);
    doc.text(pair[1], pw / 2, y);
    y += 5;
  });
  y += 4;

  // SCHEDULE TABLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('QUADRO DE JORNADA', mx, y);
  y += 2;

  const slotLabels4 = ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];
  const slotLabels6 = ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída'];
  const slotLabels2 = ['Entrada', 'Saída'];
  const labels = params.slots === 6 ? slotLabels6 : params.slots === 2 ? slotLabels2 : slotLabels4;

  const headers = ['Dia', ...labels, 'Trab.', 'Interv.'];
  if (params.noturnoHabilitado) {
    headers.push('Not.R', 'Not.C');
  }

  const rows = analise.dias.map((d, i) => {
    const marks = dias[i].marcacoes.map(m => m || '–');
    const row = [
      d.dia,
      ...marks,
      d.ativo ? minutesToHHMM(d.totalTrabalhadoMin) : '–',
      d.ativo ? minutesToHHMM(d.totalIntervaloMin) : '–',
    ];
    if (params.noturnoHabilitado) {
      row.push(d.noturnoRealMin > 0 ? minutesToHHMM(d.noturnoRealMin) : '–');
      row.push(d.noturnoConvertidoMin > 0 ? minutesToHHMM(d.noturnoConvertidoMin) : '–');
    }
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', font: 'helvetica' },
    headStyles: { fillColor: [98, 142, 63], textColor: 255, fontStyle: 'bold' },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // WEEKLY SUMMARY
  checkPage(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RESUMO SEMANAL', mx, y);
  y += 2;

  const saldoLabel = analise.saldoMin > 0 ? 'Acima' : analise.saldoMin < 0 ? 'Abaixo' : 'Igual';
  const summaryRows = [
    ['Total Semanal Apurado', minutesToHHMM(analise.totalSemanalMin)],
    ['Carga Semanal Contratada', minutesToHHMM(analise.cargaContratadaMin)],
    ['Diferença (Saldo)', minutesToHHMM(analise.saldoMin)],
    ['Indicação', saldoLabel],
  ];

  if (params.noturnoHabilitado) {
    const totalNotR = analise.dias.reduce((s, d) => s + d.noturnoRealMin, 0);
    const totalNotC = analise.dias.reduce((s, d) => s + d.noturnoConvertidoMin, 0);
    summaryRows.push(['Total Noturno Real', minutesToHHMM(totalNotR)]);
    summaryRows.push(['Total Noturno Convertido (×1,142857)', minutesToHHMM(totalNotC)]);
  }

  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, font: 'helvetica' },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'center' } },
    margin: { left: mx, right: mx },
    tableWidth: contentW * 0.6,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // PARAMETERS USED
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PARÂMETROS UTILIZADOS', mx, y);
  y += 2;

  const paramRows = [
    ['Carga semanal contratada', params.cargaSemanalContratada],
    ['Intervalo mínimo (4–6h)', params.intervaloMinimo4a6h],
    ['Intervalo mínimo (>6h)', params.intervaloMinimoAcima6h],
    ['Interjornada mínima', params.interjornadaMinima],
    ['Tolerância', `${params.toleranciaMinutos} min`],
    ['Noturno', params.noturnoHabilitado ? `${params.noturnoInicio} às ${params.noturnoFim} (fator 1,142857)` : 'Desabilitado'],
    ['Marcações/Dia', `${params.slots} colunas`],
  ];

  autoTable(doc, {
    startY: y,
    body: paramRows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'left' } },
    margin: { left: mx, right: mx },
    tableWidth: contentW * 0.65,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // PARECER
  checkPage(60);
  doc.setFillColor(240, 240, 240);
  doc.rect(mx, y, contentW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(98, 142, 63);
  doc.text('PARECER AUTOMÁTICO DE CONSISTÊNCIA DA JORNADA', mx + 3, y + 5.5);
  doc.setTextColor(0);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (analise.statusGeral === 'ok') {
    const txt = 'Após análise automática dos horários informados e dos parâmetros configurados, NÃO foram identificadas inconsistências legais/paramétricas na jornada apresentada.';
    const lines = doc.splitTextToSize(txt, contentW);
    doc.text(lines, mx, y);
    y += lines.length * 4.5;
  } else {
    const intro = 'Após análise automática dos horários informados e dos parâmetros configurados, foram identificadas as seguintes inconsistências/alertas:';
    const introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, mx, y);
    y += introLines.length * 4.5 + 3;

    analise.apontamentos.forEach(ap => {
      checkPage(8);
      doc.setFillColor(98, 142, 63);
      doc.rect(mx + 2, y - 2.5, 2.5, 2.5, 'F');
      const apLines = doc.splitTextToSize(ap, contentW - 10);
      doc.text(apLines, mx + 7, y);
      y += apLines.length * 4.5 + 1;
    });
  }

  y += 4;

  // OBSERVAÇÕES DO ANALISTA
  if (observacoesAnalista.trim()) {
    checkPage(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OBSERVAÇÕES DO ANALISTA', mx, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(observacoesAnalista, contentW);
    doc.text(obsLines, mx, y);
    y += obsLines.length * 4.5;
  }

  y += 12;
  checkPage(30);

  // SIGNATURES
  const sigW = 65;
  const sig1X = pw / 2 - sigW - 10;
  const sig2X = pw / 2 + 10;
  doc.setDrawColor(80);
  doc.line(sig1X, y, sig1X + sigW, y);
  doc.line(sig2X, y, sig2X + sigW, y);
  doc.setFontSize(8);
  doc.text('Responsável / Analista', sig1X + sigW / 2, y + 4, { align: 'center' });
  doc.text('Empresa / Representante', sig2X + sigW / 2, y + 4, { align: 'center' });

  addFooter();

  return doc;
}
