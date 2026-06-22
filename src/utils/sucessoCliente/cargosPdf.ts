import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadBranding } from './perfilPdf';

const NIVEL_LABEL: Record<string,string> = {
  operacional:'Operacional', tecnico:'Técnico', analista:'Analista',
  especialista:'Especialista', gestao:'Gestão', diretoria:'Diretoria'
};
const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
const brl = (n: any) => Number(n||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function generateCargosPdf(params: {
  empresa: string;
  consultor?: string;
  cargos: any[];
  estrutura?: { faixas: any[]; escala_evolucao: any[] } | null;
  introducao?: string;
  consideracoes?: string;
}) {
  const { empresa, consultor, cargos, estrutura, introducao, consideracoes } = params;
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const primary = branding?.primary_color || '#628E3F';
  const [pr,pg,pb] = hex(primary);

  // Capa
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,300,'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(img, 'PNG', W/2-40, 50, 80, 80);
    } catch {}
  }
  doc.setTextColor(255,255,255); doc.setFontSize(22); doc.text('Plano de Cargos e Salários', W/2, 180, { align: 'center' });
  doc.setFontSize(14); doc.text(empresa, W/2, 210, { align: 'center' });
  doc.setFontSize(11); doc.text(`Consultor: ${consultor || '—'}`, W/2, 240, { align: 'center' });
  doc.text(new Date().toLocaleDateString('pt-BR'), W/2, 260, { align: 'center' });

  doc.addPage();
  let y = 60;
  doc.setTextColor(0,0,0);
  const section = (title: string) => {
    if (y > 750) { doc.addPage(); y = 40; }
    doc.setFillColor(pr,pg,pb); doc.rect(20, y, W-40, 18, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.text(title, 26, y+13);
    y += 26; doc.setTextColor(0,0,0); doc.setFontSize(9);
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, W-40);
    for (const ln of lines) { if (y > 790) { doc.addPage(); y = 40; } doc.text(ln, 20, y); y += 12; }
    y += 4;
  };

  if (introducao) { section('Introdução e Metodologia'); para(introducao); }

  section('Descrições de Cargo');
  for (const c of cargos) {
    if (y > 720) { doc.addPage(); y = 40; }
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text(`${c.nome}${c.cbo ? ' (CBO '+c.cbo+')' : ''}`, 20, y); y += 14;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    if (c.area || c.nivel) para(`Área: ${c.area || '—'} • Nível: ${NIVEL_LABEL[c.nivel] || c.nivel || '—'}`);
    if (c.descricao_sumaria) para(c.descricao_sumaria);
    const ativs: string[] = Array.isArray(c.atividades) ? c.atividades : [];
    if (ativs.length) {
      doc.setFont('helvetica','bold'); para('Atividades:');
      doc.setFont('helvetica','normal');
      for (const a of ativs) para(`• ${a}`);
    }
    const req = c.requisitos || {};
    if (req.escolaridade || req.experiencia || (req.competencias?.length)) {
      doc.setFont('helvetica','bold'); para('Requisitos:');
      doc.setFont('helvetica','normal');
      if (req.escolaridade) para(`Escolaridade: ${req.escolaridade}`);
      if (req.experiencia) para(`Experiência: ${req.experiencia}`);
      if (req.competencias?.length) para(`Competências: ${req.competencias.join(', ')}`);
    }
    y += 6;
  }

  if (estrutura?.faixas?.length) {
    section('Estrutura Salarial');
    autoTable(doc, {
      startY: y,
      head: [['Faixa','Cargos','Mín.','Médio','Máx.']],
      body: estrutura.faixas.map((f: any) => [f.nome, (f.cargos||[]).join(', '), brl(f.min), brl(f.mid), brl(f.max)]),
      headStyles: { fillColor: [pr,pg,pb] },
      styles: { fontSize: 8, cellPadding: 3 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (estrutura?.escala_evolucao?.length) {
    section('Escala de Evolução');
    autoTable(doc, {
      startY: y,
      head: [['Etapa','% base','Descrição']],
      body: estrutura.escala_evolucao.map((e: any) => [e.etapa, `${e.percentual_base}%`, e.descricao || '']),
      headStyles: { fillColor: [pr,pg,pb] },
      styles: { fontSize: 8, cellPadding: 3 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (consideracoes) { section('Considerações Finais'); para(consideracoes); }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(`${branding?.office_name || ''} • Plano de Cargos e Salários • ${i}/${total}`, W/2, 825, { align: 'center' });
  }

  doc.save(`PCS_${empresa.replace(/\s+/g,'_')}.pdf`);
}