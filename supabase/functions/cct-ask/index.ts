import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

const SYSTEM = `Você é assistente jurídico-trabalhista especializado em Convenções Coletivas de Trabalho brasileiras.
Você responde perguntas sobre UMA CCT específica, usando os dados fornecidos: TEXTO INTEGRAL da CCT (fonte principal), TRECHOS MAIS RELEVANTES para a pergunta e o Raio-X estruturado (resumo, pode estar incompleto).
Regras:
- Procure a resposta PRIMEIRO no texto integral e nos trechos relevantes. O Raio-X é só um resumo; se ele cita algo (ex.: REPIS, piso, auxílio), as condições completas estão no texto integral — leia a cláusula inteira.
- Considere siglas e sinônimos (ex.: REPIS = Regime Especial de Piso Salarial / piso diferenciado para micro e pequenas empresas; PLR = participação nos lucros; VA/VR = vale-alimentação/refeição).
- Responda com as condições completas: quem pode aderir, requisitos, documentos, prazos, valores, procedimento, vigência e consequências.
- Cite a cláusula (número e título) e, quando útil, um trecho literal curto entre aspas.
- Só diga "Não localizei essa informação nos documentos desta CCT." se realmente não houver nada no texto integral.
- Português do Brasil, objetivo, use tópicos quando houver várias condições. Valores, percentuais, prazos e datas exatamente como no documento.`;

const SINONIMOS: Record<string, string[]> = {
  repis: ['repis', 'regime especial', 'piso especial', 'piso diferenciado', 'microempresa', 'pequeno porte', 'simples nacional', 'adesão', 'certidão'],
  piso: ['piso', 'salário normativo', 'salario normativo', 'salário mínimo profissional'],
  plr: ['plr', 'participação nos lucros', 'participacao nos lucros', 'ppr'],
  alimentacao: ['alimentação', 'alimentacao', 'refeição', 'refeicao', 'cesta', 'ticket', 'vale'],
  extra: ['hora extra', 'horas extras', 'extraordinária', 'adicional'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function relevantChunks(text: string, question: string, max = 12): string[] {
  const q = norm(question);
  const terms = new Set(q.split(/[^a-z0-9]+/).filter((t) => t.length >= 4));
  for (const [k, list] of Object.entries(SINONIMOS)) {
    if (q.includes(k) || list.some((w) => q.includes(norm(w)))) list.forEach((w) => terms.add(norm(w)));
  }
  if (!terms.size) return [];
  const size = 2500, step = 1800;
  const scored: { i: number; s: number }[] = [];
  const nt = norm(text);
  for (let i = 0; i < nt.length; i += step) {
    const c = nt.slice(i, i + size);
    let s = 0;
    for (const t of terms) { let p = c.indexOf(t); while (p >= 0) { s += t.includes(' ') ? 3 : 1; p = c.indexOf(t, p + t.length); } }
    if (s > 0) scored.push({ i, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, max).sort((a, b) => a.i - b.i).map(({ i }) => text.slice(Math.max(0, i - 400), i + size + 400));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const { analysis_id, question, history } = await req.json();
    if (!analysis_id || !question) return json({ error: 'analysis_id e question obrigatórios' }, 400);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY ausente' }, 500);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: a } = await supabase.from('cct_analyses').select('*').eq('id', analysis_id).maybeSingle();
    if (!a) return json({ error: 'Análise não encontrada' }, 404);

    const raioX = {
      identification: a.identification, unions: a.unions, territorial_base: a.territorial_base,
      professional_classes: a.professional_classes, economic_clauses: a.economic_clauses,
      benefits_summary: a.benefits_summary, journey_rules: a.journey_rules, overtime_rules: a.overtime_rules,
      vacation_absence: a.vacation_absence, admission_termination: a.admission_termination,
      union_obligations: a.union_obligations, health_safety: a.health_safety, penalties: a.penalties,
      dp_attention_points: a.dp_attention_points, ai_summary: a.ai_summary,
    };
    const full: string = typeof a.ocr_text === 'string' ? a.ocr_text.trim() : '';
    const integral = full.slice(0, 350000);
    const trechos = full ? relevantChunks(full, String(question)) : [];

    let ctx = `CCT "${a.title || 'CCT'}"\n\n=== RAIO-X (resumo) ===\n${JSON.stringify(raioX)}`;
    if (trechos.length) ctx += `\n\n=== TRECHOS MAIS RELEVANTES PARA A PERGUNTA ===\n${trechos.map((t, i) => `[Trecho ${i + 1}]\n${t}`).join('\n\n')}`;
    if (integral) ctx += `\n\n=== TEXTO INTEGRAL DA CCT${full.length > integral.length ? ' (truncado)' : ''} ===\n${integral}`;
    else ctx += `\n\n(Sem texto integral extraído — responda com base no Raio-X e avise que o texto integral não está disponível.)`;

    const messages: any[] = [{ role: 'system', content: SYSTEM }, { role: 'user', content: ctx }, { role: 'assistant', content: 'Documento recebido. Pode perguntar.' }];
    if (Array.isArray(history)) for (const h of history.slice(-8)) if (h?.role && h?.content) messages.push({ role: h.role, content: String(h.content) });
    messages.push({ role: 'user', content: String(question) });

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) return json({ error: 'Muitas consultas seguidas. Aguarde alguns segundos.' }, 429);
      if (resp.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
      return json({ error: `IA falhou (${resp.status}): ${t.slice(0, 240)}` }, 502);
    }
    const out = await resp.json();
    const answer = out?.choices?.[0]?.message?.content?.trim() || 'Não foi possível gerar uma resposta.';
    await supabase.from('cct_audit_log').insert({ cct_analysis_id: analysis_id, action: 'ask_question', metadata: { question, chars: answer.length, trechos: trechos.length } });
    return json({ answer, model: MODEL, has_full_text: !!full });
  } catch (err: any) {
    return json({ error: err?.message || 'Erro interno' }, 500);
  }
});
