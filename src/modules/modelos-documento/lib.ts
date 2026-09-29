import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { numberToWords } from '@/utils/numberToWords';

export type TipoModelo = 'politica' | 'recibo' | 'voucher' | 'extrato';
export const TIPO_LABEL: Record<TipoModelo, string> = {
  politica: 'Política / regulamento para assinatura',
  recibo: 'Recibo do prêmio',
  voucher: 'Voucher',
  extrato: 'Extrato do colaborador',
};

export type Campo = { page: number; x: number; y: number; w: number; size: number; campo: string; contexto?: string };

export const CAMPOS_DISPONIVEIS: { key: string; label: string }[] = [
  { key: 'nome', label: 'Nome do funcionário' },
  { key: 'cpf', label: 'CPF do funcionário' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'codigo', label: 'Código na folha' },
  { key: 'cargo', label: 'Cargo / função' },
  { key: 'setor', label: 'Setor' },
  { key: 'data_admissao', label: 'Data de admissão' },
  { key: 'empresa', label: 'Nome da empresa' },
  { key: 'cnpj', label: 'CNPJ/CPF da empresa' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'data', label: 'Data de hoje (dd/mm/aaaa)' },
  { key: 'data_extenso', label: 'Data por extenso' },
  { key: 'politica', label: 'Nome da política' },
  { key: 'competencia', label: 'Competência (mês/ano)' },
  { key: 'valor', label: 'Valor do prêmio (R$)' },
  { key: 'valor_extenso', label: 'Valor por extenso' },
  { key: 'pontos', label: 'Pontos' },
  { key: 'observacao', label: 'Observação' },
];
export const labelCampo = (k: string) => CAMPOS_DISPONIVEIS.find(c => c.key === k)?.label || k;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function dadosPadrao(p: {
  colaborador?: { nome?: string | null; cpf?: string | null; matricula?: string | null; codigo?: string | null; cargo?: string | null; setor?: string | null; data_admissao?: string | null };
  empresa?: string; cnpj?: string; cidade?: string; politica?: string; competencia?: string; valor?: number | null; pontos?: number | string | null; observacao?: string;
}): Record<string, string> {
  const hoje = new Date();
  const c = p.colaborador || {};
  const fmtD = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s || '');
  const comp = p.competencia && /^\d{4}-\d{2}/.test(p.competencia) ? `${p.competencia.slice(5, 7)}/${p.competencia.slice(0, 4)}` : p.competencia || '';
  const v = p.valor != null && !isNaN(Number(p.valor)) ? Number(p.valor) : null;
  return {
    nome: c.nome || '', cpf: c.cpf || '', matricula: c.matricula || '', codigo: c.codigo || '', cargo: c.cargo || '', setor: c.setor || '',
    data_admissao: fmtD(c.data_admissao), empresa: p.empresa || '', cnpj: p.cnpj || '', cidade: p.cidade || '',
    data: hoje.toLocaleDateString('pt-BR'), data_extenso: `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`,
    politica: p.politica || '', competencia: comp,
    valor: v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
    valor_extenso: v != null ? numberToWords(v) : '',
    pontos: p.pontos != null ? String(p.pontos) : '', observacao: p.observacao || '',
  };
}

export async function fileToBase64(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pdfjs() {
  const m: any = await import('pdfjs-dist');
  m.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${m.version}/build/pdf.worker.min.mjs`;
  return m;
}

/** Localiza espaços em branco (____ ou ......) no PDF, com o texto da linha como contexto. */
export async function detectarEspacos(bytes: Uint8Array): Promise<(Campo & { antes: string })[]> {
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: bytes.slice() }).promise;
  const res: (Campo & { antes: string })[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 20); p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as any[]).filter(it => typeof it.str === 'string' && it.str.length).map(it => ({
      str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number, w: it.width as number, h: Math.abs(it.transform[3]) || 10,
    }));
    const linhaDe = (y: number) => items.filter(o => Math.abs(o.y - y) < 3).sort((a, b) => a.x - b.x);
    for (const it of items) {
      const re = /_{3,}|\.{6,}|…{3,}/g; let m: RegExpExecArray | null;
      while ((m = re.exec(it.str))) {
        const len = it.str.length || 1;
        const x = it.x + it.w * (m.index / len);
        const w = Math.max(20, it.w * (m[0].length / len));
        const linha = linhaDe(it.y).map(o => (o === it ? it.str.slice(0, m!.index) + '[___]' + it.str.slice(m!.index + m![0].length) : o.str)).join(' ').replace(/_{3,}/g, '___');
        const ys = [...new Set(items.filter(o => o.y > it.y + 3 && o.y < it.y + 30).map(o => Math.round(o.y)))].sort((a, b) => a - b);
        const antes = ys.length ? linhaDe(ys[0]).map(o => o.str).join(' ') : '';
        res.push({ page: p, x, y: it.y, w, size: Math.min(11, Math.max(7, it.h * 0.9)), campo: '', contexto: linha.slice(0, 220), antes: antes.slice(0, 160) });
      }
    }
  }
  return res;
}

/** Renderiza páginas para imagem (revisão visual). */
export async function renderPaginas(bytes: Uint8Array, scale = 1.2, max = 8) {
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: bytes.slice() }).promise;
  const out: { url: string; w: number; h: number; pw: number; ph: number }[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, max); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, canvas }).promise;
    out.push({ url: canvas.toDataURL('image/jpeg', 0.85), w: vp.width, h: vp.height, pw: vp.width / scale, ph: vp.height / scale });
  }
  return out;
}

const limpar = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');

/** Preenche o modelo com os dados. Vários conjuntos de dados geram um único PDF com uma cópia por pessoa. */
export async function preencherModelo(b64: string, campos: Campo[], lista: Record<string, string>[]): Promise<Uint8Array> {
  const base = base64ToBytes(b64);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  for (const dados of lista) {
    const src = await PDFDocument.load(base, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(pg => out.addPage(pg));
    for (const c of campos) {
      if (!c.campo) continue;
      const pg = pages[c.page - 1]; if (!pg) continue;
      const txt = limpar(dados[c.campo] || ''); if (!txt) continue;
      let size = c.size || 10;
      while (size > 6 && font.widthOfTextAtSize(txt, size) > c.w) size -= 0.5;
      pg.drawText(txt, { x: c.x + 1, y: c.y + 1.5, size, font, color: rgb(0.05, 0.05, 0.2) });
    }
  }
  return out.save();
}

export function baixarPdf(bytes: Uint8Array, nome: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
