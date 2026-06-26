import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';

export type AlinhamentoData = {
  empresa: string;
  cnpj?: string;
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
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
  const [pr,pg,pb] = hex(primary);

  // Header
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,80,'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b);
      }));
      doc.addImage(img, 'PNG', 20, 15, 50, 50);
    } catch {}
  }
  doc.setTextColor(255,255,255); doc.setFontSize(15);
  doc.text(`ALINHAMENTO DE ${d.verba_label.toUpperCase()}`, 80, 36);
  doc.setFontSize(10);
  doc.text(`${d.empresa}${d.cnpj ? ` — CNPJ ${d.cnpj}` : ''}`, 80, 54);
  doc.text(`Competência: ${d.competencia} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 80, 68);

  let y = 100;
  doc.setTextColor(0,0,0);

  const box = (title: string, lines: string[]) => {
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.setFillColor(245,245,245); doc.rect(40, y, W-80, 14, 'F');
    doc.text(title, 46, y+10); y += 18;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    for (const l of lines) {
      const wrap = doc.splitTextToSize(l, W-80);
      for (const ww of wrap) { if (y > H - 60) { doc.addPage(); y = 40; } doc.text(ww, 46, y); y += 12; }
    }
    y += 4;
  };

  box('IDENTIFICAÇÃO', [
    `Colaborador: ${d.colaborador.nome}${d.colaborador.cargo ? ` — ${d.colaborador.cargo}` : ''}`,
    `${d.colaborador.cpf ? `CPF: ${d.colaborador.cpf}   ` : ''}${d.colaborador.codigo_folha ? `Cód. folha: ${d.colaborador.codigo_folha}   ` : ''}${d.colaborador.data_admissao ? `Admissão: ${new Date(d.colaborador.data_admissao).toLocaleDateString('pt-BR')}` : ''}`,
    `Política: ${d.politica_nome}`,
    `Verba: ${d.verba_label}   Valor base: ${BRL(d.valor_base)}`,
    ...(d.objetivo ? [`Objetivo: ${d.objetivo}`] : []),
  ]);

  // Critérios table
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.setFillColor(pr,pg,pb); doc.setTextColor(255,255,255);
  doc.rect(40, y, W-80, 16, 'F');
  doc.text('CRITÉRIO', 46, y+11);
  doc.text('%', W-220, y+11);
  doc.text('PESO', W-180, y+11);
  doc.text('STATUS', W-130, y+11);
  y += 16;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);

  for (const c of d.criterios) {
    if (y > H - 80) { doc.addPage(); y = 40; }
    const nameW = W - 240;
    const nameLines = doc.splitTextToSize(`${c.nome}${c.essencial ? ' *' : ''}`, nameW);
    const obsLines = c.observacao ? doc.splitTextToSize(`obs: ${c.observacao}`, nameW) : [];
    const fbLines = c.feedback ? doc.splitTextToSize(`feedback: ${c.feedback}`, nameW) : [];
    const rowH = 12 * Math.max(1, nameLines.length) + 12 * obsLines.length + 12 * fbLines.length + 6;
    doc.setDrawColor(230,230,230); doc.line(40, y, W-40, y);
    let yy = y + 11;
    for (const ln of nameLines) { doc.text(ln, 46, yy); yy += 12; }
    doc.setTextColor(90,90,90); doc.setFontSize(8);
    for (const ln of obsLines) { doc.text(ln, 46, yy); yy += 12; }
    for (const ln of fbLines) { doc.text(ln, 46, yy); yy += 12; }
    doc.setTextColor(0,0,0); doc.setFontSize(9);
    doc.text(`${Number(c.percentual||0).toFixed(0)}%`, W-220, y+11);
    doc.text(String(c.peso), W-180, y+11);
    doc.text(String(c.status || '—').slice(0, 14), W-130, y+11);
    y += rowH;
  }
  doc.setDrawColor(200,200,200); doc.line(40, y, W-40, y); y += 8;
  doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text('* critério essencial', 46, y); y += 14;
  doc.setTextColor(0,0,0);

  // Resultado
  if (y > H - 200) { doc.addPage(); y = 40; }
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.setFillColor(pr,pg,pb); doc.setTextColor(255,255,255);
  doc.rect(40, y, W-80, 22, 'F');
  doc.text(`PERCENTUAL FINAL: ${d.percentual_final.toFixed(0)}%`, 46, y+15);
  doc.text(`${d.verba_label.toUpperCase()}: ${BRL(d.valor_final)}`, W-220, y+15);
  y += 28;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`Elegibilidade: ${d.elegibilidade}`, 46, y); y += 16;

  if (d.parecer_geral) {
    box('PARECER / FEEDBACK GERAL', [d.parecer_geral]);
  }

  // Assinaturas
  if (y > H - 130) { doc.addPage(); y = H - 130; } else { y = Math.max(y + 20, H - 130); }
  doc.setDrawColor(120,120,120);
  doc.line(60, y, 260, y);
  doc.line(W-260, y, W-60, y);
  doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text('Assinatura do Colaborador', 60, y+12);
  doc.text(d.colaborador.nome, 60, y+26);
  doc.text('Assinatura do Responsável (Empregador)', W-260, y+12);

  doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text(`${branding?.office_name || 'Sucesso do Cliente — DP'} • ${new Date().toLocaleString('pt-BR')}`, 40, H - 20);

  const fileName = `alinhamento-${d.verba_label}-${d.colaborador.nome.replace(/\s+/g,'_')}-${d.competencia.replace(/\//g,'-')}.pdf`;
  doc.save(fileName);
  return fileName;
}