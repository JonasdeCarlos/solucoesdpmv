export interface CsvHolidayRow {
  data: string; nome: string; tipo?: string; escopo?: string;
  uf?: string; municipio?: string; is_holiday?: string; is_optional?: string; observacoes?: string;
}

export function parseHolidaysCsv(text: string): CsvHolidayRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((ln) => {
    const cells = ln.split(/[;,]/);
    const row: any = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row as CsvHolidayRow;
  });
}

export function normalizeDate(s: string): string | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}