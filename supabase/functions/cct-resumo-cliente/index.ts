import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

const SYSTEM = `Você escreve resumos de Convenções Coletivas de Trabalho (CCT) PARA O CLIENTE EMPRESÁRIO (leigo), não para o DP.
Regras:
- Português do Brasil, tom claro, direto e cordial.
- Máximo 12 linhas, em tópicos curtos com "•".
- Comece com uma linha de identificação: sindicato, categoria e vigência.
- Depois traga SOMENTE o que impacta o bolso e a rotina do cliente: piso salarial, reajuste, data-base, benefícios obrigatórios (valor), jornada, horas extras/adicionais, contribuições e prazos/multas.
- Nunca invente. Se um dado não existir, omita o tópico.
- Sem juridiquês, sem citar número de cláusula, sem introdução nem despedida.
- Valores e percentuais exatamente como no documento.`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { analysis_id } = await req.json();
    if (!analysis_id) return json(400, { error: 'analysis_id obrigatório' });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json(500, { error: 'LOVABLE_API_KEY ausente' });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: a } = await supabase.from('cct_analyses').select('*').eq('id', analysis_id).maybeSingle();
    if (!a) return json(404, { error: 'Análise não encontrada' });

    const dados = {
      titulo: a.title,
      identificacao: a.identification,
      sindicatos: a.unions,
      base_territorial: a.territorial_base,
      categorias: a.professional_classes,
      clausulas_economicas: a.economic_clauses,
      beneficios: a.benefits_summary,
      jornada: a.journey_rules,
      horas_extras: a.overtime_rules,
      ferias_afastamentos: a.vacation_absence,
      admissao_rescisao: a.admission_termination,
      obrigacoes_sindicais: a.union_obligations,
      multas: a.penalties,
      resumo_tecnico: a.ai_summary,
      pontos_atencao: a.dp_attention_points,
    };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Gere o resumo objetivo para o cliente com base neste Raio-X da CCT:\n\n${JSON.stringify(dados).slice(0, 120000)}` },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      if (resp.status === 429) return json(429, { error: 'Limite de uso da IA atingido. Tente novamente em instantes.' });
      if (resp.status === 402) return json(402, { error: 'Créditos de IA esgotados. Adicione créditos no workspace.' });
      return json(502, { error: `Falha na IA (${resp.status}): ${detail.slice(0, 300)}` });
    }

    const aiJson = await resp.json();
    const texto = String(aiJson?.choices?.[0]?.message?.content || '').trim();
    if (!texto) return json(422, { error: 'A IA não gerou o resumo. Tente novamente.' });

    await supabase.from('cct_analyses').update({ client_summary: texto }).eq('id', analysis_id);

    return json(200, { ok: true, client_summary: texto });
  } catch (err) {
    console.error('[cct-resumo-cliente]', err);
    return json(500, { error: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});