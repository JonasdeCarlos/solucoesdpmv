import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CapaParams {
  employeeName: string;
  terminationDate: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
}

/** Gera um PDF de 1 página (capa) com os dados da rescisão */
export function gerarCapaRescisao(params: CapaParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, pw - 20, ph - 20);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pw - 24, ph - 24);

  let y = 40;

  // Company header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  if (params.companyName) {
    doc.text(params.companyName.toUpperCase(), pw / 2, y, { align: 'center' });
    y += 7;
  }
  if (params.companyCnpj) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${params.companyCnpj}`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  // Divider
  y += 10;
  doc.setLineWidth(0.5);
  doc.line(30, y, pw - 30, y);
  y += 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSSIÊ DE RESCISÃO', pw / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Documentos Consolidados', pw / 2, y, { align: 'center' });
  y += 25;

  // Data fields
  const fields = [
    { label: 'Empregado:', value: params.employeeName },
    { label: 'Data da Rescisão:', value: formatDateBR(params.terminationDate) },
    { label: 'Data de Pagamento:', value: formatDateBR(params.paymentDateFinal) },
    { label: 'Competência:', value: params.competenceMonth || '' },
  ];

  doc.setFontSize(12);
  const labelX = 40;
  const valueX = 95;

  for (const f of fields) {
    doc.setFont('helvetica', 'bold');
    doc.text(f.label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.value, valueX, y);
    y += 9;
  }

  // Footer area
  y = ph - 70;
  doc.setLineWidth(0.3);
  doc.line(30, y, pw - 30, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pw / 2, y, { align: 'center' });
  y += 6;
  if (params.checkedBy) {
    doc.text(`Conferido por: ${params.checkedBy}`, pw / 2, y, { align: 'center' });
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
 * Retorna um ArrayBuffer do PDF resultante.
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
