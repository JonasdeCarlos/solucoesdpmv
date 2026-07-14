import jsPDF from 'jspdf';
import { drawBrandLogo } from '@/utils/pdfBrandLogo';
import autoTable from 'jspdf-autotable';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { loadBranding } from './perfilPdf';
import JSZip from 'jszip';

// Extrai texto plano de arquivos ODT (OpenOffice) ou DOCX (Word).
async function extractTextFromOfficeZip(buf: ArrayBuffer, kind: 'odt' | 'docx'): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const entry = kind === 'odt' ? zip.file('content.xml') : zip.file('word/document.xml');
  if (!entry) return [];
  const xml = await entry.async('string');
  // Quebra por parágrafo
  const tag = kind === 'odt' ? 'text:p' : 'w:p';
  const re = new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'g');
  const blocks = xml.match(re) || [];
  const paragraphs: string[] = [];
  for (const b of blocks) {
    const text = b.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

type Args = {
  tipo: 'diagnostico' | 'plano' | 'final' | 'dossie';
  auditoria: any;
  itens: any[];
  acoes: any[];
  acaoFiles?: any[];
  parecer?: string;
  resumoNarrativo?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', conforme: 'Conforme', nao_conforme: 'Não Conforme', nao_aplicavel: 'Não Aplicável'
};
const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PSTAT_LABEL: Record<string, string> = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído' };

const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];

export async function generateAuditoriaPdf({ tipo, auditoria, itens, acoes, acaoFiles = [], parecer, resumoNarrativo }: Args) {
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const primary = branding?.primary_color || '#628E3F';
  const [pr, pg, pb] = hex(primary);

  // Header
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,95,'F');
  await drawBrandLogo(doc, branding?.logo_url, 20, 12, 85, 70, { centerY: true });
  const titulo = tipo === 'diagnostico' ? 'Relatório Diagnóstico de Auditoria'
    : tipo === 'plano' ? 'Plano de Ação'
    : tipo === 'dossie' ? 'Dossiê de Auditoria'
    : 'Relatório Final de Auditoria';
  doc.setTextColor(255,255,255); doc.setFontSize(15); doc.text(titulo, 120, 40);
  doc.setFontSize(10); doc.text(`${auditoria.empresa_nome} ${auditoria.cnpj ? '— '+auditoria.cnpj : ''}`, 120, 62);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 120, 78);

  let y = 115;
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

  if (tipo === 'diagnostico' || tipo === 'final' || tipo === 'dossie') {
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

  if (tipo === 'final' || tipo === 'dossie') {
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

  if (tipo === 'plano' || tipo === 'final' || tipo === 'dossie') {
    section('Plano de Ação');
    if (acoes.length === 0) para('Nenhuma ação cadastrada.');
    else {
      autoTable(doc, {
        startY: y,
        head: [['Item / Ação corretiva','Responsável','Prazo','Prior.','Status','Anexos']],
        body: acoes.map(a => {
          const item = itens.find(i => i.id === a.item_id);
          const anexos = acaoFiles.filter(f => f.acao_id === a.id);
          return [
            `${item ? item.titulo + '\n' : ''}${a.acao_corretiva}`,
            a.responsavel || '—',
            a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '—',
            PRIO_LABEL[a.prioridade] || a.prioridade,
            PSTAT_LABEL[a.status] || a.status,
            anexos.length ? anexos.map(f => `• ${f.file_name}`).join('\n') : '—',
          ];
        }),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [pr,pg,pb] },
        columnStyles: { 0: { cellWidth: 200 }, 5: { cellWidth: 90 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  if (tipo === 'dossie' && acaoFiles.length > 0) {
    section('Documentos Anexados');
    para(`Total de anexos: ${acaoFiles.length}. As páginas a seguir reúnem os documentos PDF e imagens anexados ao plano. Arquivos em outros formatos (Word, planilhas) ficam apenas listados.`);
    for (const f of acaoFiles) {
      const acao = acoes.find(a => a.id === f.acao_id);
      const item = acao ? itens.find(i => i.id === acao.item_id) : null;
      para(`• ${f.file_name} — ${item ? item.titulo : 'Ação ' + (acao?.acao_corretiva?.slice(0,40) || '')}`);
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

  const baseName = `Auditoria_${tipo}_${auditoria.empresa_nome.replace(/\s+/g,'_')}.pdf`;

  // Dossiê: faz merge dos PDFs/imagens anexados
  if (tipo === 'dossie' && acaoFiles.length) {
    const ext = (n: string) => (n.split('.').pop() || '').toLowerCase();
    const isPdf = (f: any) => (f.mime_type || '').includes('pdf') || ext(f.file_name) === 'pdf';
    const isImg = (f: any) => /^(jpe?g|png)$/.test(ext(f.file_name)) || /^image\/(jpeg|png)/.test(f.mime_type || '');

    const basePdfBytes = doc.output('arraybuffer');
    const merged = await PDFDocument.load(basePdfBytes);
    const helv = await merged.embedFont(StandardFonts.HelveticaBold);
    let added = 0;

    for (const f of acaoFiles) {
      const acao = acoes.find(a => a.id === f.acao_id);
      const item = acao ? itens.find(i => i.id === acao.item_id) : null;
      const titulo = `${item ? item.titulo : 'Ação'} — ${f.file_name}`;
      try {
        const { data: signed } = await supabase.storage.from('auditoria-docs').createSignedUrl(f.file_path, 600);
        if (!signed?.signedUrl) { console.warn('Sem URL assinada', f.file_name); continue; }

        // Capa do anexo
        const cover = merged.addPage([595, 842]);
        cover.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: rgb(pr/255, pg/255, pb/255) });
        cover.drawText('Anexo', { x: 24, y: 815, size: 16, font: helv, color: rgb(1,1,1) });
        cover.drawText(titulo.slice(0, 80), { x: 24, y: 760, size: 12, font: helv, color: rgb(0,0,0) });
        if (acao?.acao_corretiva) {
          cover.drawText(`Ação: ${String(acao.acao_corretiva).slice(0,90)}`, { x: 24, y: 740, size: 10, font: helv, color: rgb(0.3,0.3,0.3) });
        }
        added++;

        const buf = await fetch(signed.signedUrl).then(r => r.arrayBuffer());
        const fileExt = ext(f.file_name);
        if (isPdf(f)) {
          const anex = await PDFDocument.load(buf, { ignoreEncryption: true });
          const pages = await merged.copyPages(anex, anex.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } else if (isImg(f)) {
          const img = ext(f.file_name) === 'png' || (f.mime_type || '').includes('png')
            ? await merged.embedPng(buf)
            : await merged.embedJpg(buf);
          const page = merged.addPage([595, 842]);
          const maxW = 555, maxH = 780;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          page.drawImage(img, { x: (595 - w) / 2, y: (842 - h) / 2, width: w, height: h });
        } else if (fileExt === 'odt' || fileExt === 'docx') {
          // Converte ODT/DOCX em páginas de texto plano
          try {
            const paragraphs = await extractTextFromOfficeZip(buf, fileExt as 'odt' | 'docx');
            if (!paragraphs.length) {
              cover.drawText('Documento vazio ou ilegível.', { x: 24, y: 700, size: 10, font: helv, color: rgb(0.5,0.1,0.1) });
            } else {
              const helvReg = await merged.embedFont(StandardFonts.Helvetica);
              const pageW = 595, pageH = 842, margin = 50, lineH = 13, fontSize = 10;
              const maxW = pageW - margin * 2;
              let page = merged.addPage([pageW, pageH]);
              page.drawRectangle({ x: 0, y: pageH - 28, width: pageW, height: 28, color: rgb(pr/255, pg/255, pb/255) });
              page.drawText(`Conteúdo: ${f.file_name}`.slice(0, 80), { x: margin, y: pageH - 19, size: 10, font: helv, color: rgb(1,1,1) });
              let yy = pageH - margin - 10;
              const wrap = (text: string): string[] => {
                const words = text.split(' ');
                const lines: string[] = [];
                let cur = '';
                for (const w of words) {
                  const test = cur ? cur + ' ' + w : w;
                  if (helvReg.widthOfTextAtSize(test, fontSize) > maxW) {
                    if (cur) lines.push(cur);
                    cur = w;
                  } else cur = test;
                }
                if (cur) lines.push(cur);
                return lines;
              };
              const sanitize = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u0100-\u017F]/g, '');
              for (const p of paragraphs) {
                const lines = wrap(sanitize(p));
                for (const ln of lines) {
                  if (yy < margin) {
                    page = merged.addPage([pageW, pageH]);
                    yy = pageH - margin;
                  }
                  try { page.drawText(ln, { x: margin, y: yy, size: fontSize, font: helvReg, color: rgb(0.1,0.1,0.1) }); } catch {}
                  yy -= lineH;
                }
                yy -= 4;
              }
            }
          } catch (err) {
            console.warn('Falha ao converter office', f.file_name, err);
            cover.drawText('Não foi possível extrair o conteúdo deste documento.', { x: 24, y: 700, size: 10, font: helv, color: rgb(0.5,0.1,0.1) });
          }
        } else {
          cover.drawText('Formato não suportado para visualização (Word/Excel/outros).', { x: 24, y: 700, size: 10, font: helv, color: rgb(0.5,0.1,0.1) });
          cover.drawText('O arquivo permanece disponível no sistema.', { x: 24, y: 685, size: 10, font: helv, color: rgb(0.3,0.3,0.3) });
        }
      } catch (e) {
        console.warn('Falha ao anexar', f.file_name, e);
      }
    }

    if (added > 0) {
      const out = await merged.save();
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = baseName; a.click();
      URL.revokeObjectURL(url);
      return;
    }
  }

  doc.save(baseName);
}