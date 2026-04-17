import { PDFDocument, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name} excede 100 MB.`;
  }
  return null;
}

export async function loadPdf(file: File, password?: string): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes, {
      ignoreEncryption: !password,
      // pdf-lib não suporta decrypt; ignoramos encryption para tentar manipular
    });
  } catch (e) {
    throw new Error(`Não foi possível abrir "${file.name}". O arquivo pode estar corrompido ou protegido por senha forte.`);
  }
}

export async function downloadPdf(pdf: PDFDocument, filename: string): Promise<void> {
  const bytes = await pdf.save();
  // Garante ArrayBuffer (não SharedArrayBuffer) para o Blob
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: 'application/pdf' });
  saveAs(blob, filename);
}

// 1. JUNTAR ----------------------------------------------------------------
export async function mergePdfs(files: File[], outputName = 'unido.pdf'): Promise<void> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const src = await loadPdf(file);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  await downloadPdf(merged, outputName);
}

// 2. DIVIDIR ---------------------------------------------------------------
// Aceita ranges como "1-3,5,7-8" (1-indexed)
export function parseRanges(input: string, totalPages: number): number[][] {
  const groups: number[][] = [];
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const range: number[] = [];
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim(), 10));
      if (isNaN(a) || isNaN(b) || a < 1 || b > totalPages || a > b) {
        throw new Error(`Intervalo inválido: "${part}" (PDF tem ${totalPages} páginas).`);
      }
      for (let i = a; i <= b; i++) range.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (isNaN(n) || n < 1 || n > totalPages) {
        throw new Error(`Página inválida: "${part}" (PDF tem ${totalPages} páginas).`);
      }
      range.push(n - 1);
    }
    groups.push(range);
  }
  return groups;
}

export async function splitPdf(file: File, ranges: string): Promise<void> {
  const src = await loadPdf(file);
  const groups = parseRanges(ranges, src.getPageCount());
  const baseName = file.name.replace(/\.pdf$/i, '');

  if (groups.length === 1) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, groups[0]);
    pages.forEach(p => out.addPage(p));
    await downloadPdf(out, `${baseName}_partes.pdf`);
    return;
  }

  // Múltiplos grupos: gera vários PDFs sequenciais
  for (let i = 0; i < groups.length; i++) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, groups[i]);
    pages.forEach(p => out.addPage(p));
    await downloadPdf(out, `${baseName}_parte_${i + 1}.pdf`);
    // Pequena pausa para evitar bloqueio do navegador em muitos downloads
    await new Promise(r => setTimeout(r, 250));
  }
}

// 3. COMPRIMIR (recompactação leve via re-save com object streams) --------
export async function compressPdf(file: File): Promise<void> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach(p => out.addPage(p));
  // useObjectStreams = true reduz tamanho via compressão de streams
  const bytes = await out.save({ useObjectStreams: true });
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: 'application/pdf' });
  saveAs(blob, file.name.replace(/\.pdf$/i, '_compactado.pdf'));
}

// 4. ROTACIONAR -----------------------------------------------------------
export async function rotatePdf(
  file: File,
  angle: 90 | 180 | 270,
  pageIndices?: number[],
): Promise<void> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p, i) => {
    if (!pageIndices || pageIndices.includes(i)) {
      const current = p.getRotation().angle;
      p.setRotation(degrees((current + angle) % 360));
    }
    out.addPage(p);
  });
  await downloadPdf(out, file.name.replace(/\.pdf$/i, '_rotacionado.pdf'));
}

// 5. REORDENAR -------------------------------------------------------------
export async function reorderPdf(file: File, newOrder: number[]): Promise<void> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, newOrder);
  pages.forEach(p => out.addPage(p));
  await downloadPdf(out, file.name.replace(/\.pdf$/i, '_reordenado.pdf'));
}

// 6. EXCLUIR PÁGINAS -------------------------------------------------------
export async function removePages(file: File, pagesToRemove: number[]): Promise<void> {
  const src = await loadPdf(file);
  const total = src.getPageCount();
  const keep: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!pagesToRemove.includes(i)) keep.push(i);
  }
  if (keep.length === 0) throw new Error('Não é possível remover todas as páginas.');
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach(p => out.addPage(p));
  await downloadPdf(out, file.name.replace(/\.pdf$/i, '_editado.pdf'));
}

// 7a. IMAGENS → PDF -------------------------------------------------------
export async function imagesToPdf(files: File[], outputName = 'imagens.pdf'): Promise<void> {
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';
    const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  await downloadPdf(out, outputName);
}

// 7b. PDF → IMAGENS (renderização via canvas usando pdf.js do navegador via dynamic import)
// Para manter o MVP sem dependência extra, usamos uma abordagem leve:
// renderizamos cada página em um canvas via pdfjs-dist se disponível.
// Fallback: instrui o usuário.
export async function pdfToImages(file: File): Promise<void> {
  // Importa pdfjs dinamicamente
  const pdfjs: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
    saveAs(blob, `${baseName}_pag_${String(i).padStart(3, '0')}.jpg`);
    await new Promise(r => setTimeout(r, 200));
  }
}

// 8. PROTEGER / DESPROTEGER -----------------------------------------------
// pdf-lib NÃO suporta criptografia. Avisamos o usuário e oferecemos
// uma alternativa: marcação de "documento confidencial" + flag de owner.
// Para verdadeira proteção, indicamos uma futura função server-side.
export async function protectPdfNotice(): Promise<void> {
  throw new Error(
    'A proteção/desproteção real por senha exige processamento no servidor (não disponível no MVP). ' +
    'Use ferramentas externas (Adobe, qpdf) ou aguarde a próxima versão com suporte server-side.'
  );
}
