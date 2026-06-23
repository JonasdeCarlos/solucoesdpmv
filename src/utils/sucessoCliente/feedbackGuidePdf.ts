import jsPDF from 'jspdf';
import { loadBranding } from './perfilPdf';

export async function generateFeedbackGuidePdf(params: {
  empresa: string;
  link: string;
}) {
  const { empresa, link } = params;
  const branding = await loadBranding();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primary = branding?.primary_color || '#628E3F';
  const hex = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)] as [number,number,number];
  const [pr,pg,pb] = hex(primary);

  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,90,'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(img, 'PNG', 20, 18, 55, 55);
    } catch {}
  }
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.text('Ferramenta de Feedback ao Colaborador', 90, 45);
  doc.setFontSize(11); doc.text(`Empresa: ${empresa}`, 90, 68);

  let y = 120;
  doc.setTextColor(0,0,0);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Olá! Esta é a sua ferramenta exclusiva de Feedback e Alinhamento.', 40, y); y += 22;

  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  const intro = [
    'Disponibilizamos uma ferramenta on-line, com inteligência artificial, para apoiar a comunicação',
    'entre gestores e colaboradores. Em poucos cliques você pode:',
  ];
  intro.forEach(l => { doc.text(l, 40, y); y += 16; });
  y += 6;

  const bullets = [
    '• Registrar pontos fortes e pontos a melhorar e gerar um FEEDBACK profissional automaticamente.',
    '• Emitir um ALINHAMENTO/COBRANÇA com 3 níveis de tom (Leve, Médio ou Cobrança formal).',
    '• Editar o texto sugerido pela IA antes de salvar.',
    '• Compartilhar com gestor/diretor por link exclusivo.',
    '• Gerar PDF com espaço de assinatura para colaborador e gestor.',
    '• Histórico completo dos registros realizados.',
  ];
  bullets.forEach(b => { const lines = doc.splitTextToSize(b, W - 80); lines.forEach((ln: string) => { doc.text(ln, 50, y); y += 15; }); });

  y += 10;
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('Segurança e responsabilidade', 40, y); y += 18;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const seg = doc.splitTextToSize(
    'A IA foi treinada com regras de comunicação não-violenta e salvaguardas para evitar riscos de assédio moral. Ainda assim, recomendamos sempre revisar o texto antes de compartilhar.',
    W - 80
  );
  seg.forEach((ln: string) => { doc.text(ln, 40, y); y += 14; });

  y += 18;
  doc.setFillColor(245, 247, 240);
  doc.rect(40, y, W - 80, 90, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(pr,pg,pb);
  doc.text('Acesse agora a sua ferramenta:', 56, y + 26);
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Clique no link abaixo (ou copie e cole no navegador):', 56, y + 46);
  doc.setTextColor(20, 60, 160); doc.setFont('helvetica','bold');
  const linkLines = doc.splitTextToSize(link, W - 120);
  let ly = y + 66;
  linkLines.forEach((ln: string) => { doc.textWithLink(ln, 56, ly, { url: link }); ly += 14; });

  y = ly + 30;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,120,120);
  doc.text(
    'Mantenha este link em local seguro — ele dá acesso exclusivo à ferramenta da sua empresa.',
    40, y
  );

  doc.setFontSize(8);
  doc.text(`${branding?.office_name || 'Sucesso do Cliente — DP'} • Gerado em ${new Date().toLocaleString('pt-BR')}`, 40, H - 30);

  doc.save(`ferramenta-feedback-${empresa.replace(/\s+/g,'_')}.pdf`);
}