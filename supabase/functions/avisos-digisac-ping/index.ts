import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
  const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
  const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');
  const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');

  if (!TOKEN || !SERVICE_ID) {
    return new Response(JSON.stringify({ ok: false, erro: 'DIGISAC_API_TOKEN/DIGISAC_SERVICE_ID ausentes.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();
  try {
    async function ping(url: string) {
      const c = new AbortController();
      const tid = setTimeout(() => c.abort(), 15000);
      try {
        const r = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${TOKEN}` },
          signal: c.signal,
        });
        const body = await r.text();
        let parsed: any = body;
        try { parsed = JSON.parse(body); } catch { /* keep raw */ }
        return { ok: r.ok, status: r.status, body: parsed };
      } finally {
        clearTimeout(tid);
      }
    }

    const r1 = await ping(`${BASE_URL}/api/v1/services/${SERVICE_ID}`);
    const r2 = DEPARTMENT_ID
      ? await ping(`${BASE_URL}/api/v1/departments/${DEPARTMENT_ID}`)
      : { ok: false, status: 0, body: { erro: 'DIGISAC_DEPARTMENT_ID_PESSOAL não configurado.' } };

    const deptName = (r2.body && typeof r2.body === 'object')
      ? (r2.body.name || r2.body?.data?.name || null) : null;

    const tookMs = Date.now() - t0;
    return new Response(JSON.stringify({
      ok: r1.ok && r2.ok,
      tookMs,
      digisac: { ok: r1.ok, status: r1.status, detalhe: r1.body },
      departamento: { ok: r2.ok, status: r2.status, nome: deptName, detalhe: r2.body },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const tookMs = Date.now() - t0;
    const isAbort = e instanceof Error && e.name === 'AbortError';
    return new Response(JSON.stringify({
      ok: false, erro: isAbort ? 'timeout_local_15s' : (e as Error).message, tookMs,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});