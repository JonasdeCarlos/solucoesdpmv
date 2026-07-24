import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import capaAsset from '@/assets/capa-pcs.pdf.asset.json';

const BG = rgb(239 / 255, 246 / 255, 234 / 255);
const INK = rgb(57 / 255, 52 / 255, 33 / 255);

/** Próximo número de revisão do PCS para a empresa (00, 01, 02...) */
export function nextPcsRevision(empresa: string): string {
  const key = `pcs_rev_${empresa.toLowerCase().replace(/\s+/g, '_')}`;
  let n = 0;
  try {
    n = parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    localStorage.setItem(key, String(n + 1));
  } catch { n = 0; }
  return String(n).padStart(2, '0');
}

/**
 * Carrega a capa oficial (Manual de ID) e preenche apenas
 * Empresa, Competência (Mês/Ano) e Revisão.
 */
export async function buildPcsCapa(empresa: string, revisao: string): Promise<Uint8Array> {
  const bytes = await fetch(capaAsset.url).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[0];
  const H = page.getHeight();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Limpa os placeholders
  const clear = (x: number, w: number) => page.drawRectangle({ x, y: H - 694, width: w, height: 17, color: BG });
  clear(52, 128);   // [Nome da Empresa]
  clear(196, 84);   // [Mês / Ano]
  clear(462, 42);   // 00

  const centered = (text: string, cx: number, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - w / 2, y: H - 690, size, font, color: INK });
  };

  const competencia = new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase())
    .replace(' de ', ' / ');

  // Nome da empresa: reduz a fonte para caber na célula
  let nome = (empresa || '—').trim();
  let size = 9;
  while (font.widthOfTextAtSize(nome, size) > 120 && size > 5.5) size -= 0.25;
  if (font.widthOfTextAtSize(nome, size) > 120) {
    while (nome.length > 4 && font.widthOfTextAtSize(nome + '…', size) > 120) nome = nome.slice(0, -1);
    nome += '…';
  }
  centered(nome, 112.5, size);
  centered(competencia, 236, 9);
  centered(revisao, 482.5, 9);

  return await pdf.save();
}

/** Prepende a capa oficial ao corpo gerado pelo jsPDF. */
export async function withPcsCapa(bodyBytes: ArrayBuffer, empresa: string, revisao: string): Promise<Blob> {
  const capa = await buildPcsCapa(empresa, revisao);
  const out = await PDFDocument.load(capa);
  const body = await PDFDocument.load(bodyBytes);
  const pages = await out.copyPages(body, body.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  const merged = await out.save();
  return new Blob([merged as unknown as BlobPart], { type: 'application/pdf' });
}
