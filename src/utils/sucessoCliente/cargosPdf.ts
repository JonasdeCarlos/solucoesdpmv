import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadBranding } from './perfilPdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';
import { withPcsCapa, nextPcsRevision } from './pcsCapaTemplate';
import { normalizeOrganograma } from './organograma';

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
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#393421';
  const [pr,pg,pb] = hex(primary);
  const [sr,sg,sb] = hex(secondary);
  const MARGIN = 36;
  const CONTENT_W = W - MARGIN * 2;
  const BOTTOM = 790;

  // A capa oficial (Manual de ID) é anexada no final via pdf-lib.
  let y = 64;
  doc.setTextColor(0,0,0);
  const section = (title: string) => {
    if (y > 750) { doc.addPage(); y = 64; }
    doc.setFillColor(pr,pg,pb); doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(title, MARGIN + 10, y+15);
    y += 34; doc.setTextColor(42,42,38); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  };
  const para = (text: string, options?: { bullet?: boolean; indent?: number }) => {
    const indent = options?.indent || 0;
    const bullet = options?.bullet;
    const clean = String(text || '').replace(/^•\s*/, '').trim();
    const textX = MARGIN + indent + (bullet ? 12 : 0);
    const width = CONTENT_W - indent - (bullet ? 12 : 0);
    const lines = doc.splitTextToSize(clean, width);
    for (let i = 0; i < lines.length; i++) {
      if (y > BOTTOM) { doc.addPage(); y = 64; }
      if (bullet && i === 0) {
        doc.setFillColor(pr, pg, pb);
        doc.circle(MARGIN + indent + 3, y - 2.5, 1.6, 'F');
      }
      doc.text(lines[i], textX, y, {
        align: i < lines.length - 1 && lines[i].trim().includes(' ') ? 'justify' : 'left',
        maxWidth: width,
      });
      y += 14;
    }
    y += 6;
  };

  if (introducao) { section('Introdução e Metodologia'); para(introducao); }

  section('Descrições de Cargo');
  for (const c of cargos) {
    if (y > 710) { doc.addPage(); y = 64; }
    doc.setFillColor(247,249,245); doc.setDrawColor(220,226,216);
    doc.roundedRect(MARGIN, y - 13, CONTENT_W, 27, 3, 3, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(sr,sg,sb);
    doc.text(c.nome || 'Cargo', MARGIN + 10, y + 4);
    if (c.cbo) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(95,100,92);
      doc.text(`CBO ${c.cbo}`, W - MARGIN - 10, y + 4, { align: 'right' });
    }
    y += 27;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(42,42,38);
    if (c.area || c.nivel) para(`Área: ${c.area || '—'}  |  Nível: ${NIVEL_LABEL[c.nivel] || c.nivel || '—'}`);
    if (c.descricao_sumaria) para(c.descricao_sumaria);
    const ativs: string[] = Array.isArray(c.atividades) ? c.atividades : [];
    if (ativs.length) {
      doc.setFont('helvetica','bold'); para('Atividades:');
      doc.setFont('helvetica','normal');
      for (const a of ativs) para(a, { bullet: true, indent: 4 });
    }
    const req = c.requisitos || {};
    if (req.escolaridade || req.experiencia || (req.competencias?.length)) {
      doc.setFont('helvetica','bold'); para('Requisitos:');
      doc.setFont('helvetica','normal');
      if (req.escolaridade) para(`Escolaridade: ${req.escolaridade}`);
      if (req.experiencia) para(`Experiência: ${req.experiencia}`);
      if (req.competencias?.length) para(`Competências: ${req.competencias.join(', ')}`);
    }
    y += 10;
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
      theme: 'grid',
      headStyles: { fillColor: [pr,pg,pb], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [247,249,245] },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [220,226,216], textColor: [50,50,46], valign: 'middle' },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (estrutura?.escala_evolucao?.length) {
    section('Escala de Evolução');
    autoTable(doc, {
      startY: y,
      head: [['Etapa','% base','Descrição']],
      body: estrutura.escala_evolucao.map((e: any) => [e.etapa, `${e.percentual_base}%`, e.descricao || '']),
      theme: 'grid',
      headStyles: { fillColor: [pr,pg,pb], textColor: [255,255,255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247,249,245] },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [220,226,216], textColor: [50,50,46] },
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
      para(`[${cargo}${nivel}] ${texto}`, { bullet: true, indent: 4 });
    }
  }

  if (consideracoes) { section('Considerações Finais'); para(consideracoes); }

  // Organograma (exatamente como editado em "Editar Organograma")
  const orgNodes = normalizeOrganograma(estrutura?.organograma || []);
  if (orgNodes.length && incluirOrganograma) {
    doc.addPage('a4', 'landscape');
    const orgW = doc.internal.pageSize.getWidth();
    const orgH = doc.internal.pageSize.getHeight();
    y = 62;
    doc.setFillColor(pr,pg,pb); doc.roundedRect(MARGIN, y, orgW - MARGIN * 2, 22, 3, 3, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Organograma Organizacional', MARGIN + 10, y + 15);
    y += 34; doc.setFont('helvetica', 'normal');
    doc.setFontSize(8); doc.setTextColor(90,90,90);
    doc.text('Estrutura hierárquica conforme definida e validada pela empresa.', MARGIN, y);
    y += 20;
    doc.setTextColor(0,0,0);


    const byParent = new Map<string|null, any[]>();
    for (const n of orgNodes) {
      const p = n.parent_id || null;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(n);
    }
    const roots = byParent.get(null) || [];

    // Tree layout: measure subtree width then position
    const BOX_W = 150;
    const BOX_H = 54;
    const H_GAP = 28;
    const V_GAP = 42;

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

    // Layout em coordenadas locais (origem 0,0); escala e deslocamento aplicados na hora de desenhar
    const totalW = roots.reduce((a, r) => a + measure(r), 0) + H_GAP * Math.max(0, roots.length - 1);
    let cursor = 0;
    for (const r of roots) {
      const rw = measure(r);
      place(r, cursor, 0);
      cursor += rw + H_GAP;
    }

    // Bounds locais
    const localH = positions.reduce((m, p) => Math.max(m, p.y + BOX_H), BOX_H);
    const availW = orgW - MARGIN * 2;
    const availH = orgH - y - 46;
    const scale = Math.min(1, availW / Math.max(totalW, 1), availH / Math.max(localH, 1));
    const treeW = totalW * scale;
    const treeH = localH * scale;
    const offX = Math.max(MARGIN, (orgW - treeW) / 2);
    const offY = y;
    const TX = (v: number) => offX + v * scale;
    const TY = (v: number) => offY + v * scale;

    // Draw connectors (parent bottom → children top with elbow)
    doc.setDrawColor(176, 188, 170);
    doc.setLineWidth(1);
    const posById = new Map<string, Pos>();
    for (const p of positions) posById.set(p.node.id, p);
    for (const p of positions) {
      const children = byParent.get(p.node.id) || [];
      if (!children.length) continue;
      const parentBottomX = TX(p.x + BOX_W / 2);
      const parentBottomY = TY(p.y + BOX_H);
      const childTopY = TY(p.y + BOX_H + V_GAP);
      const midY = (parentBottomY + childTopY) / 2;
      doc.line(parentBottomX, parentBottomY, parentBottomX, midY);
      const childCenters = children
        .map(c => posById.get(c.id))
        .filter(Boolean)
        .map(cp => TX(cp!.x + BOX_W / 2));
      if (childCenters.length) {
        const minX = Math.min(...childCenters);
        const maxX = Math.max(...childCenters);
        doc.line(minX, midY, maxX, midY);
        for (const cx of childCenters) {
          doc.line(cx, midY, cx, childTopY);
        }
      }
    }

    // Draw boxes
    doc.setLineWidth(0.8);
    for (const p of positions) {
      const x = TX(p.x);
      const yy = TY(p.y);
      const w = BOX_W * scale;
      const h = BOX_H * scale;
      const isRoot = !p.node.parent_id;
      doc.setDrawColor(isRoot ? pr : 205, isRoot ? pg : 213, isRoot ? pb : 200);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, yy, w, h, 5 * scale, 5 * scale, 'FD');

      const avatarSize = 24 * scale;
      const avatarX = x + 9 * scale + avatarSize / 2;
      const avatarY = yy + h / 2;
      doc.setFillColor(isRoot ? pr : 225, isRoot ? pg : 232, isRoot ? pb : 222);
      doc.circle(avatarX, avatarY, avatarSize / 2, 'F');
      const initials = String(p.node.nome || '')
        .split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('');
      doc.setTextColor(isRoot ? 255 : sr, isRoot ? 255 : sg, isRoot ? 255 : sb);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.max(4.5, 7 * scale));
      doc.text(initials || '•', avatarX, avatarY + 2.5 * scale, { align: 'center' });

      doc.setTextColor(sr, sg, sb);
      doc.setFont('helvetica', 'bold');
      const fontSize = Math.max(5, 8.5 * scale);
      doc.setFontSize(fontSize);
      const textX = x + 42 * scale;
      const textW = w - 49 * scale;
      const nameLines = doc.splitTextToSize(p.node.nome || '—', textW).slice(0, 2);
      const lineH = fontSize * 1.1;
      const nivelLabel = p.node.nivel ? (NIVEL_LABEL[p.node.nivel] || p.node.nivel).toUpperCase() : '';
      const nivelSize = Math.max(4.5, 6.5 * scale);
      const blockH = nameLines.length * lineH + (nivelLabel ? nivelSize + 2 : 0);
      let ty = yy + (h - blockH) / 2 + fontSize * 0.8;
      for (const ln of nameLines) {
        doc.text(ln, textX, ty);
        ty += lineH;
      }
      if (nivelLabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(nivelSize);
        doc.setTextColor(110, 110, 110);
        doc.text(nivelLabel, textX, ty + 2);
      }
    }
    doc.setFont('helvetica', 'normal');
    y = offY + treeH + 16;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(pr,pg,pb); doc.setLineWidth(0.7); doc.line(MARGIN, 46, pageW - MARGIN, 46);
    await drawBrandLogo(doc, branding?.logo_url || '/images/logo-monte-verde-pdf.png', MARGIN, 12, 64, 28, { centerY: true });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(sr,sg,sb);
    doc.text('PLANO DE CARGOS E SALÁRIOS', pageW - MARGIN, 30, { align: 'right' });
    doc.setFillColor(sr,sg,sb); doc.rect(0, pageH - 27, pageW, 27, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
    const contact = [branding?.office_name, branding?.phone, branding?.email].filter(Boolean).join('  •  ');
    doc.text(contact || 'Plano de Cargos e Salários', pageW / 2, pageH - 10, { align: 'center' });
    doc.text(`${i + 1}/${total + 1}`, pageW - MARGIN, pageH - 10, { align: 'right' });
  }

  const revisao = nextPcsRevision(empresa);
  const blob = await withPcsCapa(doc.output('arraybuffer'), empresa, revisao);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PCS_${empresa.replace(/\s+/g,'_')}_rev${revisao}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}