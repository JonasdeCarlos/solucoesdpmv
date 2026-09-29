import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Apuracao, Catalogo, Colaborador, Politica, RegVersao } from '../hooks/usePremiacao';
import { brl, fmtComp, shiftComp } from '../hooks/usePremiacao';
import { FORMULA_RODAPE, quadrosAnexos, termoCiencia, tituloRegulamento } from './textos';

const VERDE: [number, number, number] = [98, 142, 63];
const MARROM: [number, number, number] = [57, 52, 33];
const CINZA: [number, number, number] = [225, 232, 242];

function hex(h: string): [number, number, number] {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16) || 0, parseInt(m.slice(2, 4), 16) || 0, parseInt(m.slice(4, 6), 16) || 0];
}

function header(doc: jsPDF, titulo: string, empresa: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...VERDE); doc.rect(0, 0, w, 3, 'F');
  doc.setTextColor(...MARROM); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const t = doc.splitTextToSize(titulo, w - 28);
  doc.text(t, 14, 13);
  let y = 13 + t.length * 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  const e = doc.splitTextToSize(empresa, w - 28);
  doc.text(e, 14, y); y += e.length * 4.5 + 2;
  return y;
}

function secao(doc: jsPDF, y: number, texto: string) {
  const w = doc.internal.pageSize.getWidth();
  if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16; }
  doc.setFillColor(...VERDE); doc.roundedRect(14, y, w - 28, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text(texto, 17, y + 4.8);
  doc.setTextColor(0);
  return y + 10;
}

function rodape(doc: jsPDF, extra?: string) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth(); const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...VERDE); doc.line(14, h - 14, w - 14, h - 14);
    doc.setFontSize(7.5); doc.setTextColor(110); doc.setFont('helvetica', 'normal');
    if (extra) doc.text(doc.splitTextToSize(extra, w - 50), 14, h - 10);
    doc.text(`Página ${i} de ${n}`, w - 14, h - 10, { align: 'right' });
  }
}

const lastY = (doc: jsPDF) => (doc as any).lastAutoTable.finalY as number;

export function pdfRegulamento(opts: { politica: Politica; cat: Catalogo; versao: RegVersao; empresa: string; colaborador?: Colaborador }) {
  const { politica, cat, versao, empresa } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = header(doc, tituloRegulamento(versao.versao, versao.vigencia_inicio), empresa);
  doc.setFontSize(9.5); doc.setTextColor(30);
  for (const par of versao.texto.split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(par.trim(), w - 28);
    if (y + lines.length * 4.6 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 16; }
    doc.text(lines, 14, y, { align: 'justify', maxWidth: w - 28 });
    y += lines.length * 4.6 + 2.5;
  }
  const q = quadrosAnexos(cat, politica);
  y = secao(doc, y + 2, 'Pontuações de referência por função');
  autoTable(doc, { startY: y, head: [['Função', 'Pontos de referência']], body: q.referencias.length ? q.referencias.map(r => [r.funcao, String(r.pontos)]) : [['Padrão (todas as funções)', String(politica.pontuacao_referencia_padrao)]],
    headStyles: { fillColor: MARROM }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 8.5 }, margin: { left: 14, right: 14 } });
  y = secao(doc, lastY(doc) + 5, 'Medalhas por serviço');
  autoTable(doc, { startY: y, head: [['Medalha', 'Código', 'Serviço', 'Pontos', 'Limite/mês']],
    body: q.medalhas.flatMap(g => g.servicos.map(s => [g.medalha.nome, s.codigo, s.descricao, String(s.pts), s.limite_por_competencia ? String(s.limite_por_competencia) : '—'])),
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 0) { const g = q.medalhas.find(x => x.medalha.nome === d.cell.raw); if (g) { d.cell.styles.textColor = hex(g.medalha.cor_hex); d.cell.styles.fontStyle = 'bold'; } } },
    headStyles: { fillColor: MARROM }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 8.5 }, margin: { left: 14, right: 14 } });
  y = secao(doc, lastY(doc) + 5, 'Programa de Metas (troféus)');
  autoTable(doc, { startY: y, head: [['Meta', 'Quantidade no mês', 'Códigos que contam', 'Troféu (pontos)']],
    body: q.metas.map(m => [m.nome, `${m.quantidade_alvo} ${m.unidade || ''}`.trim(), m.modo_apuracao === 'manual' ? 'Apuração manual' : (m.codigos.join(', ') || 'A definir'), String(m.pontos_trofeu)]),
    headStyles: { fillColor: MARROM }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 8.5 }, margin: { left: 14, right: 14 } });
  y = secao(doc, lastY(doc) + 5, 'Desabonos');
  autoTable(doc, { startY: y, head: [['Código', 'Ocorrência', 'Pontos']], body: q.desabonos.map(d => [d.codigo, d.descricao, `−${d.pontos}`]),
    columnStyles: { 2: { textColor: [190, 30, 30], fontStyle: 'bold' } },
    headStyles: { fillColor: MARROM }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 8.5 }, margin: { left: 14, right: 14 } });
  y = lastY(doc) + 8;
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
  doc.setDrawColor(...VERDE); doc.roundedRect(14, y, w - 28, 24, 2, 2);
  doc.setFontSize(9); doc.setTextColor(30);
  const c = opts.colaborador;
  doc.text(doc.splitTextToSize(termoCiencia(versao.versao, c?.nome, c ? cat.funcaoDe(c) : undefined), w - 34), 17, y + 7);
  rodape(doc);
  return doc;
}

export function pdfApuracao(opts: { politica: Politica; cat: Catalogo; apuracoes: Apuracao[]; competencia: string; empresa: string }) {
  const { cat, apuracoes, competencia, empresa, politica } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let y = header(doc, `${politica.nome} — Apuração mensal ${fmtComp(competencia)}`, empresa);
  y = secao(doc, y, 'Comprovação objetiva do desempenho superior');
  const nome = (id: string) => cat.colaboradores.find(c => c.id === id);
  const body = apuracoes.map(a => {
    const c = nome(a.colaborador_id);
    const metas = a.trofeus_conquistados.filter(t => t.atingida).map(t => t.nome).join(', ') || '—';
    return [c?.nome || '—', cat.funcaoDe(c), String(a.pontuacao_referencia), String(a.saldo_inicial), String(a.pontos_medalhas + a.pontos_trofeus), String(a.pontos_desabonos), String(a.saldo_apurado), String(a.pontos_premiaveis), metas, String(a.saldo_transportado), brl(a.valor_bonificacao)];
  });
  const total = apuracoes.reduce((s, a) => s + Number(a.valor_bonificacao), 0);
  autoTable(doc, { startY: y, head: [['Colaborador', 'Função', 'Referência', 'Saldo inicial', 'Pontos apurados', 'Desabonos', 'Saldo do mês', 'Pontos excedentes', 'Metas atingidas', 'Saldo transportado', 'Prêmio']],
    body, foot: [['Total', '', '', '', '', '', '', '', '', '', brl(total)]],
    headStyles: { fillColor: MARROM, fontSize: 7.5 }, footStyles: { fillColor: VERDE }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 7.5 }, margin: { left: 14, right: 14 } });
  rodape(doc, FORMULA_RODAPE);
  return doc;
}

export function pdfExtrato(opts: { politica: Politica; cat: Catalogo; apuracao: Apuracao; colaborador: Colaborador; empresa: string }) {
  const { cat, apuracao: a, colaborador: c, empresa, politica } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = header(doc, `${politica.nome} — Extrato de ${c.nome} — ${fmtComp(a.competencia)}`, empresa);
  const funcao = cat.funcaoDe(c);
  doc.setFillColor(...CINZA); doc.roundedRect(14, y, w - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...MARROM);
  doc.text(doc.splitTextToSize(`Pontuação de referência da sua função (${funcao}): ${a.pontuacao_referencia} pontos. Seu prêmio corresponde aos pontos acima desse valor.`, w - 34), 17, y + 5.5);
  y += 19;
  // cards
  const cards: Array<{ t: string; v: string; cor: [number, number, number] }> = [
    ...cat.medalhas.filter(m => m.ativo).map(m => ({ t: m.nome, v: String(a.medalhas_contagem?.[m.nome] || 0), cor: hex(m.cor_hex) })),
    { t: 'Troféus', v: String(a.trofeus_conquistados.filter(t => t.atingida).length), cor: VERDE },
    { t: 'Desabonos', v: `−${a.pontos_desabonos}`, cor: [190, 30, 30] },
  ];
  const cw = (w - 28 - (cards.length - 1) * 3) / cards.length;
  cards.forEach((k, i) => {
    const x = 14 + i * (cw + 3);
    doc.setFillColor(...k.cor); doc.roundedRect(x, y, cw, 20, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(k.t, x + cw / 2, y + 6, { align: 'center' });
    doc.setFontSize(15); doc.text(k.v, x + cw / 2, y + 15, { align: 'center' });
  });
  y += 26;
  y = secao(doc, y, 'Quadro de cálculo');
  const rows: any[] = [
    [`Saldo inicial (transportado de ${fmtComp(shiftComp(a.competencia, -1))})`, String(a.saldo_inicial)],
    ['(+) Medalhas', String(a.pontos_medalhas)],
    ['(+) Troféus', String(a.pontos_trofeus)],
    ['(−) Desabonos', String(a.pontos_desabonos)],
    ['(=) Saldo do mês', String(a.saldo_apurado)],
  ];
  const negativo = a.saldo_apurado < 0;
  if (!negativo) {
    rows.push(['(−) Pontuação de referência', String(a.pontuacao_referencia)], ['(=) Pontos premiados', String(a.pontos_premiaveis)], ['Prêmio', brl(a.valor_bonificacao)]);
  } else {
    rows.push([{ content: `Saldo negativo de ${a.saldo_apurado} pontos transportado para ${fmtComp(shiftComp(a.competencia, 1))}. Não há desconto em folha.`, colSpan: 2, styles: { textColor: [190, 30, 30], fontStyle: 'bold' } }]);
  }
  autoTable(doc, { startY: y, body: rows, theme: 'plain', columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (d) => { if (!negativo && d.row.index === rows.length - 1) { d.cell.styles.fillColor = VERDE; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; } },
    styles: { fontSize: 10, cellPadding: 2 }, alternateRowStyles: { fillColor: CINZA }, margin: { left: 14, right: 14 } });
  y = lastY(doc) + 6;
  if (a.trofeus_conquistados.length) {
    y = secao(doc, y, 'Metas do mês');
    autoTable(doc, { startY: y, head: [['Meta', 'Realizado / alvo', 'Situação', 'Pontos']],
      body: a.trofeus_conquistados.map(t => [t.nome, t.realizado === null ? 'Manual' : `${t.realizado} / ${t.alvo} ${t.unidade || ''}`, t.atingida ? 'Atingida' : 'Não atingida', String(t.pontos)]),
      headStyles: { fillColor: MARROM }, alternateRowStyles: { fillColor: CINZA }, styles: { fontSize: 8.5 }, margin: { left: 14, right: 14 } });
  }
  rodape(doc, FORMULA_RODAPE);
  return doc;
}
