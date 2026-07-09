import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';

export type RelatorioFinalData = {
  empresa: string;
  cnpj?: string;
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
  doc.text(`RELATÓRIO FINAL DE ${d.verba_label.toUpperCase()}`, 80, 36);
  doc.setFontSize(10);
  doc.text(`${d.empresa}${d.cnpj ? ` — CNPJ ${d.cnpj}` : ''}`, 80, 54);
  doc.text(`Competência: ${d.competencia} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 80, 68);

  let y = 100; doc.setTextColor(0,0,0);

  const ensure = (need: number) => { if (y + need > H - 60) { doc.addPage(); y = 40; } };
  const boxTitle = (t: string) => {
    ensure(20);
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.setFillColor(pr,pg,pb); doc.setTextColor(255,255,255);
    doc.rect(40, y, W-80, 16, 'F');
    doc.text(t, 46, y+11);
    y += 20; doc.setTextColor(0,0,0);
  };
  const line = (l: string, opts?: { bold?: boolean; size?: number }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal'); doc.setFontSize(opts?.size || 9);
    const wrap = doc.splitTextToSize(l, W - 80);
    for (const w of wrap) { ensure(12); doc.text(w, 46, y+9); y += 12; }
  };

  // Identificação
  boxTitle('IDENTIFICAÇÃO');
  line(`Colaborador: ${d.colaborador.nome}${d.colaborador.cargo ? ` — ${d.colaborador.cargo}` : ''}`, { bold: true });
  const linhaId = [
    d.colaborador.cpf ? `CPF: ${d.colaborador.cpf}` : '',
    d.colaborador.codigo_folha ? `Cód. folha: ${d.colaborador.codigo_folha}` : '',
    d.colaborador.data_admissao ? `Admissão: ${new Date(d.colaborador.data_admissao).toLocaleDateString('pt-BR')}` : '',
  ].filter(Boolean).join('   ');
  if (linhaId) line(linhaId);
  line(`Política: ${d.politica_nome}`);
  y += 4;

  // Demonstrativo coletivo
  if (d.coletivo) {
    boxTitle('DEMONSTRATIVO COLETIVO (METAS DA COMPETÊNCIA)');
    line(`Faturamento total do período: ${BRL(d.coletivo.faturamento_total)} • Dia de referência: ${d.coletivo.dia_referencia} de ${d.coletivo.dias_periodo}`);
    line(`Referência diária (fat ÷ dia): ${BRL(d.coletivo.valor_referencia_dia)}`);
    line(`Metas: M0 ${BRL(d.coletivo.meta_0)}/dia • M1 ${BRL(d.coletivo.meta_1)}/dia • M2 ${BRL(d.coletivo.meta_2)}/dia`);
    y += 4;

    // Tabela
    ensure(20);
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.setFillColor(235,235,235); doc.rect(40, y, W-80, 14, 'F');
    doc.text('CRITÉRIO', 46, y+10);
    doc.text('PESO', W-330, y+10);
    doc.text('BC', W-285, y+10);
    doc.text('NÍVEL', W-215, y+10);
    doc.text('REFERÊNCIA', W-155, y+10);
    doc.text('VALOR', W-46, y+10, { align: 'right' } as any);
    y += 14;
    doc.setFont('helvetica','normal');

    for (const l of d.coletivo.linhas) {
      ensure(14);
      doc.setDrawColor(230,230,230); doc.line(40, y, W-40, y);
      doc.text(String(l.nome).slice(0, 28), 46, y+10);
      doc.text(`${l.peso_pct}%`, W-330, y+10);
      doc.text(BRL(l.bc), W-285, y+10);
      doc.text(`${l.nivel.replace('_',' ')} ${l.pct}%`, W-215, y+10);
      doc.text(String(l.referencia).slice(0, 18), W-155, y+10);
      doc.text(BRL(l.valor), W-46, y+10, { align: 'right' } as any);
      y += 14;
    }
    doc.setDrawColor(180,180,180); doc.line(40, y, W-40, y); y += 4;
    line(`Total coletivo apurado (${d.coletivo.split_coletivo}%): ${BRL(d.coletivo.total_coletivo)}`, { bold: true });
    line(`Pontos do colaborador: ${d.coletivo.pontos_colab} de ${d.coletivo.soma_pontos} pts • Participação: ${d.coletivo.soma_pontos > 0 ? ((d.coletivo.pontos_colab / d.coletivo.soma_pontos) * 100).toFixed(1) : '0,0'}%`);
    line(`SHARE COLETIVO DO COLABORADOR: ${BRL(d.coletivo.share_colab)}`, { bold: true });
    y += 6;
  }

  // Avaliação individual
  boxTitle('AVALIAÇÃO INDIVIDUAL');
  line(`Teto individual: ${BRL(d.individual.valor_base_teto)} • Percentual apurado: ${d.individual.percentual_final.toFixed(0)}% • Elegibilidade: ${d.individual.elegibilidade}`);
  y += 2;
  ensure(20);
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.setFillColor(235,235,235); doc.rect(40, y, W-80, 14, 'F');
  doc.text('CRITÉRIO', 46, y+10);
  doc.text('PESO', W-220, y+10);
  doc.text('%', W-160, y+10);
  y += 14;
  doc.setFont('helvetica','normal');
  for (const c of d.individual.criterios) {
    ensure(14);
    doc.setDrawColor(230,230,230); doc.line(40, y, W-40, y);
    doc.text(`${c.nome}${c.essencial ? ' *' : ''}`.slice(0, 60), 46, y+10);
    doc.text(String(c.peso), W-220, y+10);
    doc.text(`${Number(c.percentual||0).toFixed(0)}%`, W-160, y+10);
    y += 14;
    if (c.observacao) { doc.setTextColor(90,90,90); doc.setFontSize(8); line(`obs: ${c.observacao}`); doc.setTextColor(0,0,0); doc.setFontSize(9); }
    if (c.feedback) { doc.setTextColor(90,90,90); doc.setFontSize(8); line(`feedback: ${c.feedback}`); doc.setTextColor(0,0,0); doc.setFontSize(9); }
  }
  y += 2;
  line(`Valor individual apurado: ${BRL(d.individual.valor_final)}`, { bold: true });
  if (d.individual.parecer_geral) {
    y += 4;
    boxTitle('PARECER / FEEDBACK GERAL');
    line(d.individual.parecer_geral);
  }

  // Total final
  ensure(40);
  y += 6;
  doc.setFillColor(pr,pg,pb); doc.setTextColor(255,255,255);
  doc.rect(40, y, W-80, 26, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(`TOTAL FINAL A RECEBER: ${BRL(d.total_geral)}`, 46, y+17);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  const detalhe = d.coletivo
    ? `(coletivo ${BRL(d.coletivo.share_colab)} + individual ${BRL(d.individual.valor_final)})`
    : `(individual ${BRL(d.individual.valor_final)})`;
  doc.text(detalhe, W-46, y+17, { align: 'right' } as any);
  y += 32; doc.setTextColor(0,0,0);

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

  const fileName = `relatorio-final-${d.verba_label}-${d.colaborador.nome.replace(/\s+/g,'_')}-${d.competencia.replace(/\//g,'-')}.pdf`;
  doc.save(fileName);
  return fileName;
}