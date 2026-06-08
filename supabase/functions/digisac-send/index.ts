import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const DIGISAC_BASE = 'https://contabilmv.digisac.co';

function normalizeNumber(raw: string): string {
  let n = (raw || '').replace(/\D/g, '');
  if (!n) return '';
  // Garante DDI 55 quando o usuário cadastrou apenas DDD+número
  if (n.length <= 11 && !n.startsWith('55')) n = '55' + n;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const token = Deno.env.get('DIGISAC_API_TOKEN');
    const serviceId = Deno.env.get('DIGISAC_SERVICE_ID');
    const userId = Deno.env.get('DIGISAC_USER_ID') || undefined;
    if (!token || !serviceId) {
      return new Response(JSON.stringify({ error: 'Digisac não configurado (DIGISAC_API_TOKEN/DIGISAC_SERVICE_ID).' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const number = normalizeNumber(String(body?.number ?? ''));
    const text = String(body?.text ?? '').trim();
    if (!number || number.length < 10) {
      return new Response(JSON.stringify({ error: 'Número WhatsApp inválido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!text) {
      return new Response(JSON.stringify({ error: 'Mensagem vazia.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: Record<string, unknown> = {
      number,
      serviceId,
      origin: 'user',
      text,
      type: 'chat',
    };
    if (userId) payload.userId = userId;

    const resp = await fetch(`${DIGISAC_BASE}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data: unknown = raw;
    try { data = JSON.parse(raw); } catch { /* keep raw */ }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Falha Digisac', status: resp.status, data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});