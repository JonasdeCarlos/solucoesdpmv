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
  estrutura?: { faixas: any[]; escala_evolucao: any[]; cargos_sugeridos?: any[]; organograma?: any[]; criterios_manuais?: any[] } | null;
  introducao?: string;
  consideracoes?: string;
  incluirOrganograma?: boolean;
  criteriosManuais?: any[];
}) {
  const { empresa, consultor, cargos, estrutura, incluirOrganograma = true, criteriosManuais } = params;
  const replaceManuais = (s?: string) => (s || '').replace(/crit[eé]rios?\s+manuai?s/gi, 'critérios específicos').replace(/manuai?s\s+para\s+evolu/gi, 'específicos para evolu');
  const introducao = replaceManuais(params.introducao);
  const consideracoes = replaceManuais(params.consideracoes);
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
      const props = (doc as any).getImageProperties(img);
      const maxH = 90, maxW = 180;
      const ratio = props.width / props.height;
      let h = maxH, w = h * ratio;
      if (w > maxW) { w = maxW; h = w / ratio; }
      doc.addImage(img, props.fileType || 'PNG', W/2 - w/2, 40, w, h);
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
    // Detect column names from the new `niveis` shape, fallback to legacy min/mid/max
    const colSet = new Set<string>();
    for (const f of estrutura.faixas) {
      if (Array.isArray(f.niveis)) for (const n of f.niveis) colSet.add(n.nome);
    }
    const isLegacy = colSet.size === 0;
    const cols = isLegacy ? ['Mínimo','Médio','Máximo'] : Array.from(colSet);
    autoTable(doc, {
      startY: y,
      head: [['Cargo','Área','Piso CCT', ...cols]],
      body: estrutura.faixas.map((f: any) => {
        const cargo = f.cargo || f.nome || '—';
        const area = f.area || (f.cargos || []).join(', ') || '—';
        const piso = f.piso_cct ? brl(f.piso_cct) : '—';
        const vals = cols.map(cn => {
          if (Array.isArray(f.niveis)) {
            const n = f.niveis.find((x:any)=> x.nome === cn);
            return brl(n?.valor || 0);
          }
          const key = cn === 'Mínimo' ? 'min' : cn === 'Médio' ? 'mid' : 'max';
          return brl(f[key]);
        });
        return [cargo, area, piso, ...vals];
      }),
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

  const cms = (criteriosManuais && criteriosManuais.length ? criteriosManuais : (estrutura?.criterios_manuais || [])) as any[];
  if (cms.length) {
    section('Critérios Específicos para Evolução Salarial');
    for (const c of cms) {
      const cargo = c?.cargo || 'Geral (todos os cargos)';
      const nivel = c?.nivel_alvo ? ` — ${c.nivel_alvo}` : '';
      const texto = c?.texto || c;
      para(`• [${cargo}${nivel}] ${texto}`);
    }
  }

  if (consideracoes) { section('Considerações Finais'); para(consideracoes); }

  // Organograma sugerido (visual tree, igual à pré-visualização "Gerar Organograma")
  // Filtra para conter APENAS cargos cadastrados (segurança caso a IA sugira extras)
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
  const cadastradosSet = new Set(cargos.map(c => norm(c.nome)));
  const allOrg: any[] = estrutura?.organograma || [];
  const orgNodes = allOrg.filter(n => cadastradosSet.has(norm(n.nome)));
  const allowedIds = new Set(orgNodes.map(n => n.id));
  // Limpa parent_id que aponte para nós removidos
  for (const n of orgNodes) {
    if (n.parent_id && !allowedIds.has(n.parent_id)) n.parent_id = null;
  }
  if (orgNodes.length && incluirOrganograma) {
    doc.addPage(); y = 60;
    section('Organograma Sugerido');
    doc.setFontSize(8); doc.setTextColor(90,90,90);
    para('Estrutura hierárquica baseada exclusivamente nos cargos cadastrados pela empresa.');
    doc.setTextColor(0,0,0);

    const byParent = new Map<string|null, any[]>();
    for (const n of orgNodes) {
      const p = n.parent_id || null;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(n);
    }
    const roots = byParent.get(null) || [];

    // Tree layout: measure subtree width then position
    const BOX_W = 130;
    const BOX_H = 42;
    const H_GAP = 24;   // gap entre irmãos
    const V_GAP = 34;   // gap vertical entre níveis

    type Pos = { x: number; y: number; w: number; node: any };
    const positions: Pos[] = [];

    const measure = (node: any): number => {
      const children = byParent.get(node.id) || [];
      if (!children.length) return BOX_W;
      const sum = children.reduce((acc, c) => acc + measure(c), 0) + H_GAP * (children.length - 1);
      return Math.max(BOX_W, sum);
    };
    const place = (node: any, left: number, top: number) => {
      const width = measure(node);
      const cx = left + width / 2;
      positions.push({ x: cx - BOX_W / 2, y: top, w: BOX_W, node });
      const children = byParent.get(node.id) || [];
      if (!children.length) return;
      let cursor = left;
      for (const ch of children) {
        const cw = measure(ch);
        place(ch, cursor, top + BOX_H + V_GAP);
        cursor += cw + H_GAP;
      }
    };

    // Forest: place each root side by side, total width
    let totalW = roots.reduce((a, r) => a + measure(r), 0) + H_GAP * Math.max(0, roots.length - 1);
    let startLeft = Math.max(20, (W - totalW) / 2);
    let scale = 1;
    const available = W - 40;
    if (totalW > available) {
      scale = available / totalW;
      startLeft = 20;
    }
    let cursor = startLeft / scale;
    for (const r of roots) {
      const rw = measure(r);
      place(r, cursor, y / scale);
      cursor += rw + H_GAP;
    }

    // Compute bounds
    const maxY = positions.reduce((m, p) => Math.max(m, p.y + BOX_H), y / scale);
    // If too tall for one page, just render at scale (scaled). We won't paginate the tree.
    const availH = 800 - y;
    const treeH = (maxY - y / scale) * scale;
    if (treeH > availH) {
      scale = Math.min(scale, availH / (maxY - y / scale));
    }

    // Draw connectors (parent bottom → children top with elbow)
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.6);
    const posById = new Map<string, Pos>();
    for (const p of positions) posById.set(p.node.id, p);
    for (const p of positions) {
      const children = byParent.get(p.node.id) || [];
      if (!children.length) continue;
      const parentBottomX = (p.x + BOX_W / 2) * scale;
      const parentBottomY = (p.y + BOX_H) * scale;
      const childTopY = (p.y + BOX_H + V_GAP) * scale;
      const midY = (parentBottomY + childTopY) / 2;
      // vertical from parent
      doc.line(parentBottomX, parentBottomY, parentBottomX, midY);
      const childCenters = children
        .map(c => posById.get(c.id))
        .filter(Boolean)
        .map(cp => (cp!.x + BOX_W / 2) * scale);
      if (childCenters.length) {
        const minX = Math.min(...childCenters);
        const maxX = Math.max(...childCenters);
        doc.line(minX, midY, maxX, midY);
        for (const cx of childCenters) {
          doc.line(cx, midY, cx, (p.y + BOX_H + V_GAP) * scale);
        }
      }
    }

    // Draw boxes
    doc.setLineWidth(0.6);
    for (const p of positions) {
      const x = p.x * scale;
      const yy = p.y * scale;
      const w = BOX_W * scale;
      const h = BOX_H * scale;
      doc.setDrawColor(pr, pg, pb);
      doc.setFillColor(245, 248, 240);
      doc.roundedRect(x, yy, w, h, 3 * scale, 3 * scale, 'FD');
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      const fontSize = Math.max(6, 8 * scale);
      doc.setFontSize(fontSize);
      const nameLines = doc.splitTextToSize(p.node.nome || '—', w - 8).slice(0, 2);
      const lineH = fontSize * 1.1;
      const nivelLabel = p.node.nivel ? (NIVEL_LABEL[p.node.nivel] || p.node.nivel).toUpperCase() : '';
      const nivelSize = Math.max(5, 6.5 * scale);
      const blockH = nameLines.length * lineH + (nivelLabel ? nivelSize + 2 : 0);
      let ty = yy + (h - blockH) / 2 + fontSize * 0.8;
      for (const ln of nameLines) {
        doc.text(ln, x + w / 2, ty, { align: 'center' });
        ty += lineH;
      }
      if (nivelLabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(nivelSize);
        doc.setTextColor(110, 110, 110);
        doc.text(nivelLabel, x + w / 2, ty + 2, { align: 'center' });
      }
    }
    doc.setFont('helvetica', 'normal');
    y = y + treeH + 16;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(`${branding?.office_name || ''} • Plano de Cargos e Salários • ${i}/${total}`, W/2, 825, { align: 'center' });
  }

  doc.save(`PCS_${empresa.replace(/\s+/g,'_')}.pdf`);
}