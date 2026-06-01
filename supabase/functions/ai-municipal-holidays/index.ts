import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM = `Você é um especialista em legislação trabalhista e calendários oficiais brasileiros.
Dado um município, UF e ano, liste TODOS os feriados (nacionais, estaduais, municipais) e pontos facultativos oficiais aplicáveis no município no ano informado.
Responda APENAS JSON estrito:
{
  "items":[
    {"data":"YYYY-MM-DD","nome":"...","tipo":"nacional|estadual|municipal|ponto_facultativo",
     "is_holiday":true|false,"is_optional":true|false,"observacao":"breve fonte/contexto"}
  ]
}
Inclua: aniversário da cidade, padroeiro(a), datas religiosas locais conhecidas, datas estaduais oficiais. Não invente datas; se houver dúvida, omita.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { uf, municipio, ano } = await req.json();
    if (!uf || !municipio || !ano) {
      return new Response(JSON.stringify({ error: 'uf, municipio, ano obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Município: ${municipio}\nUF: ${uf}\nAno: ${ano}\nListe todos os feriados e pontos facultativos.` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI gateway ${aiResp.status}: ${t}`);
    }
    const j = await aiResp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Optionally also persist directly — but we return to the client which inserts via existing dedupe path.
    return new Response(JSON.stringify({ ok: true, items }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ai-municipal-holidays', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});