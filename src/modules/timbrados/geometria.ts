// Cálculos puros do submódulo Timbrados (sem dependência de navegador).
export const A4_W = 595.28;
export const A4_H = 841.89;
export const MM_PT = 2.83465;
export const mmToPt = (mm: number) => (Number(mm) || 0) * MM_PT;

export interface Margens {
  superior: number;
  inferior: number;
  esquerda: number;
  direita: number;
}

export interface Retangulo { x: number; y: number; w: number; h: number }

/** Área útil em pontos PDF (origem no canto inferior esquerdo). */
export function areaUtil(m: Margens): Retangulo {
  const x = mmToPt(m.esquerda);
  const y = mmToPt(m.inferior);
  const w = Math.max(1, A4_W - mmToPt(m.esquerda) - mmToPt(m.direita));
  const h = Math.max(1, A4_H - mmToPt(m.superior) - mmToPt(m.inferior));
  return { x, y, w, h };
}

/** Escala nunca acima de 100% e posição centralizada (horizontal) / topo ou centro (vertical). */
export function encaixar(
  conteudoW: number,
  conteudoH: number,
  area: Retangulo,
  alinhamento: 'topo' | 'centro',
): { escala: number; x: number; y: number; w: number; h: number } {
  const escala = Math.min(area.w / conteudoW, area.h / conteudoH, 1);
  const w = conteudoW * escala;
  const h = conteudoH * escala;
  const x = area.x + (area.w - w) / 2;
  const y = alinhamento === 'centro' ? area.y + (area.h - h) / 2 : area.y + area.h - h;
  return { escala, x, y, w, h };
}

/**
 * Origem para drawPage de uma página embutida com /Rotate.
 * A página embutida é desenhada sem rotação; giramos no sentido horário
 * (rotate = -rotacao) e deslocamos para cair no retângulo de destino.
 */
export function origemRotacionada(rotacao: number, destino: { x: number; y: number; w: number; h: number }) {
  const r = ((rotacao % 360) + 360) % 360;
  if (r === 90) return { x: destino.x, y: destino.y + destino.h, rotate: -90 };
  if (r === 180) return { x: destino.x + destino.w, y: destino.y + destino.h, rotate: -180 };
  if (r === 270) return { x: destino.x + destino.w, y: destino.y, rotate: -270 };
  return { x: destino.x, y: destino.y, rotate: 0 };
}

/** Bounding box dos pixels não brancos (qualquer canal < limiar). Retorna null se vazio. */
export function bboxPixels(
  data: Uint8ClampedArray,
  largura: number,
  altura: number,
  limiar = 245,
  yIni = 0,
  yFim = altura,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = largura, y0 = altura, x1 = -1, y1 = -1;
  const ya = Math.max(0, Math.floor(yIni));
  const yb = Math.min(altura, Math.ceil(yFim));
  for (let y = ya; y < yb; y++) {
    let row = y * largura * 4;
    for (let x = 0; x < largura; x++, row += 4) {
      if (data[row + 3] === 0) continue;
      if (data[row] < limiar || data[row + 1] < limiar || data[row + 2] < limiar) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export const nomeTimbrado = (nomeOriginal: string) =>
  nomeOriginal.replace(/\.pdf$/i, '') + '_timbrado.pdf';
