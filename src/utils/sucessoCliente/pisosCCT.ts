export interface PisoCCT {
  label: string;
  valor: number;
  ref: string;
  funcao?: string;
  grupo?: string;
  sindicato?: string;
  data_base?: string;
}

// Extrai cada função específica com seu valor a partir das cláusulas da IA.
// Aceita formatos como:
//  "GRUPO I - Garçom (CBO 513405), Barman, Cozinheiro - R$ 1.750,00"
//  "Para Cozinheiro, Pizzaiolo, o piso salarial é de R$ 1.910,18"
export function extractPisosCCT(ccts: any[]): PisoCCT[] {
  const out: PisoCCT[] = [];
  const active = (ccts || []).filter((c: any) => !c.deleted_at);
  const parseV = (raw: string) => Number(raw.replace(/\./g, '').replace(',', '.'));
  const limpar = (s: string) =>
    s
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\bCBO\s*[\d.\-]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s•·\-–—,;.:]+|[\s•·\-–—,;.:]+$/g, '')
      .trim();
  const isFuncao = (s: string) =>
    s.length >= 3 &&
    s.length <= 70 &&
    /[A-Za-zÀ-ÿ]{3,}/.test(s) &&
    !/^(GRUPO|PARA|O PISO|É DE|SERÃO|SERA|SALARIAL|CATEGORIA|TRABALHADORES?|MAIS|R\$)/i.test(s);

  // Extrai funções de UMA linha tabular do tipo:
  //   "A    FAXINEIRA ou SERVENTE                  R$ 1.699,60"
  //   "J    MENSAGEIRO, CAMAREIRA (O) OU COPEIRA (O)  R$ 1.699,60"
  const splitFuncoesLinha = (txt: string): string[] => {
    // remove letra de ordenação inicial "A ", "B ", "C-" etc.
    const semOrdem = txt.replace(/^\s*[A-Z]\s*[-–—)\.]?\s+/, '').trim();
    return semOrdem
      .split(/,| e | ou |;|\//gi)
      .map(limpar)
      .filter(Boolean)
      .filter(isFuncao);
  };

  for (const c of active) {
    const sind = c.sindicato || 'CCT';
    const dataBase = c.data_base ? ` • data-base ${c.data_base}` : '';
    const clauses = (c.ai_clauses || []) as any[];
    for (const cl of clauses) {
      const tit = String(cl?.titulo || '');
      const desc = String(cl?.descricao || '');
      const trecho = String(cl?.trecho_base || '');
      const blob = `${tit}\n${desc}\n${trecho}`;
      if (!/piso|salário\s+normativo|salario\s+normativo/i.test(blob)) continue;

      // ---------- Pass 1: formato TABULAR (uma função/linha com seu valor) ----------
      const linhas = (desc + '\n' + trecho).split(/\r?\n/);
      const reLinhaTab = /^(.*?)\s+R\$\s*([\d.]+,\d{2}|\d+(?:,\d{2})?)\s*$/;
      let achouTabular = false;
      for (const ln of linhas) {
        const m = ln.trim().match(reLinhaTab);
        if (!m) continue;
        const v = parseV(m[2]);
        if (!isFinite(v) || v <= 0) continue;
        const funcoes = splitFuncoesLinha(m[1]);
        if (funcoes.length === 0) continue;
        achouTabular = true;
        for (const funcao of funcoes) {
          out.push({
            funcao,
            valor: v,
            label: `${funcao} — R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${sind})`,
            ref: `${sind}${dataBase} — ${funcao}`,
            sindicato: sind,
            data_base: c.data_base || '',
          });
        }
      }
      if (achouTabular) continue;

      // ---------- Pass 2: formato discursivo (legado: "GRUPO X - ... R$ ...") ----------
      const mGrupo = blob.match(/GRUPO\s+([IVXLCDM\d]+)/i);
      const grupo = mGrupo ? `GRUPO ${mGrupo[1].toUpperCase()}` : '';

      const reValor = /R\$\s*([\d.]+,\d{2}|\d+(?:,\d{2})?)/gi;
      const valores = Array.from(blob.matchAll(reValor));
      if (valores.length === 0) continue;

      const fonte = (desc + ' ' + trecho).replace(/\s+/g, ' ');
      const idxRS = fonte.search(/R\$/i);
      let antes = idxRS > 0 ? fonte.slice(0, idxRS) : fonte;
      antes = antes
        .replace(/^.*?(GRUPO\s+[IVXLCDM\d]+\s*[-–—:]\s*)/i, '')
        .replace(/^.*?\bPara\b\s*/i, '')
        .replace(/,?\s*o\s+piso\s+salarial.*$/i, '')
        .replace(/[-–—]\s*$/, '');

      const partes = antes
        .split(/,| e | ou |;|\//gi)
        .map(limpar)
        .filter(Boolean)
        .filter(isFuncao);

      const v = parseV(valores[0][1]);
      if (!isFinite(v) || v <= 0) continue;

      if (partes.length === 0) {
        const rotulo = tit || 'Piso';
        out.push({
          grupo,
          valor: v,
          label: `${grupo ? grupo + ' • ' : ''}${rotulo} — R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${sind})`,
          ref: `${sind}${dataBase} — ${grupo || rotulo}`,
          sindicato: sind,
          data_base: c.data_base || '',
        });
      } else {
        for (const funcao of partes) {
          out.push({
            funcao,
            grupo,
            valor: v,
            label: `${funcao} — R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${grupo ? ' • ' + grupo : ''} (${sind})`,
            ref: `${sind}${dataBase} — ${funcao}${grupo ? ' • ' + grupo : ''}`,
            sindicato: sind,
            data_base: c.data_base || '',
          });
        }
      }
    }
  }
  const seen = new Set<string>();
  return out
    .filter(p => seen.has(p.label) ? false : (seen.add(p.label), true))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}