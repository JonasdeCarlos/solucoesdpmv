import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadBranding } from './perfilPdf';

type Args = {
  tipo: 'diagnostico' | 'plano' | 'final';
  auditoria: any;
  itens: any[];
  acoes: any[];
  parecer?: string;
  resumoNarrativo?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', conforme: 'Conforme', nao_conforme: 'Não Conforme', nao_aplicavel: 'Não Aplicável'
};
const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PSTAT_LABEL: Record<string, string> = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído' };

const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];

export async function generateAuditoriaPdf({ tipo, auditoria, itens, acoes, parecer, resumoNarrativo }: Args) {
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const primary = branding?.primary_color || '#628E3F';
  const [pr, pg, pb] = hex(primary);

  // Header
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,80,'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(img, 'PNG', 20, 15, 50, 50);
    } catch {}
  }
  const titulo = tipo === 'diagnostico' ? 'Relatório Diagnóstico de Auditoria'
    : tipo === 'plano' ? 'Plano de Ação' : 'Relatório Final de Auditoria';
  doc.setTextColor(255,255,255); doc.setFontSize(15); doc.text(titulo, 80, 35);
  doc.setFontSize(10); doc.text(`${auditoria.empresa_nome} ${auditoria.cnpj ? '— '+auditoria.cnpj : ''}`, 80, 55);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 80, 70);

  let y = 100;
  doc.setTextColor(0,0,0); doc.setFontSize(10);

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

  // Dados gerais
  section('Dados da Auditoria');
  para(`Consultor: ${auditoria.consultor || '—'}`);
  para(`Responsável (empresa): ${auditoria.responsavel || '—'}`);
  para(`Data de início: ${auditoria.data_inicio ? new Date(auditoria.data_inicio).toLocaleDateString('pt-BR') : '—'}`);
  para(`Objetivo: ${auditoria.objetivo || '—'}`);

  if (tipo === 'diagnostico' || tipo === 'final') {
    const total = itens.length;
    const conformes = itens.filter(i => i.status === 'conforme').length;
    const naoConf = itens.filter(i => i.status === 'nao_conforme').length;
    const naoApl = itens.filter(i => i.status === 'nao_aplicavel').length;
    const pend = itens.filter(i => i.status === 'pendente').length;
    section('Resumo Quantitativo');
    autoTable(doc, {
      startY: y,
      head: [['Total', 'Conformes', 'Não Conformes', 'Não Aplicáveis', 'Pendentes']],
      body: [[total, conformes, naoConf, naoApl, pend]],
      headStyles: { fillColor: [pr,pg,pb] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Por área
    const areas = Array.from(new Set(itens.map(i => i.area)));
    const body = areas.map(a => {
      const grp = itens.filter(i => i.area === a);
      return [a, grp.length,
        grp.filter(i=>i.status==='conforme').length,
        grp.filter(i=>i.status==='nao_conforme').length,
        grp.filter(i=>i.status==='nao_aplicavel').length,
        grp.filter(i=>i.status==='pendente').length,
      ];
    });
    section('Resultados por Área');
    autoTable(doc, {
      startY: y,
      head: [['Área','Itens','Conf.','N.Conf.','N.Apl.','Pend.']],
      body,
      headStyles: { fillColor: [pr,pg,pb] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (resumoNarrativo) {
      section('Análise Narrativa');
      para(resumoNarrativo);
    }
  }

  if (tipo === 'final') {
    section('Itens Verificados — Detalhamento');
    const areas = Array.from(new Set(itens.map(i => i.area)));
    for (const a of areas) {
      const grp = itens.filter(i => i.area === a);
      if (y > 760) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(a, 20, y); y += 14; doc.setFont('helvetica','normal');
      autoTable(doc, {
        startY: y,
        head: [['Item','Status','Observações']],
        body: grp.map(i => [i.titulo, STATUS_LABEL[i.status]||i.status, i.observacoes || '']),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [pr,pg,pb] },
        columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 70 } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  if (tipo === 'plano' || tipo === 'final') {
    section('Plano de Ação');
    if (acoes.length === 0) para('Nenhuma ação cadastrada.');
    else {
      autoTable(doc, {
        startY: y,
        head: [['Item / Ação corretiva','Responsável','Prazo','Prior.','Status']],
        body: acoes.map(a => {
          const item = itens.find(i => i.id === a.item_id);
          return [
            `${item ? item.titulo + '\n' : ''}${a.acao_corretiva}`,
            a.responsavel || '—',
            a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '—',
            PRIO_LABEL[a.prioridade] || a.prioridade,
            PSTAT_LABEL[a.status] || a.status,
          ];
        }),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [pr,pg,pb] },
        columnStyles: { 0: { cellWidth: 250 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  if (tipo === 'plano') {
    if (y > 700) { doc.addPage(); y = 40; }
    y += 30;
    doc.text('_____________________________________', 60, y); y += 14;
    doc.text('Assinatura do Cliente', 60, y);
    doc.text('_____________________________________', 330, y-14); doc.text('Assinatura do Consultor', 330, y);
  }

  if (tipo === 'final' && parecer) {
    section('Parecer Final');
    para(parecer);
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(`${branding?.office_name || ''} • Auditoria Trabalhista • ${i}/${total}`, W/2, 825, { align: 'center' });
  }

  doc.save(`Auditoria_${tipo}_${auditoria.empresa_nome.replace(/\s+/g,'_')}.pdf`);
}