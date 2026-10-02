// Lê a camada de texto de PDFs digitais (nomes e valores exatos) e gera imagens
// das páginas já "em pé", corrigindo páginas giradas (retrato com conteúdo em paisagem).

async function loadPdfjs() {
  const pdfjs: any = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

export interface PaginaPdf { texto: string; imagem: string; giro: number }

/** Ângulo dominante do texto na página (0, 90, 180, 270). */
function anguloDominante(items: any[]): number {
  const cont: Record<number, number> = { 0: 0, 90: 0, 180: 0, 270: 0 };
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const [a, b] = it.transform;
    let ang = Math.round((Math.atan2(b, a) * 180) / Math.PI / 90) * 90;
    ang = ((ang % 360) + 360) % 360;
    cont[ang] += it.str.length;
  }
  return Number(Object.entries(cont).sort((x, y) => y[1] - x[1])[0][0]);
}

/** Monta linhas de texto (células separadas por " | ") a partir dos itens, já desfazendo a rotação. */
function montarLinhas(items: any[], ang: number): string {
  const rad = (-ang * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const pts = items.filter((it) => it.str?.trim()).map((it) => {
    const x0 = it.transform[4], y0 = it.transform[5];
    const h = Math.hypot(it.transform[2], it.transform[3]) || 8;
    return { x: x0 * cos - y0 * sin, y: x0 * sin + y0 * cos, w: it.width || it.str.length * h * 0.5, h, s: it.str.trim() };
  });
  pts.sort((p, q) => q.y - p.y || p.x - q.x);
  const linhas: (typeof pts)[] = [];
  for (const p of pts) {
    const l = linhas[linhas.length - 1];
    if (l && Math.abs(l[0].y - p.y) < Math.max(3, p.h * 0.45)) l.push(p);
    else linhas.push([p]);
  }
  return linhas.map((l) => {
    l.sort((p, q) => p.x - q.x);
    let out = '', fim = -Infinity;
    for (const p of l) {
      if (out) out += p.x - fim > p.h * 1.2 ? ' | ' : ' ';
      out += p.s; fim = p.x + p.w;
    }
    return out;
  }).join('\n');
}

/** Texto extraído é utilizável? (evita PDFs com fontes sem mapeamento, que geram lixo) */
export function textoConfiavel(t: string): boolean {
  const limpo = t.replace(/\s|\|/g, '');
  if (limpo.length < 80) return false;
  const bons = (limpo.match(/[A-Za-zÀ-ÿ0-9.,:\/()%$-]/g) || []).length;
  const palavras = t.match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || [];
  const comVogal = palavras.filter((w) => /[aeiouáéíóúâêôãõAEIOUÁÉÍÓÚÂÊÔÃÕ]/.test(w)).length;
  return bons / limpo.length > 0.9 && palavras.length >= 5 && comVogal / palavras.length > 0.8;
}

export async function lerPdf(file: File, maxPaginas = 8, comImagem = true): Promise<PaginaPdf[]> {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: PaginaPdf[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPaginas); i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // ângulo do texto em relação ao espaço do usuário (sem /Rotate)
    const ang = anguloDominante(tc.items);
    const texto = montarLinhas(tc.items, ang);
    // texto a `ang` graus (anti-horário) no espaço do PDF → girar a vista `ang` graus no sentido horário
    // (rotação do pdfjs é horária e substitui o /Rotate da página), deixando o texto em pé.
    const giro = ang % 360;
    if (!comImagem) { out.push({ texto, imagem: '', giro }); continue; }
    const base = page.getViewport({ scale: 1, rotation: giro });
    const scale = Math.min(2.2, 2400 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale, rotation: giro });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    out.push({ texto, imagem: canvas.toDataURL('image/jpeg', 0.9), giro });
  }
  return out;
}
