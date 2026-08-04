import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

const BLOCOS: Record<string, string> = {
  identification: 'Identificação',
  unions: 'Sindicatos',
  territorial_base: 'Base territorial',
  professional_classes: 'Categorias / classes',
  economic_clauses: 'Cláusulas econômicas',
  benefits_summary: 'Benefícios obrigatórios',
  journey_rules: 'Jornada',
  overtime_rules: 'Horas extras / adicionais',
  vacation_absence: 'Férias / afastamentos',
  admission_termination: 'Admissão / rescisão',
  union_obligations: 'Obrigações sindicais',
  health_safety: 'Saúde e segurança',
  penalties: 'Multas / penalidades',
};

const SYSTEM = `Você é analista de Departamento Pessoal e compara duas Convenções Coletivas de Trabalho (anterior x nova).
Regras:
- Português do Brasil, objetivo, sem juridiquês.
- Compare bloco a bloco e aponte SOMENTE o que muda de fato (valores, percentuais, prazos, regras).
- Nunca invente. Se um dado não existir em uma das versões, use "não informado".
- Classifique cada item como: "alterado", "novo", "removido" ou "mantido" (use "mantido" apenas para os pontos economicamente relevantes que continuam iguais).
- Sempre informe o impacto prático para o DP e para a folha.
Responda EXCLUSIVAMENTE com JSON válido no formato:
{"resumo":"texto curto","itens":[{"bloco":"chave_do_bloco","titulo":"...","anterior":"...","nova":"...","tipo":"alterado|novo|removido|mantido","impacto":"..."}]}`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function extractJson(txt: string): any {
  const clean = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(clean); } catch { /* continua */ }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* continua */ }
  }
  return null;
}

function resumir(a: any) {
  const out: Record<string, unknown> = { titulo: a?.title };
  for (const k of Object.keys(BLOCOS)) out[k] = a?.[k] ?? null;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { analise_anterior_id, analise_nova_id } = await req.json();
    if (!analise_anterior_id || !analise_nova_id) return json(400, { error: 'Informe as duas CCTs para comparar.' });
    if (analise_anterior_id === analise_nova_id) return json(400, { error: 'Selecione CCTs diferentes.' });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json(500, { error: 'LOVABLE_API_KEY ausente' });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: rows } = await supabase.from('cct_analyses').select('*').in('id', [analise_anterior_id, analise_nova_id]);
    const anterior = (rows || []).find((r: any) => r.id === analise_anterior_id);
    const nova = (rows || []).find((r: any) => r.id === analise_nova_id);
    if (!anterior || !nova) return json(404, { error: 'Análise não encontrada.' });

    const payload = {
      blocos: BLOCOS,
      cct_anterior: resumir(anterior),
      cct_nova: resumir(nova),
    };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Compare estas duas CCTs:\n\n${JSON.stringify(payload).slice(0, 150000)}` },
        ],
        max_tokens: 8000,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      if (resp.status === 429) return json(429, { error: 'Limite de uso da IA atingido. Tente novamente em instantes.' });
      if (resp.status === 402) return json(402, { error: 'Créditos de IA esgotados. Adicione créditos no workspace.' });
      return json(502, { error: `Falha na IA (${resp.status}): ${detail.slice(0, 300)}` });
    }

    const aiJson = await resp.json();
    const parsed = extractJson(String(aiJson?.choices?.[0]?.message?.content || ''));
    if (!parsed || !Array.isArray(parsed.itens)) return json(422, { error: 'A IA não conseguiu montar o comparativo. Tente novamente.' });

    const resultado = { itens: parsed.itens, gerado_em: new Date().toISOString(), modelo: MODEL };
    const { data: saved } = await supabase
      .from('cct_comparacoes')
      .insert({
        analise_anterior_id,
        analise_nova_id,
        resumo: String(parsed.resumo || '').trim() || null,
        resultado,
      })
      .select('*')
      .single();

    return json(200, { ok: true, comparacao: saved });
  } catch (err) {
    console.error('[cct-comparar]', err);
    return json(500, { error: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});