import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { getRescisaoTipoConfig, type RescisaoTipoId, type RescisaoDocLinha } from './rescisaoTipos';

interface CapaParams {
  employeeName: string;
  terminationDate: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
  rescisaoTipo?: RescisaoTipoId;
  uploadedDocs?: { categoria: string; nome: string; viasEmpregado?: string; viasEmpregador?: string }[];
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

  const tipoCfg = getRescisaoTipoConfig(params.rescisaoTipo ?? 'sem_justa_causa');

  // Tabela de dados
  const tableData = [
    ['EMPREGADO:', params.employeeName.toUpperCase()],
    ['TIPO DE RESCISÃO:', tipoCfg.label.toUpperCase()],
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

  y += 6;

  const greenColor: [number, number, number] = [98, 142, 63]; // #628E3F

  // === Apenas os documentos efetivamente enviados no dossiê ===
  const uploaded = params.uploadedDocs ?? [];
  const rows: RescisaoDocLinha[] = uploaded.length
    ? uploaded.map(u => {
        const match = tipoCfg.documentos.find(d =>
          d.documento.toLowerCase().includes(u.categoria.toLowerCase()) ||
          u.categoria.toLowerCase().includes(d.documento.toLowerCase().split('/')[0].toLowerCase())
        );
        return {
          documento: u.categoria,
          empregado: u.viasEmpregado?.trim() || match?.empregado || '1 via',
          empregador: u.viasEmpregador?.trim() || match?.empregador || '1 via',
          observacoes: u.nome,
        };
      })
    : tipoCfg.documentos;
  y = renderDocsTable(doc, {
    title: `${tipoCfg.label.toUpperCase()} — DOCUMENTOS DO DOSSIÊ`,
    rows,
    startY: y,
    mx,
    textW,
    ph,
    greenColor,
  });

  // Fechamento
  y = Math.max(y + 5, ph - 50);
  if (y > ph - 35) {
    doc.addPage();
    y = 20;
  }
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

interface RenderDocsTableArgs {
  title: string;
  rows: RescisaoDocLinha[];
  startY: number;
  mx: number;
  textW: number;
  ph: number;
  greenColor: [number, number, number];
}

/** Renderiza uma tabela de documentos x vias e retorna o novo Y. */
function renderDocsTable(doc: jsPDF, args: RenderDocsTableArgs): number {
  const { title, rows, mx, textW, ph, greenColor } = args;
  let y = args.startY;

  // Quebra de página se faltar espaço para título + cabeçalho + 1 linha
  if (y > ph - 40) {
    doc.addPage();
    y = 20;
  }

  // Título da seção
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setFillColor(...greenColor);
  doc.rect(mx, y - 3, 3, 3, 'F');
  doc.setTextColor(...greenColor);
  doc.text(title, mx + 5, y);
  y += 4;

  // Larguras de coluna
  const cDoc = textW * 0.40;
  const cEmp = textW * 0.13;
  const cEmpd = textW * 0.13;
  const cObs = textW - cDoc - cEmp - cEmpd;
  const headerH = 7;
  const rowH = 6;

  // Cabeçalho
  doc.setFillColor(...greenColor);
  doc.rect(mx, y, textW, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DOCUMENTO', mx + 2, y + 4.8);
  doc.text('EMPREGADO', mx + cDoc + cEmp / 2, y + 4.8, { align: 'center' });
  doc.text('EMPREGADOR', mx + cDoc + cEmp + cEmpd / 2, y + 4.8, { align: 'center' });
  doc.text('OBSERVAÇÕES', mx + cDoc + cEmp + cEmpd + 2, y + 4.8);
  y += headerH;

  // Linhas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);

  rows.forEach((r, idx) => {
    // Quebra de página entre linhas se necessário
    if (y + rowH > ph - 50) {
      doc.addPage();
      y = 20;
    }

    // Wrap das colunas que podem exceder
    const docLines = doc.splitTextToSize(r.documento, cDoc - 4);
    const obsLines = doc.splitTextToSize(r.observacoes ?? '', cObs - 4);
    const linhas = Math.max(docLines.length, obsLines.length, 1);
    const h = Math.max(rowH, linhas * 3.6 + 2);

    // Zebra
    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 240);
      doc.rect(mx, y, textW, h, 'F');
    }

    // Bordas
    doc.rect(mx, y, cDoc, h);
    doc.rect(mx + cDoc, y, cEmp, h);
    doc.rect(mx + cDoc + cEmp, y, cEmpd, h);
    doc.rect(mx + cDoc + cEmp + cEmpd, y, cObs, h);

    doc.setTextColor(57, 52, 33);
    doc.text(docLines, mx + 2, y + 4);
    doc.text(r.empregado, mx + cDoc + cEmp / 2, y + 4, { align: 'center' });
    doc.text(r.empregador, mx + cDoc + cEmp + cEmpd / 2, y + 4, { align: 'center' });
    if (obsLines.length) {
      doc.setTextColor(100, 100, 100);
      doc.text(obsLines, mx + cDoc + cEmp + cEmpd + 2, y + 4);
    }

    y += h;
  });

  return y;
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
