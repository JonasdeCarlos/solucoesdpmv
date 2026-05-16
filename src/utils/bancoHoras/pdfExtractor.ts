// Extrai colaboradores e BSALDO de PDFs de Cartão Ponto Secullum.
// Cada página = 1 colaborador. Usa pdfjs-dist no browser.

export interface ExtractedRow {
  page: number;
  empresa_nome: string;
  empresa_cnpj: string;
  competencia: string; // YYYY-MM-01
  competencia_label: string; // MM/YYYY
  codigo: string;
  nome: string;
  bsaldo: string; // ex: "+12:30" ou "-83:03"
  bsaldo_minutes: number;
  status: 'ok' | 'pendente';
  motivo?: string;
}

function periodoToCompetencia(d1: string): { iso: string; label: string } {
  // d1 = dd/mm/yyyy
  const [, m, y] = d1.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || [];
  const yy = y;
  const mm = m;
  return { iso: `${yy}-${mm}-01`, label: `${mm}/${yy}` };
}

function parseHHMMsigned(s: string): number | null {
  const m = s.trim().match(/^([+\-]?)(\d{1,4}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

type PItem = { x: number; y: number; w: number; str: string };
type PLine = { y: number; items: PItem[]; text: string };

/**
 * Agrupa itens de texto da página em linhas por coordenada Y, ordenando por X.
 * Retorna estrutura com itens posicionais + texto concatenado.
 */
function pageToStructuredLines(textItems: any[]): PLine[] {
  const items: PItem[] = textItems
    .filter((it: any) => it && it.str !== undefined && (it.str || '').trim() !== '')
    .map((it: any) => ({
      x: it.transform?.[4] ?? 0,
      y: Math.round((it.transform?.[5] ?? 0) * 10) / 10,
      w: it.width ?? 0,
      str: it.str || '',
    }));
  const sortedByY = [...items].sort((a, b) => b.y - a.y);
  const buckets: { y: number; items: PItem[] }[] = [];
  const TOL = 2.5;
  for (const it of sortedByY) {
    let bucket = buckets.find((l) => Math.abs(l.y - it.y) <= TOL);
    if (!bucket) {
      bucket = { y: it.y, items: [] };
      buckets.push(bucket);
    }
    bucket.items.push(it);
  }
  return buckets.map((l) => {
    const sorted = l.items.sort((a, b) => a.x - b.x);
    return {
      y: l.y,
      items: sorted,
      text: sorted.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim(),
    };
  });
}

/**
 * Dado um rótulo (ex: "NOME:"), localiza o item de texto correspondente e
 * retorna o conteúdo da próxima linha abaixo, dentro de uma faixa horizontal
 * alinhada ao rótulo (X do rótulo até o início do próximo rótulo na mesma linha).
 */
function valueBelowLabel(
  structured: PLine[],
  labelRegex: RegExp,
  opts: { maxLinesBelow?: number; padRight?: number } = {},
): string {
  const maxLinesBelow = opts.maxLinesBelow ?? 4;
  for (let i = 0; i < structured.length; i++) {
    const line = structured[i];
    const labelItemIdx = line.items.findIndex((it) => labelRegex.test(it.str));
    if (labelItemIdx === -1) continue;
    const labelItem = line.items[labelItemIdx];
    // Limite direito = X do próximo item na mesma linha (próximo rótulo) ou +∞
    const nextItem = line.items[labelItemIdx + 1];
    const xLeft = labelItem.x - 2;
    const xRight = nextItem ? nextItem.x - 2 : Number.POSITIVE_INFINITY;
    // Procurar nas próximas linhas (Y menor) o conteúdo dentro da faixa X
    for (let j = i + 1; j < Math.min(i + 1 + maxLinesBelow, structured.length); j++) {
      const below = structured[j];
      const inside = below.items.filter((it) => it.x >= xLeft && it.x < xRight);
      if (inside.length === 0) continue;
      const txt = inside.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (txt) return txt;
    }
    return '';
  }
  return '';
}

function pageToLines(textItems: any[]): string[] {
  return pageToStructuredLines(textItems).map((l) => l.text);
}

function extractFromLines(lines: string[], structured: PLine[], pageNum: number): ExtractedRow {
  const all = lines.join('\n');

  // Período
  const periodo = all.match(/Período:\s*(\d{2}\/\d{2}\/\d{4})\s*at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i);
  const comp = periodo ? periodoToCompetencia(periodo[1]) : { iso: '', label: '' };

  // CNPJ
  const cnpjMatch = all.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const cnpj = cnpjMatch ? cnpjMatch[1] : '';

  // Empresa: linha imediatamente após linha que contenha "EMPRESA:"
  let empresa = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/EMPRESA:/i.test(l)) {
      // mesma linha pode ter "EMPRESA: ..." ou nome em linha próxima
      const same = l.replace(/^.*EMPRESA:\s*/i, '').trim();
      if (same && !/HORÁRIO|CARGA/i.test(same)) {
        empresa = same.replace(/HORÁRIO.*/i, '').trim();
      }
      if (!empresa) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const cand = lines[j].trim();
          if (
            cand &&
            !/^CNPJ|^INSCRIÇÃO|^DEPARTAMENTO|^FUNÇÃO|^CARGA|^SEG|^TER|^QUA|^QUI|^SEX|^SAB|^DOM|HORÁRIO/i.test(cand) &&
            !/^\d{2}\.\d{3}\.\d{3}/.test(cand)
          ) {
            empresa = cand;
            break;
          }
        }
      }
      break;
    }
  }

  // Nome do colaborador: extração posicional sob o rótulo "NOME:"
  let nome = valueBelowLabel(structured, /^NOME:?$/i, { maxLinesBelow: 4 });
  // Limpa eventuais sufixos (datas, etc. que possam ter caído na faixa)
  if (nome) {
    nome = nome.replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/, '').trim();
  }

  // Código (Nº FOLHA): extração posicional sob o rótulo "Nº FOLHA:"
  let codigo = valueBelowLabel(structured, /^N[º°o]\s*FOLHA:?$/i, { maxLinesBelow: 4 });
  if (codigo) {
    // Pega o primeiro token alfanumérico curto
    const tok = codigo.split(/\s+/).find((t) => /^[A-Za-z0-9.\-/]{1,12}$/.test(t));
    codigo = tok || codigo.trim();
  }
  // Fallback inline (caso o PDF tenha "Nº FOLHA: 15" na mesma linha)
  if (!codigo) {
    const folhaInline = all.match(/N[º°o]\s*FOLHA:\s*([A-Za-z0-9.\-/]+)/i);
    if (folhaInline) codigo = folhaInline[1];
  }

  // BSALDO da linha TOTAIS
  let bsaldoStr = '';
  let bsaldoMin: number | null = null;
  let status: 'ok' | 'pendente' = 'pendente';
  let motivo: string | undefined;

  for (const line of lines) {
    const m = line.match(/^TOTAIS\b\s*(.*)$/i);
    if (!m) continue;
    const rest = m[1];
    const tokens = rest.split(/\s+/).filter(Boolean);
    // valores HH:MM (com sinal opcional)
    const hhmm = tokens.filter((t) => /^[+\-]?\d{1,4}:\d{2}$/.test(t));
    if (hhmm.length >= 7) {
      // Layout esperado: CARGA NORMAIS DOMINGO FERIADO120 BCRED BDEB BSALDO BTOTAL BAJUS NOT.TOT
      // BSALDO = índice 6 quando 10 valores; se vierem menos, tenta 4º a partir do final.
      let bs: string;
      if (hhmm.length === 10) bs = hhmm[6];
      else if (hhmm.length >= 4) bs = hhmm[hhmm.length - 4];
      else bs = hhmm[hhmm.length - 1];
      const minutes = parseHHMMsigned(bs);
      if (minutes != null) {
        bsaldoStr = bs.startsWith('+') || bs.startsWith('-') ? bs : `+${bs}`;
        if (minutes === 0) bsaldoStr = '00:00';
        bsaldoMin = minutes;
        status = 'ok';
      }
    } else if (hhmm.length > 0 && hhmm.every((t) => /^0+:00$/.test(t.replace(/^[+\-]/, '')))) {
      // TOTAIS 00:00 ... → sem dados, mas considerar 00:00
      bsaldoStr = '00:00';
      bsaldoMin = 0;
      status = 'ok';
    }
    break;
  }

  if (status === 'pendente') motivo = 'BSALDO não localizado na linha TOTAIS';

  return {
    page: pageNum,
    empresa_nome: empresa,
    empresa_cnpj: cnpj,
    competencia: comp.iso,
    competencia_label: comp.label,
    codigo,
    nome,
    bsaldo: bsaldoStr,
    bsaldo_minutes: bsaldoMin ?? 0,
    status,
    motivo,
  };
}

export async function extractPontoPdf(file: File): Promise<ExtractedRow[]> {
  const pdfjs: any = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  const rows: ExtractedRow[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const structured = pageToStructuredLines(tc.items);
    const lines = structured.map((l) => l.text);
    const row = extractFromLines(lines, structured, i);
    if (!row.nome) {
      // Página sem cabeçalho de colaborador (capa, sumário) → ignorar
      continue;
    }
    rows.push(row);
  }
  return rows;
}

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
