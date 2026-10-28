import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calcular, necessidadePorDia, timelineDia, minH, fmtH, REGIME_LABEL, type Parametros, type Setor } from './calculo';

const VERDE: [number, number, number] = [98, 142, 63];
const OLIVA: [number, number, number] = [57, 52, 33];
const n2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function linhas(setores: Setor[], p: Parametros) {
  const out: (string | number)[][] = [];
  for (const s of setores) for (const m of p.marcos) {
    const a = calcular(s, p, m, false), b = calcular(s, p, m, true);
    out.push([s.nome, m.nome, a.atual, n2(a.necessidade), a.arredondada, a.gap, n2(b.necessidade), b.arredondada, b.gap, Math.max(0, a.arredondada - b.arredondada)]);
  }
  return out;
}
const HEAD = ['Setor', 'Marco', 'Atual', 'Nec. sem comp. (FTE)', 'Arred.', 'Gap', 'Nec. com comp. (FTE)', 'Arred.', 'Gap', 'Contratações evitadas'];

export function exportarPdf(empresa: { nome?: string; cnpj?: string }, setores: Setor[], p: Parametros) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...VERDE); doc.rect(0, 0, W, 54, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.text('PEC 5x2 – Necessidade de Contratação', 30, 24);
  doc.setFontSize(9); doc.text(`Monte Verde Contabilidade · ${empresa.nome || ''}${empresa.cnpj ? ' · CNPJ ' + empresa.cnpj : ''}`, 30, 40);
  doc.setTextColor(...OLIVA); doc.setFontSize(9);
  doc.text(`Marcos: ${p.marcos.map((m) => `${m.nome} ${m.jornada}h/${m.dias}d${m.data ? ' desde ' + m.data.split('-').reverse().join('/') : ''}`).join(' · ')}`, 30, 72);
  doc.text(`Regime padrão: ${REGIME_LABEL[p.regime_compensacao_padrao]} · Reposição: ${p.indices_reposicao.ativo ? n2(p.indices_reposicao.ferias + p.indices_reposicao.absenteismo) + '%' : 'desativada'}`, 30, 86);
  autoTable(doc, { startY: 98, head: [HEAD], body: linhas(setores, p), headStyles: { fillColor: VERDE }, styles: { fontSize: 8 },
    didParseCell: (d) => { if (d.section === 'body' && (d.column.index === 5 || d.column.index === 8) && Number(d.cell.raw) > 0) d.cell.styles.textColor = [200, 30, 30]; } });
  for (const s of setores) for (const m of p.marcos) {
    const ls = necessidadePorDia(s, p, m, true); if (!ls.length) continue;
    autoTable(doc, { head: [[`${s.nome} – ${m.nome}: necessidade por dia`, 'Intensidade', 'Horas', 'Postos máx.', 'Pessoas nec.', 'Escaladas', 'Falta', 'Obs.', 'Como chegamos']],
      body: ls.map((l) => [l.rotulo, `${l.nivel} (×${l.mult})`, fmtH(l.horas), l.postosMax, l.pessoas, l.escalados, l.deficit || '—', l.obs || '', l.explicacao]),
      headStyles: { fillColor: VERDE }, styles: { fontSize: 7 }, columnStyles: { 8: { cellWidth: 300 } },
      didParseCell: (d) => { if (d.section === 'body' && d.column.index === 6 && Number(d.cell.raw) > 0) d.cell.styles.textColor = [200, 30, 30]; } });
    // Linha do tempo por dia
    const tls = ls.map((l) => ({ l, t: timelineDia(s, l) }));
    const ini = Math.floor(Math.min(...tls.map((x) => x.t.abre)) / 60) * 60, fim = Math.ceil(Math.max(...tls.map((x) => x.t.fecha)) / 60) * 60;
    if (fim > ini) {
      const H = doc.internal.pageSize.getHeight(); const x0 = 130, x1 = W - 30; const X = (v: number) => x0 + ((v - ini) / (fim - ini)) * (x1 - x0);
      let y = (doc as any).lastAutoTable.finalY + 18;
      const altura = tls.reduce((a, x) => a + Math.max(14, x.t.barras.length * 4 + 6), 30);
      if (y + altura > H - 30) { doc.addPage(); y = 40; }
      doc.setFontSize(9); doc.setTextColor(...OLIVA); doc.text(`${s.nome} – ${m.nome}: linha do tempo (cada barra = 1 colaborador)`, 30, y); y += 12;
      doc.setFontSize(6.5); for (let h = ini; h <= fim; h += 60) doc.text(minH(h), X(h), y, { align: 'center' }); y += 4;
      const cor: Record<string, [number, number, number]> = { baixo: [170, 170, 170], normal: VERDE, alto: [220, 160, 40], pico: [210, 90, 40] };
      for (const { l, t } of tls) {
        const hRow = Math.max(14, t.barras.length * 4 + 6);
        if (y + hRow > H - 30) { doc.addPage(); y = 40; }
        doc.setDrawColor(220, 220, 220); doc.line(30, y, x1, y);
        doc.setTextColor(...OLIVA); doc.setFontSize(7); doc.text(`${l.rotulo} · ${l.nivel}`, 30, y + 8); doc.text(`${l.pessoas} pessoas${l.deficit ? ` · faltam ${l.deficit}` : ''}`, 30, y + 15);
        doc.setFillColor(232, 240, 226); doc.rect(X(t.abre), y + 2, X(t.fecha) - X(t.abre), hRow - 4, 'F');
        t.barras.forEach((b, j) => {
          doc.setFillColor(...(j >= l.escalados ? [200, 30, 30] as [number, number, number] : cor[l.nivel]));
          doc.rect(X(b.ini), y + 4 + j * 4, X(b.fim) - X(b.ini), 3, 'F');
          if (b.pausa) { doc.setFillColor(255, 255, 255); doc.rect(X(b.pausa[0]), y + 4 + j * 4, X(b.pausa[1]) - X(b.pausa[0]), 3, 'F'); }
        });
        y += hRow;
      }
      (doc as any).lastAutoTable.finalY = y;
    }
  }
  const alertas = setores.flatMap((s) => p.marcos.flatMap((m) => [...calcular(s, p, m, false).alertas, ...calcular(s, p, m, true).alertas].map((a) => `${s.nome} – ${m.nome}: ${a}`)));
  if (alertas.length) autoTable(doc, { head: [['Alertas']], body: [...new Set(alertas)].map((a) => [a]), headStyles: { fillColor: OLIVA }, styles: { fontSize: 7.5 } });
  doc.setFontSize(7); doc.text('Estimativa para planejamento. Confirme com a CCT/ACT e acordos de compensação vigentes.', 30, doc.internal.pageSize.getHeight() - 16);
  doc.save(`pec-5x2-${(empresa.nome || 'empresa').replace(/\W+/g, '-')}.pdf`);
}

export function exportarXlsx(empresa: { nome?: string }, setores: Setor[], p: Parametros) {
  const ws = XLSX.utils.aoa_to_sheet([[`PEC 5x2 – ${empresa.nome || ''}`], [], HEAD, ...linhas(setores, p)]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Necessidade');
  XLSX.writeFile(wb, `pec-5x2-${(empresa.nome || 'empresa').replace(/\W+/g, '-')}.xlsx`);
}
