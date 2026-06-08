import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Timeout local antes do Cloudflare matar a conexão (~100s).
const DIGISAC_FETCH_TIMEOUT_MS = 30000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { empresa_id, aviso_id, mensagem, tipo_aviso } = await req.json();

    if (!empresa_id || !mensagem || !tipo_aviso) {
      return json(400, { erro: 'Campos obrigatórios: empresa_id, mensagem, tipo_aviso.' });
    }
    if (!['aviso1', 'aviso2', 'aviso3', 'ligacao'].includes(tipo_aviso)) {
      return json(400, { erro: 'tipo_aviso inválido.' });
    }

    const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
    const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
    const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');

    if (!TOKEN || !SERVICE_ID) {
      return json(500, { erro: 'Digisac não configurado (DIGISAC_API_TOKEN/DIGISAC_SERVICE_ID).' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: empresa, error: errEmpresa } = await supabase
      .from('aviso_empresas')
      .select('id, name, whatsapp, whatsapp_numeros, digisac_contact_id')
      .eq('id', empresa_id)
      .maybeSingle();

    if (errEmpresa || !empresa) return json(404, { erro: 'Empresa não encontrada.' });

    // Lista de destinos: contactId (se houver) + todos os números cadastrados.
    type Dest = { kind: 'contact'; contactId: string } | { kind: 'number'; number: string };
    const destinos: Dest[] = [];
    if (empresa.digisac_contact_id) destinos.push({ kind: 'contact', contactId: empresa.digisac_contact_id });
    const numeros: string[] = Array.isArray((empresa as any).whatsapp_numeros) && (empresa as any).whatsapp_numeros.length
      ? (empresa as any).whatsapp_numeros
      : (empresa.whatsapp ? [String(empresa.whatsapp)] : []);
    for (const raw of numeros) {
      const num = String(raw).replace(/\D/g, '');
      if (num) destinos.push({ kind: 'number', number: num });
    }
    if (destinos.length === 0) {
      return json(400, { erro: 'Empresa sem WhatsApp cadastrado nem contato Digisac vinculado.' });
    }

    async function sendOne(dest: Dest) {
      const payload: Record<string, unknown> = {
        text: mensagem, serviceId: SERVICE_ID, origin: 'bot', dontOpenTicket: true,
      };
      if (dest.kind === 'contact') payload.contactId = dest.contactId;
      else payload.number = dest.number;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DIGISAC_FETCH_TIMEOUT_MS);
      const tStart = Date.now();
      try {
        const resp = await fetch(`${BASE_URL}/api/v1/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await resp.text();
        let data: any = text;
        try { data = JSON.parse(text); } catch { /* keep raw */ }
        const took = Date.now() - tStart;
        const trimmed = typeof data === 'string' && data.length > 2000
          ? { truncated: true, preview: data.slice(0, 500) } : data;
        await supabase.from('avisos_envios_log').insert({
          empresa_id, aviso_id: aviso_id ?? null, tipo_aviso,
          payload_enviado: payload, response_status: resp.status,
          response_body: trimmed, sucesso: resp.ok,
        });
        // Aprende contactId se ainda não tinha
        if (!empresa.digisac_contact_id && resp.ok && data && typeof data === 'object') {
          const r: any = data;
          const cid = r.contactId || r?.message?.contactId || r?.data?.contactId || r?.contact?.id;
          if (cid) {
            await supabase.from('aviso_empresas').update({ digisac_contact_id: String(cid) }).eq('id', empresa_id);
          }
        }
        return { dest, ok: resp.ok, status: resp.status, took };
      } catch (e) {
        const took = Date.now() - tStart;
        const aborted = e instanceof Error && e.name === 'AbortError';
        await supabase.from('avisos_envios_log').insert({
          empresa_id, aviso_id: aviso_id ?? null, tipo_aviso,
          payload_enviado: payload, response_status: 0,
          response_body: { error: aborted ? 'timeout_local' : (e as Error)?.message, took },
          sucesso: false,
        });
        return { dest, ok: false, status: 0, took, error: aborted ? 'timeout_local_30s' : (e as Error)?.message };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const resultados = [];
    for (const d of destinos) resultados.push(await sendOne(d));
    const algumOk = resultados.some((r) => r.ok);
    const tookMs = Date.now() - t0;
    console.log('[avisos-digisac-send]', { empresa_id, tipo_aviso, destinos: destinos.length, ok: algumOk, tookMs });

    if (!algumOk) {
      return json(502, { erro: 'Nenhum destino aceito pelo Digisac.', resultados, tookMs });
    }
    return json(200, { sucesso: true, resultados, tookMs });
  } catch (err) {
    console.error('[avisos-digisac-send] erro', err);
    return json(500, { erro: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});