// Layout Domínio — Importação de Lançamentos na Folha (registro "10"), 43 posições.
// Ajustes futuros do layout devem ficar restritos a este arquivo.

export interface DominioLinhaInput {
  codigoEmpregado: string;
  competencia: string; // AAAAMM
  rubrica: string;
  tipoProcesso: string;
  valor: number; // reais
  codigoEmpresa?: string | null;
}

type CampoId = 'fixo' | 'empregado' | 'competencia' | 'rubrica' | 'processo' | 'valor' | 'empresa';

export const DOMINIO_CAMPOS: { id: CampoId; nome: string; posicao: number; tamanho: number; preenchimento: '0' }[] = [
  { id: 'fixo', nome: 'Fixo', posicao: 1, tamanho: 2, preenchimento: '0' },
  { id: 'empregado', nome: 'Código empregado', posicao: 3, tamanho: 10, preenchimento: '0' },
  { id: 'competencia', nome: 'Competência', posicao: 13, tamanho: 6, preenchimento: '0' },
  { id: 'rubrica', nome: 'Rubrica', posicao: 19, tamanho: 4, preenchimento: '0' },
  { id: 'processo', nome: 'Tipo de processo', posicao: 23, tamanho: 2, preenchimento: '0' },
  { id: 'valor', nome: 'Valor', posicao: 25, tamanho: 9, preenchimento: '0' },
  { id: 'empresa', nome: 'Empresa', posicao: 34, tamanho: 10, preenchimento: '0' },
];

export const DOMINIO_LARGURA = DOMINIO_CAMPOS.reduce((s, c) => s + c.tamanho, 0); // 43
export const VALOR_MAXIMO = 9999999.99;

const onlyDigits = (s: string) => /^\d+$/.test(s);

export function valorParaCentavos(v: number): string {
  return String(Math.round(v * 100));
}

export function validarLinha(i: DominioLinhaInput): string[] {
  const e: string[] = [];
  const cod = String(i.codigoEmpregado ?? '').trim();
  if (!cod || !onlyDigits(cod) || cod.length > 10) e.push(`Código do empregado inválido: "${cod}" (somente dígitos, até 10).`);
  const rub = String(i.rubrica ?? '').trim();
  if (!rub || !onlyDigits(rub) || rub.length > 4) e.push(`Rubrica inválida: "${rub}" (somente dígitos, até 4).`);
  const proc = String(i.tipoProcesso ?? '').trim();
  if (!proc || !onlyDigits(proc) || proc.length > 2) e.push(`Tipo de processo inválido: "${proc}".`);
  if (!/^\d{6}$/.test(i.competencia)) e.push(`Competência inválida: "${i.competencia}".`);
  const emp = String(i.codigoEmpresa ?? '').trim();
  if (emp && (!onlyDigits(emp) || emp.length > 10)) e.push(`Código da empresa inválido: "${emp}".`);
  if (!(i.valor > 0)) e.push(`Valor deve ser maior que zero (empregado ${cod}).`);
  if (i.valor > VALOR_MAXIMO) e.push(`Valor acima do máximo de 9.999.999,99 (empregado ${cod}).`);
  return e;
}

export function gerarLinha(i: DominioLinhaInput): string {
  const valores: Record<CampoId, string> = {
    fixo: '10',
    empregado: String(i.codigoEmpregado).trim(),
    competencia: i.competencia,
    rubrica: String(i.rubrica).trim(),
    processo: String(i.tipoProcesso).trim(),
    valor: valorParaCentavos(i.valor),
    empresa: String(i.codigoEmpresa ?? '').trim(),
  };
  const linha = DOMINIO_CAMPOS.map((c) => valores[c.id].padStart(c.tamanho, c.preenchimento)).join('');
  if (linha.length !== DOMINIO_LARGURA) throw new Error(`Linha com ${linha.length} caracteres (esperado ${DOMINIO_LARGURA}).`);
  if (!/^\d+$/.test(linha)) throw new Error('Linha contém caracteres não numéricos.');
  return linha;
}

export function gerarArquivo(linhas: DominioLinhaInput[]): { conteudo: string; erros: string[] } {
  const validas = linhas.filter((l) => Math.round(l.valor * 100) > 0);
  const erros = validas.flatMap(validarLinha);
  if (!validas.length) erros.push('Nenhum funcionário com valor maior que zero.');
  if (erros.length) return { conteudo: '', erros };
  const out = validas.map(gerarLinha);
  if (out.some((l) => l.length !== DOMINIO_LARGURA)) return { conteudo: '', erros: ['Linha com tamanho inválido.'] };
  return { conteudo: out.join('\r\n'), erros: [] };
}

export function nomeArquivo(competencia: string, codigoEmpresa: string | null | undefined, tipo: 'original' | 'ajustado'): string {
  const aaaa = competencia.slice(0, 4);
  const mm = competencia.slice(4, 6);
  return `FOLHA${mm}${aaaa}-${(codigoEmpresa || '0').trim() || '0'}-TS-${tipo.toUpperCase()}.txt`;
}

export function baixarTxt(nome: string, conteudo: string) {
  const bytes = new TextEncoder().encode(conteudo);
  const blob = new Blob([bytes], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
