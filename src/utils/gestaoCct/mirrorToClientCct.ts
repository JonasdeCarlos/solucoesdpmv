const s = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(s).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.values(v).map(s).filter(Boolean).join(' — ');
  return '';
};

const toDate = (v: any): string | null => {
  const raw = s(v);
  if (!raw) return null;
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
};

function clausesFrom(a: any) {
  const out: { titulo: string; descricao: string }[] = [];
  const push = (titulo: string, v: any) => {
    const d = s(v);
    if (d) out.push({ titulo, descricao: d });
  };
  const econ = a.economic_clauses || {};
  if (Array.isArray(econ.piso_salarial)) {
    econ.piso_salarial.forEach((p: any) => push('Piso salarial', `${s(p?.funcao) || 'Geral'} — ${s(p?.valor)}`));
  }
  push('Reajuste', econ.reajuste_percentual);
  const bens = Array.isArray(a?.benefits_summary?.beneficios) ? a.benefits_summary.beneficios : [];
  bens.forEach((b: any) => push(s(b?.nome) || 'Benefício', [s(b?.valor), s(b?.periodicidade), s(b?.condicoes)].filter(Boolean).join(' · ')));
  push('Jornada', a.journey_rules);
  push('Horas extras e adicionais', a.overtime_rules);
  push('Férias e afastamentos', a.vacation_absence);
  push('Admissão e rescisão', a.admission_termination);
  push('Obrigações sindicais', a.union_obligations);
  push('Multas e penalidades', a.penalties);
  return out;
}

export function buildClientCctFromAnalysis(a: any, params: { client_id: string; version: number; codigo_sindicato_dominio?: string }) {
  const ident = a.identification || {};
  const unions = a.unions || {};
  const terr = a.territorial_base || {};
  return {
    client_id: params.client_id,
    cct_analysis_id: a.id,
    union_base: s(terr.descricao) || s(terr.municipios),
    sindicato: s(unions.sindicato_laboral) || s(a.title),
    uf: s(terr.uf).slice(0, 40),
    data_base: s(ident.data_base),
    validity_start: toDate(ident.vigencia_inicial),
    validity_end: toDate(ident.vigencia_final),
    doc_path: null,
    doc_name: `${s(a.title) || 'CCT'} (Gestão CCT)`,
    ai_summary: s(a.client_summary) || s(a.ai_summary),
    ai_clauses: clausesFrom(a),
    version: params.version,
    is_active: true,
    codigo_sindicato_dominio: params.codigo_sindicato_dominio || '',
    instrumento_tipo: s(ident.tipo_instrumento) || s(ident.instrumento_tipo),
    numero_registro_mte: s(ident.numero_registro) || s(ident.numero_registro_mte),
    abrangencia_territorial: s(terr.descricao) || s(terr.municipios),
    categoria_abrangida: s(a?.professional_classes),
    sindicato_laboral_nome: s(unions.sindicato_laboral),
    sindicato_laboral_cnpj: s(unions.cnpj_laboral),
    sindicato_patronal_nome: s(unions.sindicato_patronal),
    sindicato_patronal_cnpj: s(unions.cnpj_patronal),
  };
}