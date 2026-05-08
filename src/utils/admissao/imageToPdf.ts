import { PDFDocument } from 'pdf-lib';

const IMG_PAGE_WIDTH = 595.28; // A4
const IMG_PAGE_HEIGHT = 841.89;
const MARGIN = 24;

async function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

async function heicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default as (opts: any) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

async function pngToJpeg(buf: ArrayBuffer): Promise<ArrayBuffer> {
  // Use canvas to convert PNG/WebP to JPG so pdf-lib can embed via embedJpg fallback if needed.
  return buf;
}

export function getExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

/**
 * Converts a file (image or pdf) into a list of PDF page bytes (single PDF).
 * Returns Uint8Array of a PDF doc, or null if format not supported.
 */
export async function fileToPdfBytes(file: File): Promise<Uint8Array | null> {
  const ext = getExt(file.name);
  const mime = file.type.toLowerCase();

  // Already PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    const buf = await fileToArrayBuffer(file);
    return new Uint8Array(buf);
  }

  // HEIC -> JPEG first
  let imgBuf: ArrayBuffer | null = null;
  let isPng = false;

  if (ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif') {
    const jpeg = await heicToJpeg(file);
    imgBuf = await jpeg.arrayBuffer();
  } else if (ext === 'webp' || mime === 'image/webp') {
    // Convert WebP to JPEG via canvas
    imgBuf = await convertViaCanvas(file, 'image/jpeg');
  } else if (ext === 'png' || mime === 'image/png') {
    imgBuf = await fileToArrayBuffer(file);
    isPng = true;
  } else if (ext === 'jpg' || ext === 'jpeg' || mime === 'image/jpeg' || mime === 'image/jpg') {
    imgBuf = await fileToArrayBuffer(file);
  } else {
    return null;
  }

  const pdfDoc = await PDFDocument.create();
  const img = isPng ? await pdfDoc.embedPng(imgBuf!) : await pdfDoc.embedJpg(imgBuf!);
  const page = pdfDoc.addPage([IMG_PAGE_WIDTH, IMG_PAGE_HEIGHT]);
  const maxW = IMG_PAGE_WIDTH - MARGIN * 2;
  const maxH = IMG_PAGE_HEIGHT - MARGIN * 2;
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  page.drawImage(img, {
    x: (IMG_PAGE_WIDTH - w) / 2,
    y: (IMG_PAGE_HEIGHT - h) / 2,
    width: w,
    height: h,
  });
  return await pdfDoc.save();
}

async function convertViaCanvas(file: File, type: 'image/jpeg'): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), type, 0.92)
    );
    return await blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}