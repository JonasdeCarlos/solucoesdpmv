import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';

export type PoliticaPdfData = {
  empresa: string;
  cnpj?: string;
  verba_label: string;
  politica_nome: string;
  objetivo?: string | null;
  periodo_tipo: string;
  valor_base: number;
  criterios: Array<{ nome: string; descricao?: string | null; peso: number; essencial: boolean }>;
  participantes: Array<{ nome: string; cpf?: string | null; cargo?: string | null; matricula?: string | null }>;
  remuneracao_variavel?: {
    ativo: boolean;
    base?: string | null;
    base_label?: string | null;
    tiers?: Array<{ ate: number; percentual: number }> | null;
    pct_individual?: number | null;
    pct_igualitario?: number | null;
    observacoes?: string | null;
    criterios_individuais?: Array<{ nome: string; peso: number }>;
  } | null;
};

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generatePremioPoliticaPdf(d: PoliticaPdfData) {
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
  const [pr,pg,pb] = hex(primary);

  const ensure = (need: number, y: number) => {
    if (y + need > H - 50) { doc.addPage(); return 60; }
    return y;
  };

  // Reset charSpace to evitar sobreposição de glifos (bug conhecido do jsPDF)
  (doc as any).setCharSpace?.(0);

  // Header — carrega a logo preservando aspecto
  const HEADER_H = 130;
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,HEADER_H,'F');

  // Card branco para a logo (dimensionado depois de conhecer o aspecto)
  const LOGO_BOX_H = 100;
  const LOGO_BOX_MAX_W = 170;
  const LOGO_BOX_Y = (HEADER_H - LOGO_BOX_H) / 2;
  let logoBoxW = LOGO_BOX_MAX_W;

  if (branding?.logo_url) {
    try {
      const dataUrl = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b);
      }));
      // Medir dimensões naturais da imagem para preservar aspecto
      const dims = await new Promise<{ w: number; h: number; fmt: string }>((resolve) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight, fmt: dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG' });
        im.onerror = () => resolve({ w: 1, h: 1, fmt: 'PNG' });
        im.src = dataUrl;
      });
      const aspect = dims.w / dims.h;
      // ajusta o box para caber a logo com padding
      const PADDING = 10;
      const innerH = LOGO_BOX_H - PADDING * 2;
      let innerW = innerH * aspect;
      const maxInnerW = LOGO_BOX_MAX_W - PADDING * 2;
      if (innerW > maxInnerW) innerW = maxInnerW;
      const finalH = Math.min(innerH, innerW / aspect);
      const finalW = finalH * aspect;
      logoBoxW = finalW + PADDING * 2;
      // fundo branco
      doc.setFillColor(255,255,255);
      doc.roundedRect(24, LOGO_BOX_Y, logoBoxW, LOGO_BOX_H, 8, 8, 'F');
      const imgX = 24 + (logoBoxW - finalW) / 2;
      const imgY = LOGO_BOX_Y + (LOGO_BOX_H - finalH) / 2;
      doc.addImage(dataUrl, dims.fmt, imgX, imgY, finalW, finalH, undefined, 'FAST');
    } catch {
      logoBoxW = 0;
    }
  } else {
    logoBoxW = 0;
  }

  const TX = 24 + (logoBoxW > 0 ? logoBoxW + 22 : 0);
  doc.setTextColor(255,255,255);
  // Título em Helvetica normal maior + charSpace positivo para não colar glifos
  (doc as any).setCharSpace?.(0.6);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text(`POLÍTICA DE ${d.verba_label.toUpperCase()}`, TX, LOGO_BOX_Y + 26);
  (doc as any).setCharSpace?.(0);
  doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
  doc.text(`${d.empresa}${d.cnpj ? ` — CNPJ ${d.cnpj}` : ''}`, TX, LOGO_BOX_Y + 52, { maxWidth: W - TX - 24 });
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, TX, LOGO_BOX_Y + 72);
  if (branding?.office_name) doc.text(branding.office_name, TX, LOGO_BOX_Y + 88);

  let y = HEADER_H + 22;
  doc.setTextColor(0,0,0);

  // helper para header de seção (evita overlap de glifos no bold)
  const bandTitle = (text: string, bg: [number,number,number], fg: [number,number,number] = [0,0,0]) => {
    y = ensure(30, y);
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(40, y, W-80, 18, 'F');
    doc.setTextColor(fg[0], fg[1], fg[2]);
    (doc as any).setCharSpace?.(0.4);
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
    doc.text(text, 46, y+12);
    (doc as any).setCharSpace?.(0);
    doc.setTextColor(0,0,0);
    y += 24;
  };

  // Identificação
  bandTitle('IDENTIFICAÇÃO DA POLÍTICA', [245,245,245]);
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  const idLines = [
    `Nome da política: ${d.politica_nome}`,
    `Verba: ${d.verba_label}   Periodicidade: ${d.periodo_tipo}   Valor base: ${BRL(d.valor_base)}`,
  ];
  for (const l of idLines) { doc.text(l, 46, y); y += 12; }
  y += 8;

  // Objetivo
  if (d.objetivo) {
    bandTitle('OBJETIVO', [245,245,245]);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const wrap = doc.splitTextToSize(d.objetivo, W-80);
    for (const w of wrap) { y = ensure(12, y); doc.text(w, 46, y); y += 12; }
    y += 8;
  }

  // Critérios
  const PESO_X = W - 170;
  const ESS_X = W - 90;
  y = ensure(40, y);
  doc.setFillColor(pr,pg,pb); doc.rect(40, y, W-80, 18, 'F');
  doc.setTextColor(255,255,255);
  (doc as any).setCharSpace?.(0.4);
  doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
  doc.text('CRITÉRIO', 46, y+12);
  doc.text('PESO', PESO_X, y+12);
  doc.text('ESSENCIAL', ESS_X, y+12);
  (doc as any).setCharSpace?.(0);
  y += 18;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);

  const totalPeso = d.criterios.reduce((s, c) => s + (c.peso || 0), 0) || 1;
  const nameW = PESO_X - 46 - 8;
  for (const c of d.criterios) {
    const nameLines = doc.splitTextToSize(c.nome, nameW);
    const descLines = c.descricao ? doc.splitTextToSize(c.descricao, nameW) : [];
    const pct = ((c.peso || 0) / totalPeso * 100).toFixed(0);
    const rowH = Math.max(28, 12 * nameLines.length + 11 * descLines.length + 8);
    y = ensure(rowH + 4, y);
    doc.setDrawColor(230,230,230); doc.line(40, y, W-40, y);
    let yy = y + 12;
    doc.setFont('helvetica','bold');
    for (const ln of nameLines) { doc.text(ln, 46, yy); yy += 12; }
    doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80); doc.setFontSize(8);
    for (const ln of descLines) { doc.text(ln, 46, yy); yy += 11; }
    doc.setTextColor(0,0,0); doc.setFontSize(9);
    doc.text(`${c.peso} (${pct}%)`, PESO_X, y+14);
    doc.text(c.essencial ? 'Sim' : 'Não', ESS_X, y+14);
    y += rowH;
  }
  doc.setDrawColor(200,200,200); doc.line(40, y, W-40, y); y += 8;
  doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text('Os percentuais indicam o peso relativo de cada critério no total da apuração. Critérios essenciais zerados impedem o pagamento da verba.', 46, y, { maxWidth: W-80 });
  y += 22; doc.setTextColor(0,0,0);

  // Remuneração Variável
  const rv = d.remuneracao_variavel;
  if (rv && rv.ativo) {
    bandTitle('REMUNERAÇÃO VARIÁVEL — FAIXAS E DISTRIBUIÇÃO', [pr,pg,pb], [255,255,255]);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);

    const baseLabel = rv.base_label || rv.base || 'faturamento';
    const intro = `Esta política adota modelo de remuneração variável. O valor total a ser distribuído a título de ${d.verba_label} será apurado sobre a base "${baseLabel}", conforme faixas de atingimento definidas abaixo. Sobre o montante apurado, aplica-se a divisão entre a parcela vinculada a critérios individuais (pontualidade, assiduidade, desempenho e demais critérios listados nesta política) e a parcela igualitária (distribuída em partes iguais entre os participantes elegíveis).`;
    const iw = doc.splitTextToSize(intro, W-80);
    for (const w of iw) { y = ensure(12, y); doc.text(w, 46, y); y += 12; }
    y += 4;

    // Tabela de faixas
    const tiers = (rv.tiers || []).slice().sort((a,b) => (a.ate||0) - (b.ate||0));
    if (tiers.length > 0) {
      y = ensure(30, y);
      doc.setFont('helvetica','bold'); doc.setFillColor(240,240,240);
      doc.rect(40, y, W-80, 14, 'F');
      doc.text(`FAIXA DE ${baseLabel.toUpperCase()} (ATÉ)`, 46, y+10);
      doc.text('% DESTINADO À VERBA', W-200, y+10);
      y += 14;
      doc.setFont('helvetica','normal');
      let prev = 0;
      for (const t of tiers) {
        y = ensure(14, y);
        doc.setDrawColor(230,230,230); doc.rect(40, y, W-80, 14);
        const faixa = prev > 0 ? `de ${BRL(prev)} até ${BRL(t.ate)}` : `até ${BRL(t.ate)}`;
        doc.text(faixa, 46, y+10);
        doc.text(`${Number(t.percentual || 0).toFixed(2)}%`, W-200, y+10);
        y += 14;
        prev = t.ate;
      }
      y += 16;
    }

    // Distribuição individual vs igualitária
    const ind = Number(rv.pct_individual || 0);
    const igu = Number(rv.pct_igualitario || 0);
    y = ensure(30, y);
    (doc as any).setCharSpace?.(0.3);
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('DIVISÃO DO MONTANTE APURADO', 46, y);
    (doc as any).setCharSpace?.(0);
    y += 14;
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const distLines = [
      `• ${ind.toFixed(2)}% será distribuído com base em CRITÉRIOS INDIVIDUAIS de desempenho (avaliados pelos critérios listados nesta política, incluindo pontualidade, assiduidade e demais indicadores).`,
      `• ${igu.toFixed(2)}% será distribuído de forma IGUALITÁRIA entre os participantes elegíveis no período.`,
    ];
    for (const l of distLines) {
      const w = doc.splitTextToSize(l, W-80);
      for (const ln of w) { y = ensure(12, y); doc.text(ln, 46, y); y += 12; }
    }
    y += 4;

    // Critérios individuais (referência)
    if (rv.criterios_individuais && rv.criterios_individuais.length > 0) {
      y = ensure(20, y);
      doc.setFont('helvetica','bold');
      doc.text('Critérios individuais considerados na parcela individual:', 46, y); y += 12;
      doc.setFont('helvetica','normal');
      const totalP = rv.criterios_individuais.reduce((s,c)=>s+(c.peso||0),0) || 1;
      for (const c of rv.criterios_individuais) {
        const pct = ((c.peso||0)/totalP*100).toFixed(0);
        y = ensure(12, y);
        doc.text(`• ${c.nome} — peso ${c.peso} (${pct}%)`, 52, y); y += 12;
      }
      y += 4;
    }

    // Observações
    if (rv.observacoes && rv.observacoes.trim()) {
      y = ensure(20, y);
      doc.setFont('helvetica','bold');
      doc.text('Observações / regras adicionais:', 46, y); y += 12;
      doc.setFont('helvetica','normal');
      const ow = doc.splitTextToSize(rv.observacoes, W-80);
      for (const w of ow) { y = ensure(12, y); doc.text(w, 46, y); y += 12; }
      y += 4;
    }

    doc.setFontSize(8); doc.setTextColor(120,120,120);
    const nota = 'A remuneração variável tem natureza condicional, não integra a remuneração para fins de habitualidade e depende do atingimento das faixas e do cumprimento dos critérios estabelecidos. O empregador reserva-se o direito de revisar, suspender ou alterar as faixas e percentuais mediante comunicação prévia.';
    const nw = doc.splitTextToSize(nota, W-80);
    for (const w of nw) { y = ensure(11, y); doc.text(w, 46, y); y += 11; }
    doc.setTextColor(0,0,0); doc.setFontSize(9);
    y += 8;
  }

  // Termo de ciência
  bandTitle('TERMO DE CIÊNCIA E CONCORDÂNCIA', [245,245,245]);
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  const termo = `Declaro estar ciente e de acordo com a política de ${d.verba_label} acima descrita, compreendendo seus objetivos, critérios de apuração, pesos atribuídos e regras de elegibilidade. Reconheço que a verba é variável, condicionada ao atingimento dos critérios, não integra a remuneração para fins de habitualidade e poderá ser revista, suspensa ou alterada pelo empregador a qualquer tempo, mediante comunicação prévia.`;
  const tw = doc.splitTextToSize(termo, W-80);
  for (const w of tw) { y = ensure(12, y); doc.text(w, 46, y); y += 12; }
  y += 8;

  // Assinaturas dos colaboradores
  bandTitle('COLABORADORES PARTICIPANTES — ASSINATURAS', [pr,pg,pb], [255,255,255]);
  doc.setFont('helvetica','normal'); doc.setFontSize(8);

  // Header columns
  doc.setFillColor(245,245,245); doc.rect(40, y, W-80, 14, 'F');
  (doc as any).setCharSpace?.(0.3);
  doc.setFont('helvetica','bold');
  doc.text('NOME / CPF / CARGO', 46, y+10);
  doc.text('ASSINATURA', W-260, y+10);
  doc.text('DATA', W-90, y+10);
  (doc as any).setCharSpace?.(0);
  y += 14;
  doc.setFont('helvetica','normal');

  const ROW = 44;
  const participantes = d.participantes.length > 0 ? d.participantes : Array.from({ length: 5 }).map(() => ({ nome: '', cpf: '', cargo: '' }));

  for (const p of participantes) {
    y = ensure(ROW + 4, y);
    doc.setDrawColor(180,180,180);
    doc.rect(40, y, W-80, ROW);
    // left cell
    doc.setFontSize(9);
    if (p.nome) {
      doc.setFont('helvetica','bold'); doc.text(p.nome, 46, y+14, { maxWidth: W-330 });
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,80);
      const info = [
        p.cpf ? `CPF: ${p.cpf}` : null,
        (p as any).matricula ? `Mat.: ${(p as any).matricula}` : null,
        p.cargo ? `Cargo: ${p.cargo}` : null,
      ].filter(Boolean).join('   ');
      if (info) doc.text(info, 46, y+28, { maxWidth: W-330 });
      doc.setTextColor(0,0,0);
    } else {
      doc.setFontSize(8); doc.setTextColor(160,160,160);
      doc.text('Nome: ____________________________________________', 46, y+16);
      doc.text('CPF: __________________  Cargo: __________________', 46, y+32);
      doc.setTextColor(0,0,0);
    }
    // signature line
    doc.setDrawColor(160,160,160);
    doc.line(W-260, y+30, W-100, y+30);
    // date line
    doc.line(W-90, y+30, W-46, y+30);
    doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text('___/___/______', W-86, y+40);
    doc.setTextColor(0,0,0);
    y += ROW + 4;
  }

  // Footer assinatura empregador
  y = ensure(80, y);
  y += 20;
  doc.setDrawColor(120,120,120);
  doc.line(60, y, 280, y);
  doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text('Assinatura do Empregador / Responsável', 60, y+12);
  doc.text(d.empresa, 60, y+26);

  doc.setFontSize(8); doc.setTextColor(120,120,120);
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.text(`${branding?.office_name || 'Sucesso do Cliente — DP'} • ${new Date().toLocaleString('pt-BR')}   Página ${i}/${totalPages}`, 40, H - 20);
  }

  const fileName = `politica-${d.verba_label}-${d.politica_nome.replace(/\s+/g,'_')}.pdf`;
  doc.save(fileName);
  return fileName;
}