// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { A4_W, A4_H, areaUtil, encaixar, origemRotacionada, bboxPixels, nomeTimbrado, mmToPt } from '../geometria';

describe('timbrados - geometria', () => {
  it('1 mm = 2.83465 pt', () => {
    expect(mmToPt(10)).toBeCloseTo(28.3465, 4);
  });

  it('área útil desconta as 4 margens', () => {
    const a = areaUtil({ superior: 40, inferior: 20, esquerda: 15, direita: 15 });
    expect(a.x).toBeCloseTo(mmToPt(15));
    expect(a.y).toBeCloseTo(mmToPt(20));
    expect(a.w).toBeCloseTo(A4_W - mmToPt(30));
    expect(a.h).toBeCloseTo(A4_H - mmToPt(60));
  });

  it('nunca amplia acima de 100%', () => {
    const area = { x: 0, y: 0, w: 500, h: 700 };
    expect(encaixar(100, 100, area, 'topo').escala).toBe(1);
  });

  it('reduz para caber na área útil e encosta no topo', () => {
    const area = { x: 10, y: 20, w: 400, h: 600 };
    const r = encaixar(800, 600, area, 'topo');
    expect(r.escala).toBeCloseTo(0.5);
    expect(r.x).toBeCloseTo(10);
    expect(r.y + r.h).toBeCloseTo(620);
  });

  it('alinhamento centro centraliza verticalmente', () => {
    const area = { x: 0, y: 0, w: 400, h: 600 };
    const r = encaixar(400, 200, area, 'centro');
    expect(r.y).toBeCloseTo(200);
  });

  it('origem para página rotacionada 90°', () => {
    const o = origemRotacionada(90, { x: 10, y: 20, w: 300, h: 200 });
    expect(o).toEqual({ x: 10, y: 220, rotate: -90 });
  });

  it('bounding box ignora pixels brancos e respeita recorte', () => {
    const w = 4, h = 4;
    const d = new Uint8ClampedArray(w * h * 4).fill(255);
    const set = (x: number, y: number) => { const i = (y * w + x) * 4; d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; };
    set(1, 0); set(2, 2);
    expect(bboxPixels(d, w, h)).toEqual({ x0: 1, y0: 0, x1: 3, y1: 3 });
    expect(bboxPixels(d, w, h, 245, 1, 4)).toEqual({ x0: 2, y0: 2, x1: 3, y1: 3 });
    expect(bboxPixels(new Uint8ClampedArray(w * h * 4).fill(255), w, h)).toBeNull();
  });

  it('nome do arquivo recebe sufixo _timbrado', () => {
    expect(nomeTimbrado('Holerite Março.PDF')).toBe('Holerite Março_timbrado.pdf');
  });
});
