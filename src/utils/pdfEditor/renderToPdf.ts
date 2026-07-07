import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import type { Annotation } from './types';
import { STAMP_PRESETS } from './types';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h.padEnd(6, '0');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function stampColor(kind?: string, fallback = '#c62828'): string {
  return STAMP_PRESETS.find((s) => s.key === kind)?.color || fallback;
}

export async function renderAnnotationsToPdf(
  originalBytes: ArrayBuffer,
  annotations: Annotation[],
  outputName: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  const byPage = new Map<number, Annotation[]>();
  annotations.forEach((a) => {
    const arr = byPage.get(a.page) || [];
    arr.push(a);
    byPage.set(a.page, arr);
  });

  for (const [pageNum, list] of byPage) {
    const page = pages[pageNum - 1];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const nx = (n: number) => n * W;
    const ny = (n: number) => H - n * H; // top-origin normalized -> bottom-origin PDF
    const nw = (n: number) => n * W;
    const nh = (n: number) => n * H;
    const nSize = Math.min(W, H);

    for (const a of list) {
      const color = hexToRgb(a.color || '#e53935');
      const opacity = a.opacity ?? 0.8;
      const stroke = Math.max(0.6, (a.strokeWidth ?? 0.003) * nSize);

      switch (a.type) {
        case 'highlight': {
          if (a.x == null || a.y == null || a.w == null || a.h == null) break;
          page.drawRectangle({
            x: nx(a.x), y: ny(a.y + a.h),
            width: nw(a.w), height: nh(a.h),
            color, opacity: opacity * 0.45,
          });
          break;
        }
        case 'underline': {
          if (a.x == null || a.y == null || a.w == null || a.h == null) break;
          page.drawRectangle({
            x: nx(a.x), y: ny(a.y + a.h) - stroke / 2,
            width: nw(a.w), height: stroke,
            color, opacity,
          });
          break;
        }
        case 'strike': {
          if (a.x == null || a.y == null || a.w == null || a.h == null) break;
          page.drawRectangle({
            x: nx(a.x), y: ny(a.y + a.h / 2) - stroke / 2,
            width: nw(a.w), height: stroke,
            color, opacity,
          });
          break;
        }
        case 'rect': {
          if (a.x == null || a.y == null || a.w == null || a.h == null) break;
          const opts: any = {
            x: nx(a.x), y: ny(a.y + a.h),
            width: nw(a.w), height: nh(a.h),
            borderColor: color, borderWidth: stroke, opacity: 1,
          };
          if (a.fill) {
            opts.color = hexToRgb(a.fill);
            opts.opacity = opacity;
          }
          page.drawRectangle(opts);
          break;
        }
        case 'circle': {
          if (a.x == null || a.y == null || a.w == null || a.h == null) break;
          const cx = nx(a.x + a.w / 2);
          const cy = ny(a.y + a.h / 2);
          const rx = nw(a.w) / 2;
          const ry = nh(a.h) / 2;
          const opts: any = {
            x: cx, y: cy, xScale: rx, yScale: ry,
            borderColor: color, borderWidth: stroke, opacity: 1,
          };
          if (a.fill) {
            opts.color = hexToRgb(a.fill);
            opts.opacity = opacity;
          }
          page.drawEllipse(opts);
          break;
        }
        case 'line': {
          if (a.x == null || a.y == null || a.x2 == null || a.y2 == null) break;
          page.drawLine({
            start: { x: nx(a.x), y: ny(a.y) },
            end: { x: nx(a.x2), y: ny(a.y2) },
            thickness: stroke, color, opacity,
          });
          break;
        }
        case 'arrow': {
          if (a.x == null || a.y == null || a.x2 == null || a.y2 == null) break;
          const sx = nx(a.x), sy = ny(a.y);
          const ex = nx(a.x2), ey = ny(a.y2);
          page.drawLine({ start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: stroke, color, opacity });
          // arrow head
          const angle = Math.atan2(ey - sy, ex - sx);
          const head = Math.max(6, stroke * 4);
          const hx1 = ex - head * Math.cos(angle - Math.PI / 6);
          const hy1 = ey - head * Math.sin(angle - Math.PI / 6);
          const hx2 = ex - head * Math.cos(angle + Math.PI / 6);
          const hy2 = ey - head * Math.sin(angle + Math.PI / 6);
          page.drawLine({ start: { x: ex, y: ey }, end: { x: hx1, y: hy1 }, thickness: stroke, color, opacity });
          page.drawLine({ start: { x: ex, y: ey }, end: { x: hx2, y: hy2 }, thickness: stroke, color, opacity });
          break;
        }
        case 'freehand': {
          if (!a.points || a.points.length < 2) break;
          for (let i = 1; i < a.points.length; i++) {
            const p1 = a.points[i - 1], p2 = a.points[i];
            page.drawLine({
              start: { x: nx(p1.x), y: ny(p1.y) },
              end: { x: nx(p2.x), y: ny(p2.y) },
              thickness: stroke, color, opacity,
            });
          }
          break;
        }
        case 'text': {
          if (a.x == null || a.y == null || !a.content) break;
          const size = Math.max(8, (a.fontSize ?? 0.02) * nSize);
          if (a.fill) {
            const lines = a.content.split('\n');
            const textW = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)));
            const textH = lines.length * size * 1.2;
            page.drawRectangle({
              x: nx(a.x) - 2, y: ny(a.y) - textH,
              width: textW + 4, height: textH + 2,
              color: hexToRgb(a.fill), opacity: opacity,
            });
          }
          const lines = a.content.split('\n');
          lines.forEach((line, i) => {
            page.drawText(line, {
              x: nx(a.x!),
              y: ny(a.y!) - size * (i + 1),
              size, font, color, opacity: 1,
            });
          });
          break;
        }
        case 'comment': {
          if (a.x == null || a.y == null) break;
          const px = nx(a.x), py = ny(a.y);
          // pin
          page.drawEllipse({
            x: px, y: py, xScale: 8, yScale: 8,
            color: hexToRgb(a.color || '#f59e0b'), opacity: 1,
          });
          page.drawText('!', {
            x: px - 2, y: py - 4, size: 10, font: bold, color: rgb(1, 1, 1),
          });
          if (a.content) {
            const size = 9;
            const maxWidth = 180;
            const words = a.content.split(/\s+/);
            const lines: string[] = [];
            let cur = '';
            for (const w of words) {
              const t = cur ? cur + ' ' + w : w;
              if (font.widthOfTextAtSize(t, size) > maxWidth) {
                if (cur) lines.push(cur);
                cur = w;
              } else cur = t;
            }
            if (cur) lines.push(cur);
            const boxH = lines.length * size * 1.3 + 8;
            const boxW = maxWidth + 8;
            const bx = px + 12;
            const by = py - boxH / 2;
            page.drawRectangle({
              x: bx, y: by, width: boxW, height: boxH,
              color: rgb(1, 0.98, 0.85), borderColor: hexToRgb(a.color || '#f59e0b'),
              borderWidth: 0.5, opacity: 0.95,
            });
            lines.forEach((line, i) => {
              page.drawText(line, {
                x: bx + 4, y: by + boxH - size * (i + 1) - 2,
                size, font, color: rgb(0.15, 0.15, 0.15),
              });
            });
          }
          break;
        }
        case 'stamp': {
          if (a.x == null || a.y == null) break;
          const label = (a.content || a.stampKind || 'CARIMBO').toUpperCase();
          const c = hexToRgb(a.color || stampColor(a.stampKind));
          const size = Math.max(14, (a.fontSize ?? 0.028) * nSize);
          const textW = bold.widthOfTextAtSize(label, size);
          const padX = 8, padY = 4;
          const boxW = textW + padX * 2;
          const boxH = size + padY * 2;
          const x = nx(a.x), y = ny(a.y) - boxH;
          page.drawRectangle({
            x, y, width: boxW, height: boxH,
            borderColor: c, borderWidth: 2, opacity: 0,
          });
          page.drawText(label, {
            x: x + padX, y: y + padY + 2, size, font: bold, color: c,
          });
          break;
        }
        case 'magnifier': {
          if (!a.magnifier || a.x == null || a.y == null || a.w == null || a.h == null) break;
          const src = a.magnifier.src;
          const zoom = a.magnifier.zoom || 2;
          try {
            // embed source region as clipped page
            const [embedded] = await pdf.embedPages([page], [{
              left: nx(src.x),
              bottom: ny(src.y + src.h),
              right: nx(src.x + src.w),
              top: ny(src.y),
            }]);
            const targetX = nx(a.x);
            const targetY = ny(a.y + a.h);
            const targetW = nw(a.w);
            const targetH = nh(a.h);
            // white background
            page.drawRectangle({ x: targetX, y: targetY, width: targetW, height: targetH, color: rgb(1, 1, 1) });
            page.drawPage(embedded, { x: targetX, y: targetY, width: targetW, height: targetH });
            page.drawRectangle({
              x: targetX, y: targetY, width: targetW, height: targetH,
              borderColor: color, borderWidth: 1.2, opacity: 0,
            });
            // border around source
            page.drawRectangle({
              x: nx(src.x), y: ny(src.y + src.h),
              width: nw(src.w), height: nh(src.h),
              borderColor: color, borderWidth: 1, opacity: 0,
            });
            // connector
            page.drawLine({
              start: { x: nx(src.x + src.w / 2), y: ny(src.y + src.h / 2) },
              end: { x: targetX + targetW / 2, y: targetY + targetH / 2 },
              thickness: 0.6, color, opacity: 0.6,
            });
            if (a.magnifier.label) {
              page.drawText(a.magnifier.label, {
                x: targetX, y: targetY - 10, size: 8, font, color,
              });
            }
            void zoom;
          } catch { /* ignore */ }
          break;
        }
      }
    }
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  saveAs(new Blob([ab], { type: 'application/pdf' }), outputName);
  return bytes;
}

// Silence unused import warning if degrees not used elsewhere.
void degrees;