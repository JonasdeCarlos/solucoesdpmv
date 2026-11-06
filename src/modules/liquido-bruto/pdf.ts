import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';
import type { ParametrosSimulacao, ResultadoBruto } from './engine';

const VERDE: [number, number, number] = [98, 142, 63];
const MARROM: [number, number, number] = [57, 52, 33];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number, d = 2) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

export function linhasDescontos(r: ResultadoBruto, p: ParametrosSimulacao): { desc: string; ref: string; valor: number }[] {
  const l: { desc: string; ref: string; valor: number }[] = [];
  l.push({ desc: 'INSS', ref: `Faixa ${r.inssFaixa} · efetiva ${pct(r.inssAliquotaEfetiva)}`, valor: r.inss });
  l.push({
    desc: 'IRRF',
    ref: `${r.regimeIrrf === 'legal' ? 'Deduções legais' : 'Desconto simplificado'} · redutor Lei 15.270 ${brl(r.reducaoLei15270)}`,
    valor: r.irrf,
  });
  if (p.assistencial.ativo) l.push({ desc: 'Contribuição assistencial', ref: p.assistencial.tipo === 'percentual' ? `${p.assistencial.valor}%` : 'Valor fixo', valor: r.assistencial });
  if (p.vt.ativo) l.push({ desc: 'Vale-transporte', ref: p.vt.custo > 0 ? `menor entre 6% e custo ${brl(p.vt.custo)}` : '6% do salário-base', valor: r.vt });
  if (p.pensao.ativo) l.push({ desc: 'Pensão alimentícia judicial', ref: p.pensao.tipo === 'percentual' ? `${p.pensao.valor}% do bruto` : 'Valor fixo', valor: r.pensao });
  if (p.outros.ativo)
    r.outros.forEach((o, i) => {
      const it = p.outros.itens[i];
      l.push({ desc: o.descricao, ref: it?.tipo === 'percentual' ? `${it.valor}%` : 'Valor fixo', valor: o.valor });
    });
  return l;
}

export async function exportarPdf(opts: {
  r: ResultadoBruto;
  p: ParametrosSimulacao;
  empresa?: string;
  empregado?: string;
  cargo?: string;
  competencia: string; // yyyy-mm
}) {
  const { r, p } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const comp = `${opts.competencia.slice(5, 7)}/${opts.competencia.slice(0, 4)}`;

  const logo = await drawBrandLogo(doc, '/images/logo-monte-verde-pdf.png', 36, 24, 90, 44, { centerY: true });
  const tx = 36 + (logo.w ? logo.w + 12 : 0);
  doc.setTextColor(...MARROM);
  doc.setFont('helvetica', 'bold').setFontSize(10);
  doc.text('MONTE VERDE CONTABILIDADE S/S LTDA', tx, 40);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text('CNPJ 09.250.785/0001-25 — CRC/MG 007275', tx, 52);
  doc.setDrawColor(...VERDE).setLineWidth(1.5).line(36, 76, W - 36, 76);

  doc.setTextColor(...VERDE).setFont('helvetica', 'bold').setFontSize(14);
  doc.text('Simulação Líquido para Bruto', 36, 98);

  const ident: string[][] = [];
  if (opts.empresa) ident.push(['Empresa', opts.empresa]);
  if (opts.empregado) ident.push(['Empregado', opts.empregado]);
  if (opts.cargo) ident.push(['Cargo', opts.cargo]);
  ident.push(['Competência', comp]);
  ident.push(['Líquido desejado', brl(r.liquidoAlvo)]);
  ident.push(['Dependentes IRRF', String(p.dependentes || 0)]);
  if (p.cargoConfianca) ident.push(['Cargo de confiança', 'Adicional de 40% sobre o salário-base']);
  const flags = [
    p.assistencial.ativo && 'Contribuição assistencial',
    p.vt.ativo && 'Vale-transporte',
    p.pensao.ativo && 'Pensão alimentícia',
    p.outros.ativo && p.outros.itens.length > 0 && 'Outros descontos',
  ].filter(Boolean);
  ident.push(['Descontos opcionais', flags.length ? flags.join(', ') : 'Nenhum']);

  autoTable(doc, {
    startY: 108,
    body: ident,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3, textColor: MARROM },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
  });

  let y = (doc as any).lastAutoTable.finalY + 14;
  doc.setFillColor(...VERDE).roundedRect(36, y, W - 72, 40, 4, 4, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'normal').setFontSize(9);
  doc.text('Salário bruto necessário', 48, y + 16);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(brl(r.bruto), 48, y + 33);
  y += 54;

  const desc = linhasDescontos(r, p);
  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Referência', 'Proventos', 'Descontos']],
    body: [
      ['Salário-base', '', brl(r.salarioBase ?? r.bruto), ''],
      ...(r.adicionalCargoConfianca > 0 ? [['Cargo de confiança', '40% do salário-base', brl(r.adicionalCargoConfianca), '']] : []),
      ...desc.map((d) => [d.desc, d.ref, '', brl(d.valor)]),
    ],
    foot: [
      ['Totais', '', brl(r.bruto), brl(r.totalDescontos)],
      ['Líquido obtido', '', '', brl(r.liquido)],
    ],
    headStyles: { fillColor: VERDE, textColor: 255 },
    footStyles: { fillColor: [225, 232, 242], textColor: MARROM },
    styles: { fontSize: 9, textColor: MARROM },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  if (r.diferencaArredondamento > 0) {
    doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...MARROM);
    doc.text(`Líquido obtido ${brl(r.liquido)} (diferença de ${brl(r.diferencaArredondamento)} por arredondamento).`, 36, y + 8);
    y += 14;
  }

  doc.setTextColor(...VERDE).setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Memória de cálculo', 36, y + 16);
  autoTable(doc, {
    startY: y + 22,
    body: memoria(r),
    theme: 'striped',
    styles: { fontSize: 8.5, textColor: MARROM },
    columnStyles: { 0: { cellWidth: 260 }, 1: { halign: 'right' } },
  });

  const H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...MARROM);
  doc.text(`Simulação para fins de planejamento — tabelas vigentes na competência ${comp}`, W / 2, H - 24, { align: 'center' });

  const nome = (opts.empregado || 'simulacao').replace(/[^\w\-]+/g, '_');
  doc.save(`liquido-bruto_${nome}_${opts.competencia}.pdf`);
}

export function memoria(r: ResultadoBruto): string[][] {
  return [
    ...(r.adicionalCargoConfianca > 0 ? [
      ['Salário-base', brl(r.salarioBase)],
      ['Cargo de confiança (salário-base × 40%)', brl(r.adicionalCargoConfianca)],
      ['Bruto total (salário-base + cargo de confiança)', brl(r.bruto)],
    ] : []),
    ['Base do INSS (limitada ao teto)', brl(r.baseInss)],
    ['INSS: alíquota nominal da faixa', `${pct(r.inssAliquotaNominal, 1)} (faixa ${r.inssFaixa})`],
    ['Base IRRF — deduções legais (bruto − INSS − dependentes − pensão)', brl(r.baseIrrfLegal)],
    ['Imposto — deduções legais', brl(r.impostoLegal)],
    ['Base IRRF — desconto simplificado (bruto − simplificado)', brl(r.baseIrrfSimplificada)],
    ['Imposto — desconto simplificado', brl(r.impostoSimplificado)],
    ['Regime aplicado (menor imposto)', r.regimeIrrf === 'legal' ? 'Deduções legais' : 'Desconto simplificado'],
    ['Imposto bruto', brl(r.impostoBruto)],
    ['Redução Lei 15.270/2025 (sobre o rendimento tributável)', brl(r.reducaoLei15270)],
    ['IRRF devido', brl(r.irrf)],
    ['Total de descontos', brl(r.totalDescontos)],
    ['Alíquota efetiva total (descontos ÷ bruto)', pct(r.aliquotaEfetivaTotal)],
  ];
}
