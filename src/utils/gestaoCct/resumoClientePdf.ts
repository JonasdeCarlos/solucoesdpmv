import jsPDF from 'jspdf';
import { loadBranding } from '@/utils/sucessoCliente/perfilPdf';

const hexToRgb = (h: string): [number, number, number] => {
  const clean = (h || '').replace('#', '');
  const v = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
};

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const val = (v: any): string => {
  if (v == null) return '—';
  if (typeof v === 'string') return v.trim() || '—';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(val).filter((s) => s !== '—').join(', ') || '—';
  return '—';
};

export async function generateCctResumoClientePdf(params: {
  analysis: any;
  clientName?: string | null;
}) {
  const { analysis, clientName } = params;
  const branding = await loadBranding().catch(() => null);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#E1E8F2';
  const [pr, pg, pb] = hexToRgb(primary);
  const [sr, sg, sb] = hexToRgb(secondary);

  // Header
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 100, 'F');
  if (branding?.logo_url) {
    const img = await urlToDataUrl(branding.logo_url);
    if (img) {
      try { doc.addImage(img, 'PNG', 24, 22, 60, 60); } catch { /* ignore */ }
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Resumo da Convenção Coletiva', 100, 45);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(branding?.office_name || 'Departamento Pessoal', 100, 65);
  if (clientName) doc.text(`Cliente: ${clientName}`, 100, 82);

  let y = 128;
  const marginX = 40;
  const contentW = W - marginX * 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = 60;
    }
  };

  const sectionTitle = (label: string) => {
    ensureSpace(30);
    doc.setFillColor(sr, sg, sb);
    doc.rect(marginX, y - 14, contentW, 22, 'F');
    doc.setTextColor(pr, pg, pb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(label, marginX + 8, y);
    y += 18;
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
  };

  const line = (label: string, value: string) => {
    const wrapped = doc.splitTextToSize(value || '—', contentW - 140);
    ensureSpace(wrapped.length * 13 + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(wrapped, marginX + 130, y);
    y += wrapped.length * 13 + 4;
  };

  const paragraph = (text: string) => {
    const wrapped = doc.splitTextToSize(text, contentW);
    ensureSpace(wrapped.length * 13 + 4);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 13 + 4;
  };

  // Resumo executivo
  if (analysis.ai_summary) {
    sectionTitle('Resumo Executivo');
    paragraph(analysis.ai_summary);
    y += 6;
  }

  // Identificação
  const ident = analysis.identification || {};
  sectionTitle('Identificação');
  line('Título:', val(ident.titulo));
  line('Vigência:', `${val(ident.vigencia_inicial)}  a  ${val(ident.vigencia_final)}`);
  line('Data-base:', val(ident.data_base));
  if (ident.numero_registro) line('Registro MTE:', val(ident.numero_registro));
  y += 6;

  // Sindicatos
  const unions = analysis.unions || {};
  sectionTitle('Sindicatos');
  line('Laboral:', val(unions.sindicato_laboral));
  line('Patronal:', val(unions.sindicato_patronal));
  y += 6;

  // Base territorial
  const terr = analysis.territorial_base || {};
  sectionTitle('Base Territorial');
  line('UF:', val(terr.uf));
  line('Municípios:', val(terr.municipios));
  if (terr.descricao) line('Descrição:', val(terr.descricao));
  y += 6;

  // Cláusulas econômicas
  const econ = analysis.economic_clauses || {};
  sectionTitle('Cláusulas Econômicas');
  if (Array.isArray(econ.piso_salarial) && econ.piso_salarial.length > 0) {
    econ.piso_salarial.forEach((p: any) => line('Piso:', `${p.funcao || '—'} — ${p.valor || '—'}`));
  }
  if (econ.reajuste_percentual) line('Reajuste:', `${val(econ.reajuste_percentual)}${econ.reajuste_data ? ` (a partir de ${econ.reajuste_data})` : ''}`);
  if (econ.diferencas_retroativas) line('Retroativos:', val(econ.diferencas_retroativas));
  y += 6;

  // Benefícios
  const bens = Array.isArray(analysis?.benefits_summary?.beneficios) ? analysis.benefits_summary.beneficios : [];
  if (bens.length) {
    sectionTitle('Benefícios Obrigatórios');
    bens.forEach((b: any, i: number) => {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${b.nome || 'Benefício'}`, marginX, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      const parts: string[] = [];
      if (b.valor) parts.push(`Valor: ${b.valor}`);
      if (b.periodicidade) parts.push(`Periodicidade: ${b.periodicidade}`);
      if (b.prazo) parts.push(`Prazo: ${b.prazo}`);
      if (b.desconto_empregado) parts.push(`Desconto empregado: ${b.desconto_empregado}`);
      if (parts.length) {
        const wrapped = doc.splitTextToSize(parts.join('  ·  '), contentW - 12);
        ensureSpace(wrapped.length * 12 + 4);
        doc.text(wrapped, marginX + 12, y);
        y += wrapped.length * 12 + 2;
      }
      if (b.condicoes) {
        const w2 = doc.splitTextToSize(`Condições: ${b.condicoes}`, contentW - 12);
        ensureSpace(w2.length * 12 + 4);
        doc.text(w2, marginX + 12, y);
        y += w2.length * 12 + 4;
      }
      y += 4;
    });
  }

  // Jornada
  const jr = analysis.journey_rules || {};
  sectionTitle('Jornada');
  line('Semanal:', val(jr.semanal));
  line('Diária:', val(jr.diaria));
  if (jr.escalas) line('Escalas:', val(jr.escalas));
  if (jr.banco_horas) line('Banco de horas:', val(jr.banco_horas));
  y += 6;

  // Horas extras / adicionais
  const ot = analysis.overtime_rules || {};
  sectionTitle('Horas Extras e Adicionais');
  line('HE percentual:', val(ot.he_percentual));
  if (ot.he_domingos) line('HE domingos:', val(ot.he_domingos));
  if (ot.adicional_noturno) line('Ad. noturno:', val(ot.adicional_noturno));
  y += 6;

  // Pontos de atenção DP
  const dp = Array.isArray(analysis.dp_attention_points) ? analysis.dp_attention_points : [];
  if (dp.length) {
    sectionTitle('Pontos de Atenção para DP');
    dp.forEach((p: any) => {
      const text = typeof p === 'string' ? p : JSON.stringify(p);
      const wrapped = doc.splitTextToSize(`• ${text}`, contentW);
      ensureSpace(wrapped.length * 13 + 4);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 13 + 4;
    });
  }

  // Footer em todas as páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const emitted = new Date().toLocaleDateString('pt-BR');
    doc.text(`${branding?.office_name || ''}  ·  Emitido em ${emitted}`, marginX, H - 24);
    doc.text(`Página ${i} de ${pageCount}`, W - marginX, H - 24, { align: 'right' });
  }

  const fileName = `resumo-cct-${(analysis?.title || 'analise').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.pdf`;
  doc.save(fileName);
}