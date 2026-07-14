/**
 * Shared helper to render an office branding logo into a jsPDF document with:
 *  - correct aspect ratio (no stretching)
 *  - centered inside a max box (width/height)
 *  - re-encoded as compressed JPEG so PDFs stay small
 *
 * Solves the previous problem where PDFs were reaching 100+MB because the
 * original PNG logo (often several MB) was embedded raw and repeated on the
 * footer of every page.
 */

type LogoCacheEntry = { dataUrl: string; w: number; h: number; fmt: 'JPEG' | 'PNG' };
const cache = new Map<string, LogoCacheEntry>();

async function fetchAsDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then(r => r.blob());
  return await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('logo load failed'));
    im.src = src;
  });
}

/**
 * Prepare a compressed logo variant sized to fit within (maxWpx, maxHpx) pixels
 * (in canvas pixels, not PDF points). Result cached per URL+size.
 */
async function prepareLogo(url: string, maxWpx = 400, maxHpx = 400): Promise<LogoCacheEntry> {
  const key = `${url}::${maxWpx}x${maxHpx}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await fetchAsDataUrl(url);
  const img = await loadImg(raw);
  const aspect = img.naturalWidth / img.naturalHeight;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxWpx) { w = maxWpx; h = w / aspect; }
  if (h > maxHpx) { h = maxHpx; w = h * aspect; }
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas ctx');
  // White background so JPEG doesn't turn transparency black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

  const entry: LogoCacheEntry = { dataUrl, w, h, fmt: 'JPEG' };
  cache.set(key, entry);
  return entry;
}

/**
 * Draw the branding logo centered inside a (maxW × maxH) box at (x,y), in PDF units.
 * Returns the drawn width/height (0 if not drawn) so callers can position adjacent text.
 */
export async function drawBrandLogo(
  doc: any,
  url: string | undefined | null,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  opts?: { align?: 'left' | 'center'; centerY?: boolean }
): Promise<{ w: number; h: number }> {
  if (!url) return { w: 0, h: 0 };
  try {
    // Cap encoded pixel size at ~3× the max box in points → keeps files small
    // while remaining crisp on print.
    const pxCap = Math.max(120, Math.ceil(Math.max(maxW, maxH) * 3));
    const logo = await prepareLogo(url, pxCap, pxCap);
    const aspect = logo.w / logo.h;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) { drawH = maxH; drawW = drawH * aspect; }
    let dx = x;
    if (opts?.align === 'center') dx = x + (maxW - drawW) / 2;
    let dy = y;
    if (opts?.centerY) dy = y + (maxH - drawH) / 2;
    doc.addImage(logo.dataUrl, logo.fmt, dx, dy, drawW, drawH, undefined, 'FAST');
    return { w: drawW, h: drawH };
  } catch {
    return { w: 0, h: 0 };
  }
}