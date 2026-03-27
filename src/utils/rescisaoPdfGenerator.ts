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

/** Carrega logo como base64 a partir do public folder */
async function loadLogoBase64(): Promise<string> {
  try {
    const resp = await fetch('/images/logo-monte-verde-pdf.png');
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

/** Gera um PDF de 1 página (capa) conforme modelo Monte Verde Contabilidade */
export async function gerarCapaRescisao(params: CapaParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 18;
  const textW = pw - mx * 2;

  let y = 12;

  // Logo — proporcional e centralizado
  try {
    const logoData = await loadLogoBase64();
    if (logoData) {
      // Logo original é mais larga que alta; usar proporção adequada
      const logoW = 70;
      const logoH = 35;
      doc.addImage(logoData, 'PNG', (pw - logoW) / 2, y, logoW, logoH);
      y += logoH + 5;
    }
  } catch {
    y += 15;
  }

  // Saudação
  doc.setTextColor(57, 52, 33); // marrom escuro da identidade
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Prezado(a) Cliente, tudo bem?', mx, y);
  y += 6;
  doc.text('Finalizamos a Rescisão solicitada.', mx, y);
  y += 10;

  // Tabela de dados
  const tableData = [
    ['EMPREGADO:', params.employeeName.toUpperCase()],
    ['DATA RESCISÃO:', formatDateBR(params.terminationDate)],
    ['DATA LIMITE DE PAGAMENTO:', formatDateBR(params.paymentDateFinal)],
  ];

  doc.setFontSize(9);
  const colW1 = 62;
  const colW2 = textW - colW1;
  const rowH = 8;

  for (const [label, value] of tableData) {
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(mx, y - 5.5, colW1, rowH);
    doc.rect(mx + colW1, y - 5.5, colW2, rowH);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(57, 52, 33);
    doc.text(label, mx + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, mx + colW1 + 2, y);
    y += rowH;
  }

  y += 7;

  // Instruções
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(57, 52, 33);
  doc.text('Se atente para as instruções a seguir:', mx, y);
  y += 8;

  const greenColor: [number, number, number] = [98, 142, 63]; // #628E3F

  const sections = [
    {
      title: 'AVISO PRÉVIO',
      items: ['Deve ser assinado em 2 vias sendo 1 via para o EMPREGADOR e 1 via para o EMPREGADO (se demissão sem justa causa ou por justa causa).'],
    },
    {
      title: 'RECIBO E TERMO DE QUITAÇÃO DA RESCISÃO',
      items: ['Deve ser assinado em 4 vias, sendo 2 vias para o EMPREGADOR e 2 vias para o EMPREGADO.'],
    },
    {
      title: 'REQUERIMENTO DO SEGURO DESEMPREGO (SE HOUVER)',
      items: ['Coletar assinatura na parte inferior, preencher com a data da assinatura e destacar para arquivo e comprovação de fornecimento. Observar linha pontilhada.'],
    },
    {
      title: 'PEDIDO DE ASO (SE HOUVER)',
      items: ['Imprimir em 2 vias e colher assinatura em 1 das vias como comprovação de entrega (reter).'],
    },
    {
      title: 'RECOLHIMENTO RESCISÓRIO FGTS (SE HOUVER)',
      items: ['Realizar recolhimento, se atentar para a data de vencimento.'],
    },
    {
      title: 'FOLHA DE PONTO (SE HOUVER)',
      items: ['Documento para conferência.'],
    },
  ];

  for (const s of sections) {
    if (y > ph - 45) break;

    // Título da seção com marcador verde
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    // Desenhar marcador gráfico (quadrado verde)
    doc.setFillColor(...greenColor);
    doc.rect(mx, y - 3, 3, 3, 'F');

    doc.setTextColor(...greenColor);
    doc.text(s.title, mx + 5, y);
    y += 5;

    // Itens com dash
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    for (const item of s.items) {
      const lines = doc.splitTextToSize(`\u2013  ${item}`, textW - 8);
      doc.text(lines, mx + 5, y);
      y += lines.length * 4.2 + 2;
    }

    y += 2;
  }

  // Fechamento
  y = Math.max(y + 3, ph - 55);
  doc.setTextColor(57, 52, 33);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Caso tenha alguma dúvida estaremos à disposição, não deixe de nos contatar.', mx, y);
  y += 8;
  doc.text('Atenciosamente,', mx, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Departamento Pessoal', mx, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Monte Verde Contabilidade', mx, y);

  // Rodapé
  y = ph - 12;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140);
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

          const w = img.width;
          const h = img.height;
          const ratio = Math.min(maxW / (w * 0.264583), maxH / (h * 0.264583));
          const wMm = w * 0.264583 * ratio;
          const hMm = h * 0.264583 * ratio;

          const x = (pw - wMm) / 2;
          const yPos = (ph - hMm) / 2;

          const ext = file.type.includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(reader.result as string, ext, x, yPos, wMm, hMm);
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
