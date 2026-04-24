import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type DsrMonthlyResult, type FeriadoExtendido, type FeriadoNacionalOverride } from '@/types/dsr';
import { type ContagemDiasMes, feriadosNacionaisDoAno } from './dsrCalculations';

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
    head: [['Código', 'Verba', 'Colaborador', 'Base', 'DU', 'Dias DSR', 'DSR (R$)', 'Total']],
    body: r.detalheVerbas.map((v) => [
      v.codigo || '—',
      v.nome,
      v.colaborador || '—',
      fmtBRL(v.base),
      String(v.diasUteis),
      String(v.diasDsr),
      fmtBRL(v.dsr),
      fmtBRL(v.total),
    ]),
    foot: [[
      '',
      'TOTAL',
      '',
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
    doc.text(`• ${v.nome}${v.colaborador ? ` (${v.colaborador})` : ''}: ${v.formula}`, 14, y);
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

/**
 * Gera PDF da apuração ANUAL com memória de cálculo de cada mês.
 */
export function gerarPdfApuracaoDsrAnual(
  ano: number,
  empresaNome: string,
  meses: { competencia: string; resultado: DsrMonthlyResult; erro?: string }[],
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Apuração Anual de DSR — ${ano}`, pageW / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Empresa: ${empresaNome || '—'}`, 14, 28);
  doc.text(`Período: 01/${ano} a 12/${ano}`, 14, 34);

  // Tabela resumo do ano
  const totalBase = meses.reduce((s, m) => s + m.resultado.totalBase, 0);
  const totalDsr = meses.reduce((s, m) => s + m.resultado.totalDsr, 0);

  autoTable(doc, {
    startY: 40,
    head: [['Competência', 'DU', 'Dias DSR', 'Total Base', 'Total DSR', 'Total Geral']],
    body: meses.map((m) => [
      m.competencia,
      String(m.resultado.diasUteis),
      String(m.resultado.diasDsr),
      fmtBRL(m.resultado.totalBase),
      fmtBRL(m.resultado.totalDsr),
      fmtBRL(m.resultado.totalBase + m.resultado.totalDsr),
    ]),
    foot: [[
      `TOTAL ${ano}`,
      '',
      '',
      fmtBRL(totalBase),
      fmtBRL(totalDsr),
      fmtBRL(totalBase + totalDsr),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [98, 142, 63] },
    footStyles: { fillColor: [225, 232, 242], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, halign: 'center' },
  });

  // Memória detalhada mês a mês
  meses.forEach((m) => {
    const r = m.resultado;
    const hasData = r.detalheVerbas.length > 0;
    if (!hasData) return;

    doc.addPage();
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Memória de cálculo — ${m.competencia}`, 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `DU: ${r.diasUteis}  |  Dias DSR: ${r.diasDsr}  |  Domingos: ${r.domingos}  |  Feriados: ${r.feriadosNaoUteis}`,
      14,
      26,
    );

    autoTable(doc, {
      startY: 32,
      head: [['Código', 'Verba', 'Colaborador', 'Base', 'DU', 'Dias DSR', 'DSR (R$)', 'Total']],
      body: r.detalheVerbas.map((v) => [
        v.codigo || '—',
        v.nome,
        v.colaborador || '—',
        fmtBRL(v.base),
        String(v.diasUteis),
        String(v.diasDsr),
        fmtBRL(v.dsr),
        fmtBRL(v.total),
      ]),
      foot: [[
        '',
        'TOTAL',
        '',
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

    const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Fórmulas:', 14, finalY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let y = finalY + 14;
    r.detalheVerbas.forEach((v) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const linha = `• ${v.nome}${v.colaborador ? ` (${v.colaborador})` : ''}: ${v.formula}`;
      const partes = doc.splitTextToSize(linha, pageW - 28);
      doc.text(partes, 14, y);
      y += partes.length * 4 + 1;
    });
  });

  // Rodapé em todas as páginas
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
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, 290, { align: 'right' });
  }

  doc.save(`apuracao-dsr-anual-${ano}.pdf`);
}

/**
 * Gera PDF com a tabela consolidada de feriados (nacionais + cadastrados).
 */
export function gerarPdfTabelaFeriados(
  ano: number,
  feriadosCadastrados: FeriadoExtendido[],
  overrides: FeriadoNacionalOverride[],
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Tabela de Feriados — ${ano}`, pageW / 2, 18, { align: 'center' });

  const overrideMap = new Map(
    overrides.filter((o) => o.ano === ano).map((o) => [o.chave, o.pontoFacultativo]),
  );

  const nacionais = feriadosNacionaisDoAno(ano).map((f) => {
    const fac = !!overrideMap.get(f.chave);
    return {
      data: f.data,
      nome: f.nome,
      local: '—',
      escopo: fac ? 'nacional (facultativo)' : 'nacional',
      naoUtil: !fac,
      dsr: !fac,
    };
  });

  const cadastradosNoAno = feriadosCadastrados
    .filter((f) => f.data.startsWith(`${ano}-`))
    .map((f) => ({
      data: f.data,
      nome: f.nome,
      local: [f.municipio, f.uf].filter(Boolean).join('/') || '—',
      escopo: f.escopo,
      naoUtil: f.contaDiaNaoUtil,
      dsr: f.contaDsr,
    }));

  const todos = [...nacionais, ...cadastradosNoAno].sort((a, b) => a.data.localeCompare(b.data));

  autoTable(doc, {
    startY: 28,
    head: [['Data', 'Feriado', 'Município/UF', 'Escopo', 'Não útil', 'DSR']],
    body: todos.map((f) => [
      f.data.split('-').reverse().join('/'),
      f.nome,
      f.local,
      f.escopo,
      f.naoUtil ? 'Sim' : 'Não',
      f.dsr ? 'Sim' : 'Não',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [98, 142, 63] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Total: ${todos.length} feriado(s) em ${ano}. Inclui nacionais (com override de ponto facultativo) e cadastrados.`,
      pageW / 2,
      290,
      { align: 'center' },
    );
  }

  doc.save(`feriados-${ano}.pdf`);
}