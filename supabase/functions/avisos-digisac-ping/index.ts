import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
  const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
  const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');

  if (!TOKEN || !SERVICE_ID) {
    return new Response(JSON.stringify({ ok: false, erro: 'DIGISAC_API_TOKEN/DIGISAC_SERVICE_ID ausentes.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(`${BASE_URL}/api/v1/services/${SERVICE_ID}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    const body = await r.text();
    const tookMs = Date.now() - t0;
    return new Response(JSON.stringify({
      ok: r.ok, status: r.status, tookMs,
      body: body.length > 800 ? body.slice(0, 800) + '…' : body,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const tookMs = Date.now() - t0;
    const isAbort = e instanceof Error && e.name === 'AbortError';
    return new Response(JSON.stringify({
      ok: false, erro: isAbort ? 'timeout_local_15s' : (e as Error).message, tookMs,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});