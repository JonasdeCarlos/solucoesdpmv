import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';

export type RelatorioFinalData = {
  empresa: string;
  cnpj?: string;
  cliente_logo_url?: string | null;
  verba_label: string;
  politica_nome: string;
  competencia: string; // MM/YYYY
  colaborador: { nome: string; cpf?: string | null; codigo_folha?: string | null; data_admissao?: string | null; cargo?: string | null; };
  individual: {
    valor_base_teto: number;
    percentual_final: number;
    valor_final: number;
    elegibilidade: string;
    parecer_geral?: string | null;
    criterios: Array<{ nome: string; peso: number; essencial: boolean; percentual: number; observacao?: string | null; feedback?: string | null; }>;
  };
  coletivo: {
    faturamento_total: number;
    dia_referencia: number;
    dias_periodo: number;
    valor_referencia_dia: number;
    meta_0: number; meta_1: number; meta_2: number;
    split_coletivo: number;
    linhas: Array<{ nome: string; peso_pct: number; bc: number; nivel: string; pct: number; referencia: string; valor: number; }>;
    total_coletivo: number;
    pontos_colab: number;
    soma_pontos: number;
    share_colab: number;
  } | null;
  total_geral: number;
};

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generatePremioRelatorioFinalPdf(d: RelatorioFinalData) {
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#393421';
  const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
  const [pr,pg,pb] = hex(primary);
  const [sr,sg,sb] = hex(secondary);
  (doc as any).setCharSpace?.(0);

  // ---------- Cabeçalho (mesma estética da política) ----------
  const HEADER_H = 126;
  doc.setFillColor(247,249,245); doc.rect(0,0,W,HEADER_H,'F');
  doc.setDrawColor(pr,pg,pb); doc.setLineWidth(0.8); doc.line(36, HEADER_H - 1, W - 36, HEADER_H - 1);

  const LOGO_BOX_H = 62;
  const LOGO_BOX_MAX_W = 105;
  const LOGO_BOX_Y = (HEADER_H - LOGO_BOX_H) / 2;
  const off = await drawBrandLogo(doc, branding?.logo_url || '/images/logo-monte-verde-pdf.png', 30, LOGO_BOX_Y, LOGO_BOX_MAX_W, LOGO_BOX_H, { centerY: true });
  const CLI_BOX_W = 95;
  const cli = d.cliente_logo_url
    ? await drawBrandLogo(doc, d.cliente_logo_url, W - 30 - CLI_BOX_W, LOGO_BOX_Y, CLI_BOX_W, LOGO_BOX_H, { align: 'center', centerY: true, fallback: false })
    : { w: 0, h: 0 };

  const TX = 30 + (off.w > 0 ? off.w + 26 : 0);
  const TITLE_MAX_W = W - TX - 24 - (cli.w > 0 ? CLI_BOX_W + 16 : 0);
  doc.setTextColor(sr,sg,sb);
  doc.setFont('helvetica','bold'); doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(`RELATÓRIO FINAL DE ${d.verba_label.toUpperCase()} — ${d.competencia}`, TITLE_MAX_W);
  let ty = LOGO_BOX_Y + 22;
  for (const l of titleLines) { doc.text(l, TX, ty); ty += 17; }
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(70,74,68);
  ty += 4;
  const empresaLines: string[] = doc.splitTextToSize(`${d.empresa}${d.cnpj ? ` — CNPJ ${d.cnpj}` : ''}`, TITLE_MAX_W);
  for (const l of empresaLines) { doc.text(l, TX, ty); ty += 13; }
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, TX, ty + 3); ty += 16;
  if (branding?.office_name) doc.text(branding.office_name, TX, ty + 3, { maxWidth: TITLE_MAX_W });

  let y = HEADER_H + 22;
  doc.setTextColor(0,0,0);

  const ensure = (need: number) => { if (y + need > H - 60) { doc.addPage(); y = 60; } };

  const bandTitle = (text: string) => {
    ensure(34);
    doc.setFillColor(pr,pg,pb);
    doc.roundedRect(40, y, W-80, 22, 3, 3, 'F');
    doc.setTextColor(255,255,255);
    (doc as any).setCharSpace?.(0.4);
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(text, 50, y+15);
    (doc as any).setCharSpace?.(0);
    doc.setTextColor(0,0,0);
    y += 34;
  };

  const line = (l: string, opts?: { bold?: boolean; size?: number; color?: [number,number,number] }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size || 9);
    if (opts?.color) doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
    const wrap = doc.splitTextToSize(l, W - 92);
    for (const w of wrap) { ensure(13); doc.text(w, 46, y + 9); y += 13; }
    doc.setTextColor(0,0,0);
  };

  const tableHead = (cols: Array<{ t: string; x: number; align?: 'right' }>) => {
    ensure(22);
    doc.setFillColor(235,239,231);
    doc.rect(40, y, W-80, 16, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(sr,sg,sb);
    for (const c of cols) doc.text(c.t, c.x, y+11, c.align ? { align: c.align } as any : undefined);
    doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    y += 16;
  };

  // ---------- Identificação ----------
  bandTitle('Identificação do Colaborador');
  line(`${d.colaborador.nome}${d.colaborador.cargo ? ` — ${d.colaborador.cargo}` : ''}`, { bold: true, size: 10 });
  const linhaId = [
    d.colaborador.cpf ? `CPF: ${d.colaborador.cpf}` : '',
    d.colaborador.codigo_folha ? `Cód. folha: ${d.colaborador.codigo_folha}` : '',
    d.colaborador.data_admissao ? `Admissão: ${new Date(d.colaborador.data_admissao).toLocaleDateString('pt-BR')}` : '',
  ].filter(Boolean).join('    ');
  if (linhaId) line(linhaId);
  line(`Política: ${d.politica_nome}   •   Competência: ${d.competencia}`);
  y += 10;

  // ---------- Demonstrativo coletivo ----------
  if (d.coletivo) {
    bandTitle('Demonstrativo Coletivo — Metas da Competência');
    line(`Faturamento total do período: ${BRL(d.coletivo.faturamento_total)}   •   Dia de referência: ${d.coletivo.dia_referencia} de ${d.coletivo.dias_periodo}`);
    line(`Referência diária (faturamento ÷ dia): ${BRL(d.coletivo.valor_referencia_dia)}`);
    line(`Metas: Meta 0 ${BRL(d.coletivo.meta_0)}/dia   •   Meta 1 ${BRL(d.coletivo.meta_1)}/dia   •   Meta 2 ${BRL(d.coletivo.meta_2)}/dia`);
    y += 8;

    const C1 = 46, C2 = W-330, C3 = W-288, C4 = W-215, C5 = W-150, C6 = W-46;
    tableHead([
      { t: 'CRITÉRIO', x: C1 }, { t: 'PESO', x: C2 }, { t: 'BASE', x: C3 },
      { t: 'NÍVEL', x: C4 }, { t: 'REFERÊNCIA', x: C5 }, { t: 'VALOR', x: C6, align: 'right' },
    ]);
    let alt = false;
    for (const l of d.coletivo.linhas) {
      ensure(16);
      if (alt) { doc.setFillColor(248,249,246); doc.rect(40, y, W-80, 15, 'F'); }
      alt = !alt;
      doc.setDrawColor(232,235,229); doc.line(40, y+15, W-40, y+15);
      doc.setFontSize(8.5);
      doc.text(String(l.nome).slice(0, 30), C1, y+10);
      doc.text(`${l.peso_pct}%`, C2, y+10);
      doc.text(BRL(l.bc), C3, y+10);
      doc.text(`${String(l.nivel).replace('_',' ')} ${l.pct}%`, C4, y+10);
      doc.text(String(l.referencia).slice(0, 16), C5, y+10);
      doc.text(BRL(l.valor), C6, y+10, { align: 'right' } as any);
      y += 15;
    }
    doc.setFontSize(9);
    y += 6;
    line(`Total coletivo apurado (${d.coletivo.split_coletivo}% do faturamento): ${BRL(d.coletivo.total_coletivo)}`, { bold: true });
    line(`Pontos do colaborador: ${d.coletivo.pontos_colab} de ${d.coletivo.soma_pontos}   •   Participação: ${d.coletivo.soma_pontos > 0 ? ((d.coletivo.pontos_colab / d.coletivo.soma_pontos) * 100).toFixed(1) : '0,0'}%`);
    line(`Parcela coletiva do colaborador: ${BRL(d.coletivo.share_colab)}`, { bold: true, color: [pr,pg,pb] });
    y += 12;
  }

  // ---------- Avaliação individual ----------
  bandTitle('Avaliação Individual');
  line(`Teto individual: ${BRL(d.individual.valor_base_teto)}   •   Percentual apurado: ${d.individual.percentual_final.toFixed(0)}%   •   Elegibilidade: ${d.individual.elegibilidade}`);
  y += 6;

  const K1 = 46, K2 = W-220, K3 = W-150;
  tableHead([{ t: 'CRITÉRIO', x: K1 }, { t: 'PESO', x: K2 }, { t: 'ATINGIMENTO', x: K3 }]);
  let alt2 = false;
  for (const c of d.individual.criterios) {
    ensure(16);
    if (alt2) { doc.setFillColor(248,249,246); doc.rect(40, y, W-80, 15, 'F'); }
    alt2 = !alt2;
    doc.setDrawColor(232,235,229); doc.line(40, y+15, W-40, y+15);
    doc.setFontSize(8.5);
    doc.text(`${c.nome}${c.essencial ? ' *' : ''}`.slice(0, 62), K1, y+10);
    doc.text(String(c.peso), K2, y+10);
    doc.text(`${Number(c.percentual||0).toFixed(0)}%`, K3, y+10);
    y += 15;
    doc.setFontSize(9);
    if (c.observacao) line(`Observação: ${c.observacao}`, { size: 8, color: [95,95,95] });
    if (c.feedback) line(`Feedback: ${c.feedback}`, { size: 8, color: [95,95,95] });
  }
  y += 8;
  line('* Critérios essenciais zerados impedem o pagamento da verba.', { size: 8, color: [120,120,120] });
  line(`Parcela individual apurada: ${BRL(d.individual.valor_final)}`, { bold: true, color: [pr,pg,pb] });
  y += 10;

  if (d.individual.parecer_geral) {
    bandTitle('Parecer / Feedback Geral');
    line(d.individual.parecer_geral);
    y += 10;
  }

  // ---------- Total ----------
  ensure(48);
  doc.setFillColor(pr,pg,pb); doc.roundedRect(40, y, W-80, 30, 3, 3, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(`TOTAL FINAL A RECEBER: ${BRL(d.total_geral)}`, 50, y+19);
  doc.setFontSize(8.5); doc.setFont('helvetica','normal');
  const detalhe = d.coletivo
    ? `coletivo ${BRL(d.coletivo.share_colab)} + individual ${BRL(d.individual.valor_final)}`
    : `individual ${BRL(d.individual.valor_final)}`;
  doc.text(detalhe, W-50, y+19, { align: 'right' } as any);
  y += 40; doc.setTextColor(0,0,0);

  // ---------- Assinaturas ----------
  ensure(90);
  y = Math.max(y + 24, H - 130);
  doc.setDrawColor(150,150,150);
  doc.line(60, y, 260, y);
  doc.line(W-260, y, W-60, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,80);
  doc.text('Assinatura do Colaborador', 60, y+12);
  doc.text(d.colaborador.nome, 60, y+24);
  doc.text('Assinatura do Responsável (Empregador)', W-260, y+12);
  doc.text(d.empresa, W-260, y+24);
  doc.setTextColor(0,0,0);

  // ---------- Cabeçalho de continuação + rodapé ----------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setDrawColor(pr,pg,pb); doc.setLineWidth(0.7); doc.line(36, 46, W - 36, 46);
      await drawBrandLogo(doc, branding?.logo_url || '/images/logo-monte-verde-pdf.png', 36, 12, 64, 28, { centerY: true });
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(sr,sg,sb);
      doc.text(`RELATÓRIO FINAL DE ${d.verba_label.toUpperCase()}`, W - 36, 30, { align: 'right' });
    }
    doc.setFillColor(sr,sg,sb); doc.rect(0, H - 27, W, 27, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
    const contact = [branding?.office_name, branding?.phone, branding?.email].filter(Boolean).join('  •  ');
    doc.text(contact || 'Relatório de avaliação', W / 2, H - 10, { align: 'center' });
    doc.text(`${i}/${totalPages}`, W - 36, H - 10, { align: 'right' });
  }

  const fileName = `relatorio-final-${d.verba_label}-${d.colaborador.nome.replace(/\s+/g,'_')}-${d.competencia.replace(/\//g,'-')}.pdf`;
  doc.save(fileName);
  return fileName;
}
