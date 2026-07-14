import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

const SYSTEM = `Você é assistente jurídico-trabalhista especializado em Convenções Coletivas de Trabalho brasileiras.
Você responde perguntas sobre UMA CCT específica, usando SOMENTE os dados fornecidos (Raio-X estruturado + trechos de OCR quando disponíveis).
Regras:
- Nunca invente. Se a resposta não estiver nos dados, responda: "Não localizei essa informação nos documentos anexados desta CCT."
- Cite o bloco/cláusula quando possível (ex.: "Cláusula econômica — reajuste").
- Escreva em português do Brasil, direto ao ponto (máx. 6 frases).
- Quando houver valor monetário, percentual, prazo ou data, mostre exatamente como aparece no documento.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { analysis_id, question, history } = await req.json();
    if (!analysis_id || !question) {
      return new Response(JSON.stringify({ error: 'analysis_id e question obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: a } = await supabase.from('cct_analyses').select('*').eq('id', analysis_id).maybeSingle();
    if (!a) {
      return new Response(JSON.stringify({ error: 'Análise não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const raioX: Record<string, any> = {
      identification: a.identification,
      unions: a.unions,
      territorial_base: a.territorial_base,
      professional_classes: a.professional_classes,
      economic_clauses: a.economic_clauses,
      benefits_summary: a.benefits_summary,
      journey_rules: a.journey_rules,
      overtime_rules: a.overtime_rules,
      vacation_absence: a.vacation_absence,
      admission_termination: a.admission_termination,
      union_obligations: a.union_obligations,
      health_safety: a.health_safety,
      penalties: a.penalties,
      dp_attention_points: a.dp_attention_points,
      ai_summary: a.ai_summary,
    };
    const ocrExcerpt = typeof a.ocr_text === 'string' && a.ocr_text.trim() ? a.ocr_text.slice(0, 18000) : null;

    const messages: any[] = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Dados da CCT "${a.title || 'CCT'}" (Raio-X extraído por IA):\n${JSON.stringify(raioX, null, 2)}${ocrExcerpt ? `\n\nTrecho do texto extraído (OCR, pode ser parcial):\n"""${ocrExcerpt}"""` : ''}` },
    ];
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h?.role && h?.content) messages.push({ role: h.role, content: String(h.content) });
      }
    }
    messages.push({ role: 'user', content: String(question) });

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({ model: MODEL, messages }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `IA falhou (${resp.status}): ${t.slice(0, 240)}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const json = await resp.json();
    const answer = json?.choices?.[0]?.message?.content?.trim() || 'Não foi possível gerar uma resposta.';

    await supabase.from('cct_audit_log').insert({ cct_analysis_id: analysis_id, action: 'ask_question', metadata: { question, chars: answer.length } });
    return new Response(JSON.stringify({ answer, model: MODEL }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});