import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { file_base64, mime_type } = await req.json();
    if (!file_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: 'file_base64 e mime_type obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

    const prompt = `Você é especialista em identidade visual. Analise este manual de marca e extraia:
- primary_color (hex): cor principal da marca
- secondary_color (hex): cor secundária
- text_color (hex): cor de texto padrão (geralmente escura)
- heading_font: nome da fonte de títulos (use uma destas se compatível: Helvetica, Times, Courier; senão informe o nome real)
- body_font: nome da fonte de corpo (mesma regra)
- notes: observações curtas

Responda APENAS JSON puro no formato: {"primary_color":"#RRGGBB","secondary_color":"#RRGGBB","text_color":"#RRGGBB","heading_font":"...","body_font":"...","notes":"..."}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            mime_type.startsWith('image/')
              ? { type: 'image_url', image_url: { url: `data:${mime_type};base64,${file_base64}` } }
              : { type: 'file', file: { file_data: `data:${mime_type};base64,${file_base64}`, filename: 'manual.pdf' } },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${t.slice(0, 300)}`);
    }
    const data = await resp.json();
    const txt: string = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta sem JSON: ' + txt.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});