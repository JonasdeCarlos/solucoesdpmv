import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Apuracao, Catalogo, Colaborador, Politica, RegVersao } from '../hooks/usePremiacao';
import { brl, fmtComp, shiftComp } from '../hooks/usePremiacao';
import { FORMULA_RODAPE, quadrosAnexos, termoCiencia, tituloRegulamento, valorPontoExtenso as valorExtenso } from './textos';

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
  autoTable(doc, { startY: y, head: [['Colaborador', 'Função', 'Referência', 'Saldo inicial', 'Pontos apurados', 'Desabonos', 'Saldo do mês', 'Pontos premiados', 'Metas atingidas', 'Saldo transportado', 'Prêmio']],
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
  doc.text(doc.splitTextToSize(`Pontuação de referência da sua função (${funcao}): ${a.pontuacao_referencia} pontos. Ao ultrapassar esse valor, você recebe o prêmio sobre todos os pontos do mês.`, w - 34), 17, y + 5.5);
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
    rows.push(['Pontuação de referência (gatilho)', String(a.pontuacao_referencia)], ['Pontos premiados', String(a.pontos_premiaveis)], ['Prêmio', brl(a.valor_bonificacao)]);
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

export function pdfRecibo(opts: { politica: Politica; cat: Catalogo; apuracao: Apuracao; colaborador: Colaborador; empresa: string; cidade?: string }) {
  const { apuracao: a, colaborador: c, empresa, politica, cat } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = header(doc, `${politica.nome} — Recibo de prêmio por desempenho — ${fmtComp(a.competencia)}`, empresa);
  y = secao(doc, y + 2, 'Recibo');
  const valor = Number(a.valor_bonificacao);
  const texto = `Eu, ${c.nome}${c.cpf ? `, inscrito(a) no CPF nº ${c.cpf}` : ''}, exercendo a função de ${cat.funcaoDe(c)}, declaro haver recebido de ${empresa} a importância de ${valorExtenso(valor)}, a título de prêmio por desempenho superior ao ordinariamente esperado, referente à competência ${fmtComp(a.competencia)}, apurada no Programa Excelência.

O valor decorre de ${a.pontos_premiaveis} ponto(s) premiado(s) × ${valorExtenso(Number(a.valor_ponto))} por ponto, tendo o saldo do mês (${a.saldo_apurado} pontos) ultrapassado a pontuação de referência da função (${a.pontuacao_referencia} pontos).

Declaro ainda estar ciente de que o prêmio é concedido por liberalidade da empresa, nos termos do art. 457, §§ 2º e 4º, da CLT, não integra a remuneração para nenhum efeito e não gera direito adquirido para competências futuras. Dou plena e geral quitação quanto ao valor acima.`;
  doc.setFontSize(10); doc.setTextColor(30);
  for (const par of texto.split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(par.trim(), w - 28);
    if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 18; }
    doc.text(lines, 14, y, { align: 'justify', maxWidth: w - 28 });
    y += lines.length * 5 + 3;
  }
  y = secao(doc, y + 2, 'Resumo da apuração');
  autoTable(doc, {
    startY: y,
    body: [
      ['Saldo inicial', String(a.saldo_inicial)],
      ['(+) Medalhas', String(a.pontos_medalhas)],
      ['(+) Troféus', String(a.pontos_trofeus)],
      ['(−) Desabonos', String(a.pontos_desabonos)],
      ['(=) Saldo do mês', String(a.saldo_apurado)],
      ['Pontuação de referência (gatilho)', String(a.pontuacao_referencia)],
      ['Pontos premiados', String(a.pontos_premiaveis)],
      ['Valor do ponto', brl(Number(a.valor_ponto))],
      ['Valor do prêmio', brl(valor)],
    ],
    theme: 'plain', columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (d) => { if (d.row.index === 8) { d.cell.styles.fillColor = VERDE; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; } },
    styles: { fontSize: 9.5, cellPadding: 2 }, alternateRowStyles: { fillColor: CINZA }, margin: { left: 14, right: 14 },
  });
  y = lastY(doc) + 16;
  if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 25; }
  const hoje = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(9.5); doc.setTextColor(30);
  doc.text(`${opts.cidade ? `${opts.cidade}, ` : ''}${hoje}.`, 14, y);
  y += 22;
  doc.setDrawColor(120); doc.line(35, y, w - 35, y);
  doc.setFontSize(9); doc.setTextColor(60);
  doc.text(c.nome, w / 2, y + 5, { align: 'center' });
  if (c.cpf) doc.text(`CPF ${c.cpf}`, w / 2, y + 10, { align: 'center' });
  rodape(doc, FORMULA_RODAPE);
  return doc;
}

export function pdfFeedback(opts: { politica: Politica; cat: Catalogo; apuracao: Apuracao; colaborador: Colaborador; empresa: string; texto: string }) {
  const { apuracao: a, colaborador: c, empresa, politica, cat, texto } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = header(doc, `${politica.nome} — Feedback de desempenho — ${fmtComp(a.competencia)}`, empresa);
  doc.setFillColor(...CINZA); doc.roundedRect(14, y, w - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...MARROM);
  doc.text(doc.splitTextToSize(`${c.nome} — ${cat.funcaoDe(c)} | Saldo do mês: ${a.saldo_apurado} pts | Referência: ${a.pontuacao_referencia} pts | Prêmio: ${brl(Number(a.valor_bonificacao))}`, w - 34), 17, y + 5.5);
  y += 20;
  y = secao(doc, y, 'Feedback');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
  for (const par of String(texto || '').split(/\n\s*\n/)) {
    if (!par.trim()) continue;
    const lines = doc.splitTextToSize(par.trim(), w - 28);
    if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 18; }
    doc.text(lines, 14, y, { align: 'justify', maxWidth: w - 28 });
    y += lines.length * 5 + 3;
  }
  y += 14;
  if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 25; }
  doc.setDrawColor(120);
  doc.line(20, y, w / 2 - 8, y); doc.line(w / 2 + 8, y, w - 20, y);
  doc.setFontSize(8.5); doc.setTextColor(60);
  doc.text('Gestor(a)', (20 + w / 2 - 8) / 2, y + 5, { align: 'center' });
  doc.text(c.nome, (w / 2 + 8 + w - 20) / 2, y + 5, { align: 'center' });
  rodape(doc, FORMULA_RODAPE);
  return doc;
}
