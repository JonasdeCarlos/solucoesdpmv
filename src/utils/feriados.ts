/**
 * Feriados Nacionais Brasileiros (fixos + móveis calculados por Páscoa)
 * Sábado = dia útil, Domingo e feriados = não úteis
 */

export interface FeriadoMunicipal {
  id: string;
  nome: string;
  dia: number;   // 1-31
  mes: number;   // 1-12
}

// ── Páscoa (algoritmo de Meeus/Jones/Butcher) ──────────────────────────
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

// ── Feriados nacionais de um dado ano ──────────────────────────────────
export function feriadosNacionais(ano: number): Date[] {
  const pascoa = calcularPascoa(ano);

  // Fixos
  const fixos = [
    new Date(ano, 0, 1),   // Confraternização Universal
    new Date(ano, 3, 21),  // Tiradentes
    new Date(ano, 4, 1),   // Dia do Trabalho
    new Date(ano, 8, 7),   // Independência
    new Date(ano, 9, 12),  // N. S. Aparecida
    new Date(ano, 10, 2),  // Finados
    new Date(ano, 10, 15), // Proclamação da República
    new Date(ano, 10, 20), // Consciência Negra
    new Date(ano, 11, 25), // Natal
  ];

  // Móveis (baseados na Páscoa)
  const moveis = [
    addDays(pascoa, -48), // Segunda-feira de Carnaval
    addDays(pascoa, -47), // Terça-feira de Carnaval
    addDays(pascoa, -2),  // Sexta-feira Santa
    pascoa,               // Páscoa
    addDays(pascoa, 60),  // Corpus Christi
  ];

  return [...fixos, ...moveis];
}

// ── Verificar se uma data é feriado ────────────────────────────────────
function mesmaData(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isFeriado(data: Date, municipais: FeriadoMunicipal[]): boolean {
  const nacionais = feriadosNacionais(data.getFullYear());
  if (nacionais.some((f) => mesmaData(f, data))) return true;

  // Municipais
  return municipais.some((fm) => fm.dia === data.getDate() && fm.mes === data.getMonth() + 1);
}

// ── Verificar se é dia útil (sábado = útil, domingo e feriado = não útil) ─
export function isDiaUtil(data: Date, municipais: FeriadoMunicipal[]): boolean {
  const dow = data.getDay();
  if (dow === 0) return false; // domingo
  if (isFeriado(data, municipais)) return false;
  return true;
}

// ── N-ésimo dia útil de um mês ─────────────────────────────────────────
export function nthDiaUtil(ano: number, mes: number, n: number, municipais: FeriadoMunicipal[]): Date {
  let count = 0;
  const d = new Date(ano, mes - 1, 1);
  while (count < n) {
    if (isDiaUtil(d, municipais)) count++;
    if (count < n) d.setDate(d.getDate() + 1);
  }
  return d;
}

// ── 5º dia útil do mês subsequente à competência ──────────────────────
export function quintoDiaUtilSubsequente(competencia: string, municipais: FeriadoMunicipal[]): string {
  // competencia = MM/AAAA
  const parts = competencia.split('/');
  if (parts.length !== 2) return '';
  const mes = Number(parts[0]);
  const ano = Number(parts[1]);
  if (!mes || !ano || mes < 1 || mes > 12) return '';

  // Mês subsequente
  let proxMes = mes + 1;
  let proxAno = ano;
  if (proxMes > 12) {
    proxMes = 1;
    proxAno++;
  }

  const data = nthDiaUtil(proxAno, proxMes, 5, municipais);
  // Retornar no formato YYYY-MM-DD
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Contar dias úteis e não úteis em um mês ────────────────────────────
export function contarDiasUteisMes(ano: number, mes: number, municipais: FeriadoMunicipal[]): { uteis: number; naoUteis: number } {
  const totalDias = new Date(ano, mes, 0).getDate(); // último dia do mês
  let uteis = 0;
  let naoUteis = 0;
  for (let dia = 1; dia <= totalDias; dia++) {
    const d = new Date(ano, mes - 1, dia);
    if (isDiaUtil(d, municipais)) uteis++;
    else naoUteis++;
  }
  return { uteis, naoUteis };
}
