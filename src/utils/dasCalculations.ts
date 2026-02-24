/**
 * Motor de cálculo do DAS — Simples Nacional
 * Conforme LC 123/2006 e atualizações
 */

export interface DasFaixa {
  anexo: string;
  faixa: number;
  rbt12_min: number;
  rbt12_max: number;
  aliquota_nominal: number;
  parcela_deduzir: number;
}

export interface DasAtividadeInput {
  anexo: string;
  percentualReceita: number; // 0-1 — proporção da receita nesse anexo
}

export interface DasSimulationInput {
  competenciaInicial: string; // YYYY-MM
  horizonteMeses: number;
  rbt12Inicial: number;
  receitasMensais: number[]; // receita bruta mensal projetada
  atividades: DasAtividadeInput[];
  // Fator R
  exigeFatorR: boolean;
  folha12mInicial: number; // folha acumulada 12m para Fator R
  folhasMensais: number[]; // folha mensal projetada (para atualizar Fator R)
}

export interface DasMonthAnexoResult {
  anexo: string;
  receitaAnexo: number;
  faixaAplicada: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number;
  dasAnexo: number;
}

export interface DasMonthResult {
  competencia: string;
  mesNumero: number;
  receitaMes: number;
  rbt12: number;
  fatorR: number | null;
  porAnexo: DasMonthAnexoResult[];
  dasTotal: number;
  aliquotaEfetivaPonderada: number;
}

export interface DasConsolidatedResult {
  monthly: DasMonthResult[];
  totalReceita: number;
  totalDas: number;
  aliquotaEfetivaMedia: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Gera competência YYYY-MM a partir de uma inicial + offset
 */
export function addMonthsDas(competencia: string, offset: number): string {
  const [y, m] = competencia.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

/**
 * Encontra a faixa do Simples para um dado RBT12 e anexo
 */
export function findFaixa(
  rbt12: number,
  anexo: string,
  faixas: DasFaixa[]
): DasFaixa | null {
  const filtered = faixas
    .filter((f) => f.anexo === anexo)
    .sort((a, b) => a.faixa - b.faixa);

  for (const f of filtered) {
    if (rbt12 <= f.rbt12_max) return f;
  }
  // Se ultrapassou o teto, retorna a última faixa
  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

/**
 * Calcula alíquota efetiva do Simples Nacional
 * Fórmula: ((RBT12 × alíquota nominal) - parcela a deduzir) ÷ RBT12
 */
export function calcularAliquotaEfetiva(
  rbt12: number,
  aliquotaNominal: number,
  parcelaDeduzir: number
): number {
  if (rbt12 <= 0) return 0;
  const efetiva = ((rbt12 * aliquotaNominal) - parcelaDeduzir) / rbt12;
  return Math.max(0, efetiva);
}

/**
 * Calcula o Fator R
 * Fator R = Folha acumulada 12m / Receita acumulada 12m
 */
export function calcularFatorR(folha12m: number, receita12m: number): number {
  if (receita12m <= 0) return 0;
  return folha12m / receita12m;
}

/**
 * Motor principal de simulação do DAS
 */
export function calcularDas(
  input: DasSimulationInput,
  faixasDb: DasFaixa[]
): DasConsolidatedResult {
  const monthly: DasMonthResult[] = [];
  let totalReceita = 0;
  let totalDas = 0;

  // Manter RBT12 rolling: começa com o informado e vai atualizando
  let rbt12 = input.rbt12Inicial;
  let folha12m = input.folha12mInicial;
  // Fila de receitas mensais para rolling (FIFO de 12 meses)
  const receitaFila: number[] = [];
  const folhaFila: number[] = [];

  for (let i = 0; i < input.horizonteMeses; i++) {
    const competencia = addMonthsDas(input.competenciaInicial, i);
    const receitaMes = input.receitasMensais[i] || 0;
    const folhaMes = input.folhasMensais?.[i] || 0;

    // Atualizar RBT12 rolling (adiciona mês atual, remove o 13º mais antigo)
    receitaFila.push(receitaMes);
    if (receitaFila.length > 12) {
      rbt12 = rbt12 - (receitaFila.shift() || 0) + receitaMes;
    } else if (i > 0) {
      // Nos primeiros 12 meses, o RBT12 é o informado + receitas projetadas acumuladas
      // Simplificação: usamos o RBT12 inicial e vamos substituindo
      rbt12 = rbt12 + receitaMes * (1 / 12); // média ponderada
    }

    // Fator R
    folhaFila.push(folhaMes);
    if (folhaFila.length > 12) {
      folha12m = folha12m - (folhaFila.shift() || 0) + folhaMes;
    }
    const fatorR = input.exigeFatorR ? calcularFatorR(folha12m, rbt12) : null;

    // Calcular DAS por atividade/anexo
    const porAnexo: DasMonthAnexoResult[] = [];
    let dasTotal = 0;

    for (const ativ of input.atividades) {
      const receitaAnexo = round2(receitaMes * ativ.percentualReceita);
      const faixa = findFaixa(rbt12, ativ.anexo, faixasDb);

      if (!faixa) {
        porAnexo.push({
          anexo: ativ.anexo,
          receitaAnexo,
          faixaAplicada: 0,
          aliquotaNominal: 0,
          parcelaDeduzir: 0,
          aliquotaEfetiva: 0,
          dasAnexo: 0,
        });
        continue;
      }

      const aliqEfetiva = calcularAliquotaEfetiva(
        rbt12,
        faixa.aliquota_nominal,
        faixa.parcela_deduzir
      );
      const dasAnexo = round2(receitaAnexo * aliqEfetiva);

      porAnexo.push({
        anexo: ativ.anexo,
        receitaAnexo,
        faixaAplicada: faixa.faixa,
        aliquotaNominal: faixa.aliquota_nominal,
        parcelaDeduzir: faixa.parcela_deduzir,
        aliquotaEfetiva: round2(aliqEfetiva * 10000) / 10000, // 4 casas
        dasAnexo,
      });
      dasTotal += dasAnexo;
    }

    dasTotal = round2(dasTotal);
    const aliquotaEfetivaPonderada = receitaMes > 0
      ? round2((dasTotal / receitaMes) * 10000) / 10000
      : 0;

    monthly.push({
      competencia,
      mesNumero: i + 1,
      receitaMes,
      rbt12: round2(rbt12),
      fatorR: fatorR !== null ? round2(fatorR * 10000) / 10000 : null,
      porAnexo,
      dasTotal,
      aliquotaEfetivaPonderada,
    });

    totalReceita += receitaMes;
    totalDas += dasTotal;
  }

  const aliquotaEfetivaMedia = totalReceita > 0
    ? round2((totalDas / totalReceita) * 10000) / 10000
    : 0;

  return {
    monthly,
    totalReceita: round2(totalReceita),
    totalDas: round2(totalDas),
    aliquotaEfetivaMedia,
  };
}
