import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calcular, necessidadePorDia, fmtH, REGIME_LABEL, type Parametros, type Setor } from './calculo';

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
  for (const s of setores) for (const m of p.marcos.slice(1)) {
    const ls = necessidadePorDia(s, p, m, true); if (!ls.length) continue;
    autoTable(doc, { head: [[`${s.nome} – ${m.nome}: necessidade por dia`, 'Intensidade', 'Horas', 'Postos máx.', 'Pessoas nec.', 'Escaladas', 'Falta', 'Obs.', 'Como chegamos']],
      body: ls.map((l) => [l.rotulo, `${l.nivel} (×${l.mult})`, fmtH(l.horas), l.postosMax, l.pessoas, l.escalados, l.deficit || '—', l.obs || '', l.explicacao]),
      headStyles: { fillColor: VERDE }, styles: { fontSize: 7 }, columnStyles: { 8: { cellWidth: 300 } },
      didParseCell: (d) => { if (d.section === 'body' && d.column.index === 6 && Number(d.cell.raw) > 0) d.cell.styles.textColor = [200, 30, 30]; } });
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
