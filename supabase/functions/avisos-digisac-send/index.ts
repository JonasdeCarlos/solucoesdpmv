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
      .select('id, name, whatsapp, digisac_contact_id')
      .eq('id', empresa_id)
      .maybeSingle();

    if (errEmpresa || !empresa) return json(404, { erro: 'Empresa não encontrada.' });

    if (!empresa.digisac_contact_id && !empresa.whatsapp) {
      return json(400, { erro: 'Empresa sem WhatsApp cadastrado nem contato Digisac vinculado.' });
    }

    // Payload mínimo. dontOpenTicket evita o fluxo pesado que causa 524.
    const payload: Record<string, unknown> = {
      text: mensagem,
      serviceId: SERVICE_ID,
      origin: 'bot',
      dontOpenTicket: true,
    };
    if (empresa.digisac_contact_id) {
      payload.contactId = empresa.digisac_contact_id;
    } else {
      payload.number = String(empresa.whatsapp).replace(/\D/g, '');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIGISAC_FETCH_TIMEOUT_MS);

    console.log('[avisos-digisac-send] →', {
      empresa_id, tipo_aviso, via: empresa.digisac_contact_id ? 'contactId' : 'number',
    });

    let digisacResponse: Response;
    try {
      digisacResponse = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const tookMs = Date.now() - t0;
      if (e instanceof Error && e.name === 'AbortError') {
        await supabase.from('avisos_envios_log').insert({
          empresa_id, aviso_id: aviso_id ?? null, tipo_aviso,
          payload_enviado: payload, response_status: 0,
          response_body: { error: 'timeout_local', tookMs },
          sucesso: false,
        });
        return json(504, { erro: 'Digisac não respondeu em 30s. Servidor pode estar instável.', detalhe: 'timeout_local', tookMs });
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    const tookMs = Date.now() - t0;
    const responseText = await digisacResponse.text();
    let responseData: unknown = responseText;
    try { responseData = JSON.parse(responseText); } catch { /* keep raw */ }

    console.log('[avisos-digisac-send] ←', { status: digisacResponse.status, tookMs });

    // Log enxuto (limita response_body se for HTML gigante do Cloudflare)
    const responseForLog =
      typeof responseData === 'string' && responseData.length > 2000
        ? { truncated: true, preview: responseData.slice(0, 500) }
        : responseData;

    await supabase.from('avisos_envios_log').insert({
      empresa_id,
      aviso_id: aviso_id ?? null,
      tipo_aviso,
      payload_enviado: payload,
      response_status: digisacResponse.status,
      response_body: responseForLog as any,
      sucesso: digisacResponse.ok,
    });

    if (!digisacResponse.ok) {
      return json(502, {
        erro: `Digisac retornou ${digisacResponse.status}.`,
        status: digisacResponse.status,
        tookMs,
      });
    }

    // Aprendizado: se Digisac devolveu contactId, persiste para próximos envios.
    if (
      !empresa.digisac_contact_id &&
      responseData && typeof responseData === 'object'
    ) {
      const r = responseData as Record<string, any>;
      const contactId =
        r.contactId ||
        r?.message?.contactId ||
        r?.data?.contactId ||
        r?.contact?.id;
      if (contactId) {
        await supabase
          .from('aviso_empresas')
          .update({ digisac_contact_id: String(contactId) })
          .eq('id', empresa_id);
      }
    }

    return json(200, { sucesso: true, tookMs });
  } catch (err) {
    console.error('[avisos-digisac-send] erro', err);
    return json(500, { erro: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});