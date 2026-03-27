import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface CapaParams {
  employeeName: string;
  terminationDate: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
}

/**
 * Carrega uma imagem como base64 data URL.
 * Usa import dinâmico para o logo.
 */
async function loadLogoBase64(): Promise<string> {
  try {
    const mod = await import('@/assets/logo-monte-verde.png');
    const url = mod.default;
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/** Gera um PDF de 1 página (capa) conforme modelo Monte Verde */
export async function gerarCapaRescisao(params: CapaParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 15; // margem horizontal
  const textW = pw - mx * 2;

  let y = 15;

  // Logo
  try {
    const logoData = await loadLogoBase64();
    if (logoData) {
      doc.addImage(logoData, 'PNG', pw / 2 - 25, y, 50, 18);
    }
  } catch { /* sem logo */ }
  y += 25;

  // "MONTEVERDE" title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 120, 60); // verde
  doc.text('MONTEVERDE', pw / 2, y, { align: 'center' });
  y += 10;

  // Greeting
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Prezado(a) Cliente, tudo bem?', mx, y);
  y += 6;
  doc.text('Finalizamos a Rescisão solicitada.', mx, y);
  y += 10;

  // Data table
  const tableData = [
    ['EMPREGADO:', params.employeeName.toUpperCase()],
    ['DATA RESCISÃO:', formatDateBR(params.terminationDate)],
    ['DATA LIMITE DE PAGAMENTO:', formatDateBR(params.paymentDateFinal)],
  ];

  doc.setFontSize(9);
  const colW1 = 60;
  const colW2 = textW - colW1;
  const rowH = 8;

  for (const [label, value] of tableData) {
    // Cell borders
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(mx, y - 5.5, colW1, rowH);
    doc.rect(mx + colW1, y - 5.5, colW2, rowH);

    doc.setFont('helvetica', 'bold');
    doc.text(label, mx + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, mx + colW1 + 2, y);
    y += rowH;
  }

  y += 6;

  // Instructional text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Se atente para as instruções a seguir:', mx, y);
  y += 8;

  const sections = [
    {
      title: 'AVISO PRÉVIO',
      text: 'Deve ser assinado em 2 vias sendo 1 via para o EMPREGADOR e 1 via para o EMPREGADO (se demissão sem justa causa ou por justa causa).',
    },
    {
      title: 'RECIBO E TERMO DE QUITAÇÃO DA RESCISÃO',
      text: 'Deve ser assinado em 4 vias, sendo 2 vias para o EMPREGADOR e 2 vias para o EMPREGADO.',
    },
    {
      title: 'REQUERIMENTO DO SEGURO DESEMPREGO (SE HOUVER)',
      text: 'Coletar assinatura na parte inferior, preencher com a data da assinatura e destacar para arquivo e comprovação de fornecimento. Observar linha pontilhada.',
    },
    {
      title: 'PEDIDO DE ASO (SE HOUVER)',
      text: 'Imprimir em 2 vias e colher assinatura em 1 das vias como comprovação de entrega (reter).',
    },
    {
      title: 'RECOLHIMENTO RESCISÓRIO FGTS (SE HOUVER)',
      text: 'Realizar recolhimento, se atentar para a data de vencimento.',
    },
    {
      title: 'FOLHA DE PONTO (SE HOUVER)',
      text: 'Documento para conferência.',
    },
  ];

  for (const s of sections) {
    // Green bullet / title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 120, 60);
    doc.text(`■ ${s.title}`, mx, y);
    y += 5;

    // Body text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(`• ${s.text}`, textW - 5);
    doc.text(lines, mx + 3, y);
    y += lines.length * 4.5 + 3;

    if (y > ph - 50) break; // safety
  }

  // Closing
  y += 4;
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Caso tenha alguma dúvida estaremos à disposição, não deixe de nos contatar.', mx, y);
  y += 8;
  doc.text('Atenciosamente,', mx, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Departamento Pessoal', mx, y);

  // Footer
  y = ph - 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, mx, y);
  if (params.checkedBy) {
    doc.text(`Conferido por: ${params.checkedBy}`, pw - mx, y, { align: 'right' });
  }

  return doc;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return format(d, 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Converte um arquivo de imagem (JPG/PNG) em uma página PDF (A4).
 */
export async function imageToPdfArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const img = new Image();
        img.onload = () => {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pw = doc.internal.pageSize.getWidth();
          const ph = doc.internal.pageSize.getHeight();
          const margin = 10;
          const maxW = pw - margin * 2;
          const maxH = ph - margin * 2;

          let w = img.width;
          let h = img.height;
          const ratio = Math.min(maxW / (w * 0.264583), maxH / (h * 0.264583));
          const wMm = w * 0.264583 * ratio;
          const hMm = h * 0.264583 * ratio;

          const x = (pw - wMm) / 2;
          const y = (ph - hMm) / 2;

          const ext = file.type.includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(reader.result as string, ext, x, y, wMm, hMm);
          resolve(doc.output('arraybuffer'));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
