import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';

const NIVEL_LABEL: Record<string, string> = {
  operacional: 'Operacional', tecnico: 'Técnico', analista: 'Analista',
  especialista: 'Especialista', gestao: 'Gestão', diretoria: 'Diretoria',
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as [number, number, number];
const brl = (n: any) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function generateCargoDetalhePdf(params: { cargo: any; empresa?: string }) {
  const { cargo, empresa } = params;
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#393421';
  const [pr, pg, pb] = hex(primary);
  const [sr, sg, sb] = hex(secondary);

  // Header
  doc.setFillColor(pr, pg, pb); doc.rect(0, 0, W, 90, 'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(img, 'PNG', 20, 18, 55, 55);
    } catch {}
  }
  doc.setTextColor(255, 255, 255); doc.setFontSize(16);
  doc.text('Descrição de Cargo', 90, 38);
  doc.setFontSize(10);
  if (empresa) doc.text(`Empresa: ${empresa}`, 90, 56);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 90, 72);

  let y = 110;
  doc.setTextColor(0, 0, 0);

  const ensure = (h: number) => { if (y + h > 790) { doc.addPage(); y = 40; } };
  const section = (title: string) => {
    ensure(30);
    doc.setFillColor(pr, pg, pb); doc.rect(20, y, W - 40, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(title, 26, y + 14);
    y += 28; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  };
  const kv = (k: string, v: any) => {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
    ensure(14);
    doc.setFont('helvetica', 'bold'); doc.text(k + ':', 26, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(v), W - 180);
    doc.text(lines, 150, y);
    y += Math.max(12, lines.length * 12);
  };
  const para = (txt: string) => {
    const lines = doc.splitTextToSize(txt, W - 52);
    for (const ln of lines) { ensure(14); doc.text(ln, 26, y); y += 12; }
    y += 4;
  };

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(cargo.nome || '—', 20, y); y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);

  section('Identificação');
  kv('Nome do cargo', cargo.nome);
  kv('CBO', cargo.cbo);
  kv('Área / Departamento', cargo.area);
  kv('Nível', NIVEL_LABEL[cargo.nivel] || cargo.nivel);

  section('Remuneração');
  kv('Salário atual', cargo.salario_atual ? brl(cargo.salario_atual) : null);
  kv('Piso salarial (CCT)', cargo.piso_salarial ? brl(cargo.piso_salarial) : null);
  kv('Referência do piso', cargo.piso_referencia);

  if (cargo.descricao_sumaria) {
    section('Descrição sumária');
    para(String(cargo.descricao_sumaria));
  }

  const ativs: string[] = Array.isArray(cargo.atividades) ? cargo.atividades : [];
  if (ativs.length) {
    section('Atividades');
    for (const a of ativs) para(`• ${a}`);
  }

  const req = cargo.requisitos || {};
  if (req.escolaridade || req.experiencia || (req.competencias?.length)) {
    section('Requisitos');
    kv('Escolaridade', req.escolaridade);
    kv('Experiência', req.experiencia);
    if (req.competencias?.length) kv('Competências', req.competencias.join(', '));
  }

  const ad = cargo.adequacao;
  if (ad) {
    section('Regulamentação');
    kv('Profissão regulamentada', ad.profissao_regulamentada ? 'Sim' : 'Não');
    kv('Base legal', ad.base_legal);
    if (ad.conselho_registro?.obrigatorio || ad.conselho_registro?.sigla) {
      kv('Conselho', `${ad.conselho_registro.sigla || ''}${ad.conselho_registro.descricao ? ' — ' + ad.conselho_registro.descricao : ''}`);
      kv('Registro obrigatório', ad.conselho_registro.obrigatorio ? 'Sim' : 'Não');
    }
    kv('Observações', ad.observacoes_regulamentacao);
    kv('Título CBO oficial', ad.titulo_cbo);
    const msg = ad.conselho_mensagem
      || (ad.conselho_registro?.obrigatorio
        ? `Este cargo EXIGE inscrição em ${ad.conselho_registro?.sigla || 'conselho de classe'}${ad.base_legal ? ' (' + ad.base_legal + ')' : ''}.`
        : 'Este cargo NÃO exige inscrição em conselho de classe.');
    ensure(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Inscrição em conselho de classe:', 26, y); y += 12;
    doc.setFont('helvetica', 'normal');
    para(String(msg));
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(sr, sg, sb); doc.rect(0, 815, W, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    const contact = [branding?.office_name, branding?.phone, branding?.email, branding?.site].filter(Boolean).join(' • ');
    doc.text(contact || 'Descrição de Cargo', W / 2, 832, { align: 'center' });
    doc.text(`${i}/${total}`, W - 20, 832, { align: 'right' });
  }

  const slug = (cargo.nome || 'cargo').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
  doc.save(`Cargo_${slug}.pdf`);
}