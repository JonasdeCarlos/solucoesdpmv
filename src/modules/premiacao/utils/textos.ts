import { numberToWords } from '@/utils/numberToWords';
import type { Catalogo, Politica } from '../hooks/usePremiacao';
import { efetivoPontos } from '../hooks/usePremiacao';

export const FORMULA_RODAPE =
  'Prêmio = pontos acima da pontuação de referência da função × valor do ponto. Saldo negativo não gera desconto e é transportado para o mês seguinte.';
export const TEXTO_REFERENCIA =
  'Pontuação correspondente ao desempenho ordinariamente esperado para a função. Apenas os pontos acima dela geram prêmio.';
export const TEXTO_RUBRICA =
  'Configurar no Domínio como prêmio (art. 457, §§ 2º e 4º, CLT) — sem incidência de INSS e FGTS, com incidência de IRRF, sem reflexos.';

export const fmtData = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };

export function valorPontoExtenso(v: number) {
  const n = Number(v || 0);
  let ext = '';
  try { ext = numberToWords(n); } catch { ext = ''; }
  const num = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return ext ? `${num} (${ext})` : num;
}

export function tituloRegulamento(versao: number, vigencia: string) {
  return `PROGRAMA EXCELÊNCIA — REGULAMENTO DE PREMIAÇÃO POR DESEMPENHO — Versão ${versao} — Vigência a partir de ${fmtData(vigencia)}`;
}

export function textoRegulamento(razaoSocial: string, politica: Politica) {
  return `1. Natureza. Os prêmios deste programa são concedidos por liberalidade da ${razaoSocial}, exclusivamente em razão de desempenho superior ao ordinariamente esperado no exercício das atividades, nos termos do art. 457, §§ 2º e 4º, da CLT, e não integram a remuneração para nenhum efeito.

2. Pontuação de referência. Cada função possui uma pontuação de referência, que corresponde ao desempenho normalmente esperado para ela. O prêmio corresponde somente aos pontos que ultrapassarem essa referência:
Prêmio = (saldo de pontos do mês − pontuação de referência da função) × ${valorPontoExtenso(politica.valor_ponto)} por ponto.
Pontos que não ultrapassarem a referência não geram prêmio e não se acumulam para os meses seguintes.

3. Composição dos pontos. O saldo do mês é formado pelos pontos de medalhas por serviço realizado, somados aos pontos de troféus por metas atingidas, deduzidos os pontos de desabono. As metas são apuradas pela quantidade de serviços realizados nos códigos definidos para cada uma.

4. Saldo negativo. O saldo negativo nunca gera desconto em salário, férias, 13º salário ou verbas rescisórias. Ele é transportado como saldo inicial do mês seguinte e extinto em caso de desligamento.

5. Desabonos. A pontuação de desempenho não é medida disciplinar. Ocorrências podem gerar medidas disciplinares, separadas da pontuação. Perdas e danos serão apurados individualmente.

6. Alterações. A empresa poderá alterar ou suspender o programa, com efeitos somente a partir da competência seguinte à divulgação da nova versão deste regulamento.

7. Compromisso. Siga os padrões técnicos, de segurança e de qualidade. Seu esforço é reconhecido e valorizado!`;
}

export function termoCiencia(versao: number, nome = '______________________________', funcao = '____________________') {
  return `Declaro que recebi e li o Regulamento do Programa Excelência, versão ${versao}, e estou ciente de suas regras.\nNome: ${nome} — Função: ${funcao} — Data: ___/___/______ — Assinatura: ______________________`;
}

/** Quadros anexos (referências, medalhas, metas, desabonos) a partir do catálogo vigente. */
export function quadrosAnexos(cat: Catalogo, politica: Politica) {
  const referencias = cat.cargos
    .map(c => ({ funcao: c.nome, pontos: cat.referencias.find(r => r.cargo_id === c.id)?.pontuacao_referencia ?? politica.pontuacao_referencia_padrao }))
    .filter(r => r.funcao);
  const medalhas = cat.medalhas.filter(m => m.ativo).map(m => ({
    medalha: m, servicos: cat.servicos.filter(s => s.ativo && s.gera_pontos && s.medalha_id === m.id).map(s => ({ ...s, pts: efetivoPontos(s, cat.medalhas) })),
  }));
  const metas = cat.metas.filter(m => m.ativo).map(m => ({
    ...m, codigos: cat.metasServicos.filter(x => x.meta_id === m.id).map(x => cat.servicos.find(s => s.id === x.servico_id)?.codigo).filter(Boolean) as string[],
  }));
  const desabonos = cat.desabonos.filter(d => d.ativo);
  return { referencias, medalhas, metas, desabonos };
}
