import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type DsrMonthlyResult } from '@/types/dsr';
import { type ContagemDiasMes } from './dsrCalculations';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function gerarPdfApuracaoDsr(r: DsrMonthlyResult, contagem: ContagemDiasMes) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Apuração de DSR', pageW / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Empresa: ${r.empresaNome || '—'}`, 14, 28);
  doc.text(`Competência: ${r.competencia}`, 14, 34);

  // Tabela: contagem de dias
  autoTable(doc, {
    startY: 40,
    head: [['Dias úteis', 'Dias DSR', 'Domingos', 'Feriados não úteis']],
    body: [[String(r.diasUteis), String(r.diasDsr), String(r.domingos), String(r.feriadosNaoUteis)]],
    theme: 'grid',
    headStyles: { fillColor: [98, 142, 63] },
    styles: { fontSize: 9, halign: 'center' },
  });

  // Tabela: feriados do mês
  if (contagem.feriadosListados.length > 0) {
    autoTable(doc, {
      head: [['Data', 'Feriado', 'Escopo', 'Conta DSR']],
      body: contagem.feriadosListados.map((f) => [
        f.data.split('-').reverse().join('/'),
        f.nome,
        f.escopo,
        f.contaDsr ? 'Sim' : 'Não',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [98, 142, 63] },
      styles: { fontSize: 8 },
      margin: { top: 4 },
    });
  }

  // Tabela: detalhamento por verba
  autoTable(doc, {
    head: [['Código', 'Verba', 'Base', 'DU', 'Dias DSR', 'DSR (R$)', 'Total']],
    body: r.detalheVerbas.map((v) => [
      v.codigo || '—',
      v.nome,
      fmtBRL(v.base),
      String(v.diasUteis),
      String(v.diasDsr),
      fmtBRL(v.dsr),
      fmtBRL(v.total),
    ]),
    foot: [[
      '',
      'TOTAL',
      fmtBRL(r.totalBase),
      '',
      '',
      fmtBRL(r.totalDsr),
      fmtBRL(r.totalBase + r.totalDsr),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [57, 52, 33] },
    footStyles: { fillColor: [225, 232, 242], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9 },
  });

  // Memória de cálculo
  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Memória de cálculo', 14, finalY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = finalY + 16;
  r.detalheVerbas.forEach((v) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`• ${v.nome}: ${v.formula}`, 14, y);
    y += 5;
  });

  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      'Cálculo estimativo. Pode variar conforme CCT e particularidades. Consulte um profissional.',
      pageW / 2,
      290,
      { align: 'center' },
    );
  }

  doc.save(`apuracao-dsr-${r.competencia}.pdf`);
}