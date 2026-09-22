import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';

export type AlinhamentoData = {
  empresa: string;
  cnpj?: string;
  cliente_logo_url?: string | null;
  verba_label: string;
  politica_nome: string;
  competencia: string;
  objetivo?: string | null;
  valor_base: number;
  colaborador: { nome: string; cpf?: string | null; codigo_folha?: string | null; data_admissao?: string | null; cargo?: string | null; };
  criterios: Array<{ nome: string; descricao?: string | null; peso: number; essencial: boolean; percentual: number; observacao?: string | null; feedback?: string | null; status?: string }>;
  percentual_final: number;
  valor_final: number;
  parecer_geral?: string | null;
  elegibilidade: string;
};

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generatePremioAlinhamentoPdf(d: AlinhamentoData) {
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
  const titleLines: string[] = doc.splitTextToSize(`APURAÇÃO DE ${d.verba_label.toUpperCase()} — ${d.competencia}`, TITLE_MAX_W);
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
    const wrap: string[] = doc.splitTextToSize(l, W - 92);
    for (const w of wrap) { ensure(13); doc.text(w, 46, y + 9); y += 13; }
    doc.setTextColor(0,0,0);
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
  line(`Valor base da verba: ${BRL(d.valor_base)}`);
  if (d.objetivo) line(`Objetivo: ${d.objetivo}`);
  y += 10;

  // ---------- Critérios ----------
  bandTitle('Critérios Avaliados');
  const CP = W - 232, CW = W - 186, CS = W - 136;
  ensure(22);
  doc.setFillColor(235,239,231); doc.rect(40, y, W-80, 16, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(sr,sg,sb);
  doc.text('CRITÉRIO', 46, y+11);
  doc.text('%', CP, y+11);
  doc.text('PESO', CW, y+11);
  doc.text('STATUS', CS, y+11);
  y += 16;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);

  let alt = false;
  for (const c of d.criterios) {
    const nameW = W - 250;
    const nameLines: string[] = doc.splitTextToSize(`${c.nome}${c.essencial ? ' *' : ''}`, nameW);
    const obsLines: string[] = c.observacao ? doc.splitTextToSize(`obs: ${c.observacao}`, nameW) : [];
    const fbLines: string[] = c.feedback ? doc.splitTextToSize(`feedback: ${c.feedback}`, nameW) : [];
    const rowH = 13 * nameLines.length + 11 * (obsLines.length + fbLines.length) + 7;
    ensure(rowH + 4);
    if (alt) { doc.setFillColor(249,250,248); doc.rect(40, y, W-80, rowH, 'F'); }
    alt = !alt;
    let yy = y + 11;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(0,0,0);
    for (const ln of nameLines) { doc.text(ln, 46, yy); yy += 13; }
    doc.setTextColor(110,112,108); doc.setFontSize(8);
    for (const ln of [...obsLines, ...fbLines]) { doc.text(ln, 46, yy); yy += 11; }
    doc.setTextColor(0,0,0); doc.setFontSize(9);
    doc.text(`${Number(c.percentual||0).toFixed(0)}%`, CP, y+11);
    doc.text(String(c.peso), CW, y+11);
    doc.text(String(c.status || '—').slice(0, 14), CS, y+11);
    y += rowH;
    doc.setDrawColor(232,235,229); doc.line(40, y, W-40, y);
  }
  y += 6;
  doc.setFontSize(8); doc.setTextColor(120,120,120);
  ensure(14); doc.text('* critério essencial — quando zerado, impede o pagamento da verba.', 46, y + 8); y += 18;
  doc.setTextColor(0,0,0);

  // ---------- Resultado ----------
  ensure(46);
  doc.setFillColor(pr,pg,pb);
  doc.roundedRect(40, y, W-80, 30, 3, 3, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(`PERCENTUAL APURADO: ${d.percentual_final.toFixed(0)}%`, 50, y+19);
  doc.text(`${d.verba_label.toUpperCase()}: ${BRL(d.valor_final)}`, W-50, y+19, { align: 'right' } as any);
  y += 40;
  doc.setTextColor(0,0,0);
  line(`Elegibilidade: ${d.elegibilidade}`);

  if (d.parecer_geral) {
    y += 8;
    bandTitle('Parecer / Feedback Geral');
    line(d.parecer_geral);
  }

  // ---------- Assinaturas ----------
  if (y > H - 140) { doc.addPage(); y = 80; } else { y = Math.max(y + 24, H - 140); }
  doc.setDrawColor(150,150,150);
  doc.line(60, y, 260, y);
  doc.line(W-260, y, W-60, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text('Assinatura do Colaborador', 60, y+13);
  doc.text(d.colaborador.nome, 60, y+26);
  doc.text('Assinatura do Responsável (Empregador)', W-260, y+13);

  // ---------- Rodapé ----------
  const pages = (doc as any).getNumberOfPages?.() || 1;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(pr,pg,pb);
    doc.rect(0, H - 30, W, 30, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text(`${branding?.office_name || 'Monte Verde Contabilidade'}${branding?.phone ? ` • ${branding.phone.trim()}` : ''}${branding?.site ? ` • ${branding.site}` : ''}`, 40, H - 12);
    doc.text(`Página ${p} de ${pages}`, W - 40, H - 12, { align: 'right' } as any);
  }
  doc.setTextColor(0,0,0);

  const fileName = `apuracao-${d.verba_label}-${d.colaborador.nome.replace(/\s+/g,'_')}-${d.competencia.replace(/\//g,'-')}.pdf`;
  doc.save(fileName);
  return fileName;
}
