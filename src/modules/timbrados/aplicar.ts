import { PDFDocument, degrees } from 'pdf-lib';
import {
  A4_W, A4_H, mmToPt, areaUtil, encaixar, origemRotacionada, bboxPixels, type Margens,
} from './geometria';

export type TipoArquivo = 'pdf' | 'png' | 'jpg';

export interface FundoTimbrado {
  bytes: ArrayBuffer;
  tipo: TipoArquivo;
}

export interface OpcoesAplicacao {
  fundo: FundoTimbrado;
  fundoPrimeira?: FundoTimbrado | null;
  margens: Margens;
  escalaMinima: number;
  alinhamento: 'topo' | 'centro';
  recorteSuperiorMm?: number;
  recorteInferiorMm?: number;
}

export interface InfoPagina {
  numero: number;
  escala: number | null; // null = página vazia (pulada)
  abaixoMinimo: boolean;
  paisagem: boolean;
}

export interface ResultadoArquivo {
  nome: string;
  original: File;
  bytes?: Uint8Array;
  paginas: InfoPagina[];
  erro?: string;
}

let pdfjsPromise: Promise<any> | null = null;
export function getPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs: any) => {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const SCAN_SCALE = 1.5;
const FOLGA_PT = mmToPt(2);

async function desenharFundo(out: PDFDocument, page: ReturnType<PDFDocument['addPage']>, fundo: FundoTimbrado, cache: Map<FundoTimbrado, any>) {
  let emb = cache.get(fundo);
  if (!emb) {
    if (fundo.tipo === 'pdf') {
      const [p] = await out.embedPdf(fundo.bytes, [0]);
      emb = { kind: 'pdf', obj: p };
    } else if (fundo.tipo === 'png') {
      emb = { kind: 'img', obj: await out.embedPng(fundo.bytes) };
    } else {
      emb = { kind: 'img', obj: await out.embedJpg(fundo.bytes) };
    }
    cache.set(fundo, emb);
  }
  if (emb.kind === 'pdf') {
    page.drawPage(emb.obj, { x: 0, y: 0, xScale: A4_W / emb.obj.width, yScale: A4_H / emb.obj.height });
  } else {
    page.drawImage(emb.obj, { x: 0, y: 0, width: A4_W, height: A4_H });
  }
}

function mensagemErro(e: any, nome: string): string {
  const msg = String(e?.message || e || '');
  if (e?.name === 'PasswordException' || /encrypt|password/i.test(msg)) {
    return `"${nome}" está protegido por senha. Remova a proteção (Central de PDF > Desbloquear) e envie novamente.`;
  }
  return `Não foi possível ler "${nome}". O arquivo pode estar corrompido ou não ser um PDF válido.`;
}

/** Aplica o timbrado em todas as páginas de um PDF, preservando o conteúdo vetorial. */
export async function aplicarTimbrado(file: File, op: OpcoesAplicacao): Promise<ResultadoArquivo> {
  const nome = file.name;
  const paginas: InfoPagina[] = [];
  try {
    const bytes = await file.arrayBuffer();
    const pdfjs = await getPdfjs();
    const jsDoc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(bytes);
    } catch (e: any) {
      if (/encrypt/i.test(String(e?.message))) {
        // Protegido apenas contra edição: o pdf.js abriu, então tentamos ignorar a criptografia.
        src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } else throw e;
    }
    const out = await PDFDocument.create();
    const cache = new Map<FundoTimbrado, any>();
    const area = areaUtil(op.margens);
    const srcPages = src.getPages();

    for (let i = 0; i < srcPages.length; i++) {
      const jsPage = await jsDoc.getPage(i + 1);
      const viewport = jsPage.getViewport({ scale: SCAN_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await jsPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pxPorMm = (SCAN_SCALE * 72) / 25.4;
      const yIni = (op.recorteSuperiorMm || 0) * pxPorMm;
      const yFim = canvas.height - (op.recorteInferiorMm || 0) * pxPorMm;
      const bb = bboxPixels(img.data, canvas.width, canvas.height, 245, yIni, yFim);
      const paisagem = viewport.width > viewport.height;
      canvas.width = 0; canvas.height = 0;
      jsPage.cleanup?.();

      if (!bb) {
        paginas.push({ numero: i + 1, escala: null, abaixoMinimo: false, paisagem });
        continue;
      }

      // Pixels (tela, eixo Y para baixo, já rotacionado) -> espaço do usuário PDF (eixo Y para cima)
      const [ax, ay] = viewport.convertToPdfPoint(bb.x0, bb.y0);
      const [bx, by] = viewport.convertToPdfPoint(bb.x1, bb.y1);
      const sp = srcPages[i];
      const mb = sp.getMediaBox();
      const left = Math.max(mb.x, Math.min(ax, bx) - FOLGA_PT);
      const right = Math.min(mb.x + mb.width, Math.max(ax, bx) + FOLGA_PT);
      const bottom = Math.max(mb.y, Math.min(ay, by) - FOLGA_PT);
      const top = Math.min(mb.y + mb.height, Math.max(ay, by) + FOLGA_PT);

      const embedded = await out.embedPage(sp, { left, bottom, right, top });
      const rot = ((sp.getRotation().angle % 360) + 360) % 360;
      const giro = rot === 90 || rot === 270;
      const dispW = giro ? embedded.height : embedded.width;
      const dispH = giro ? embedded.width : embedded.height;
      const fit = encaixar(dispW, dispH, area, op.alinhamento);

      const page = out.addPage([A4_W, A4_H]);
      const fundo = i === 0 && op.fundoPrimeira ? op.fundoPrimeira : op.fundo;
      await desenharFundo(out, page, fundo, cache);
      const o = origemRotacionada(rot, fit);
      page.drawPage(embedded, {
        x: o.x, y: o.y, xScale: fit.escala, yScale: fit.escala,
        ...(o.rotate ? { rotate: degrees(o.rotate) } : {}),
      });
      paginas.push({ numero: i + 1, escala: fit.escala, abaixoMinimo: fit.escala < op.escalaMinima, paisagem });
    }
    await jsDoc.destroy?.();
    if (out.getPageCount() === 0) {
      return { nome, original: file, paginas, erro: `"${nome}" não tem conteúdo visível em nenhuma página.` };
    }
    const outBytes = await out.save();
    return { nome, original: file, bytes: outBytes, paginas };
  } catch (e: any) {
    console.error('Timbrado:', e);
    return { nome, original: file, paginas, erro: mensagemErro(e, nome) };
  }
}

/** Renderiza uma página para imagem (somente pré-visualização). */
export async function renderizarPagina(data: ArrayBuffer | Uint8Array, numero: number, largura = 420): Promise<string | null> {
  const pdfjs = await getPdfjs();
  const copy = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  const doc = await pdfjs.getDocument({ data: copy }).promise;
  try {
    if (numero > doc.numPages) return null;
    const page = await doc.getPage(numero);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (largura * 2) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    await doc.destroy?.();
  }
}

export const toBlob = (b: Uint8Array) => {
  const ab = new ArrayBuffer(b.byteLength);
  new Uint8Array(ab).set(b);
  return new Blob([ab], { type: 'application/pdf' });
};
