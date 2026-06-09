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

function tryJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

async function transferirTicket(
  baseUrl: string,
  token: string,
  ticketId: string,
  userId: string,
  departmentId: string,
): Promise<{ ok: boolean; endpointUsado?: string; detalhe?: unknown }> {
  // Tentativa 1: POST /api/v1/tickets/{id}/transfer
  try {
    const r1 = await fetch(`${baseUrl}/api/v1/tickets/${ticketId}/transfer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, departmentId, comments: 'Atribuição automática via app (aviso)' }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r1.text();
    if (r1.ok) return { ok: true, endpointUsado: 'tickets/{id}/transfer', detalhe: tryJson(text) };
    console.warn('[transferirTicket] Tentativa 1 falhou:', r1.status, text);
  } catch (e) {
    console.warn('[transferirTicket] Tentativa 1 erro:', e);
  }
  // Tentativa 2: PATCH /api/v1/tickets/{id}
  try {
    const r2 = await fetch(`${baseUrl}/api/v1/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, departmentId }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r2.text();
    if (r2.ok) return { ok: true, endpointUsado: 'PATCH tickets/{id}', detalhe: tryJson(text) };
    console.warn('[transferirTicket] Tentativa 2 falhou:', r2.status, text);
    return { ok: false, detalhe: { status: r2.status, body: tryJson(text) } };
  } catch (e) {
    return { ok: false, detalhe: { erro: String(e) } };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { empresa_id, aviso_id, mensagem, tipo_aviso, idempotency_key } = await req.json();

    if (!empresa_id || !mensagem || !tipo_aviso) {
      return json(400, { erro: 'Campos obrigatórios: empresa_id, mensagem, tipo_aviso.' });
    }
    if (!['aviso1', 'aviso2', 'aviso3', 'ligacao'].includes(tipo_aviso)) {
      return json(400, { erro: 'tipo_aviso inválido.' });
    }

    const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
    const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
    const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');
    const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');

    if (!TOKEN || !SERVICE_ID) {
      return json(500, { erro: 'Digisac não configurado (DIGISAC_API_TOKEN/DIGISAC_SERVICE_ID).' });
    }
    if (!DEPARTMENT_ID) {
      return json(500, { erro: 'Digisac não configurado (DIGISAC_DEPARTMENT_ID_PESSOAL).' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: empresa, error: errEmpresa } = await supabase
      .from('aviso_empresas')
      .select('id, name, whatsapp, whatsapp_numeros, digisac_contact_id, gestor_digisac_user_id')
      .eq('id', empresa_id)
      .maybeSingle();

    if (errEmpresa || !empresa) return json(404, { erro: 'Empresa não encontrada.' });

    // XOR: contactId tem preferência (mais estável); número só como fallback. NUNCA envia para os dois.
    type Dest = { kind: 'contact'; contactId: string } | { kind: 'number'; number: string };
    let dest: Dest | null = null;
    if (empresa.digisac_contact_id) {
      dest = { kind: 'contact', contactId: empresa.digisac_contact_id };
    } else {
      const numeros: string[] = Array.isArray((empresa as any).whatsapp_numeros) && (empresa as any).whatsapp_numeros.length
        ? (empresa as any).whatsapp_numeros
        : (empresa.whatsapp ? [String(empresa.whatsapp)] : []);
      for (const raw of numeros) {
        const num = String(raw).replace(/\D/g, '');
        if (num) { dest = { kind: 'number', number: num }; break; }
      }
    }
    if (!dest) {
      return json(400, { erro: 'Empresa sem contato Digisac nem WhatsApp cadastrado.' });
    }

    // Gate de idempotência server-side: reserva a linha pela idempotency_key ANTES de chamar o Digisac.
    // Se a mesma chave já existir (clique duplo / StrictMode), abortamos sem reenviar.
    if (idempotency_key) {
      const { error: errReserva } = await supabase.from('avisos_envios_log').insert({
        empresa_id, aviso_id: aviso_id ?? null, tipo_aviso,
        idempotency_key,
        sucesso: false, payload_enviado: null,
      });
      if (errReserva) {
        const code = (errReserva as any).code;
        if (code === '23505') {
          console.log('[avisos-digisac-send] duplicado bloqueado', { idempotency_key });
          return json(200, { sucesso: true, duplicado: true });
        }
        return json(500, { erro: 'Falha ao reservar log: ' + errReserva.message });
      }
    }

    const payload: Record<string, unknown> = {
      text: mensagem, serviceId: SERVICE_ID, departmentId: DEPARTMENT_ID,
      // ⚠️ userId NÃO entra aqui: o endpoint /messages ignora esse campo. A atribuição
      // ao gestor é feita depois via transferirTicket() abaixo.
    };
    if (dest.kind === 'contact') payload.contactId = dest.contactId;
    else payload.number = dest.number;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIGISAC_FETCH_TIMEOUT_MS);
    const tStart = Date.now();
    let resp: Response | null = null;
    let data: any = null;
    let took = 0;
    let abortedFlag = false;
    let errMsg: string | null = null;
    try {
      resp = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await resp.text();
      data = text;
      try { data = JSON.parse(text); } catch { /* keep raw */ }
      took = Date.now() - tStart;
    } catch (e) {
      took = Date.now() - tStart;
      abortedFlag = e instanceof Error && e.name === 'AbortError';
      errMsg = abortedFlag ? 'timeout_local_30s' : (e as Error)?.message;
    } finally {
      clearTimeout(timeoutId);
    }

    const trimmed = typeof data === 'string' && data.length > 2000
      ? { truncated: true, preview: data.slice(0, 500) } : data;

    // Extrai ticketId da resposta para a transferência pós-criação.
    let ticketId: string | null = null;
    if (resp?.ok && data && typeof data === 'object') {
      const r: any = data;
      ticketId = r?.ticket?.id ?? r?.ticketId ?? r?.data?.ticket?.id ?? null;
      if (ticketId) ticketId = String(ticketId);
    }

    // TRANSFERÊNCIA PÓS-CRIAÇÃO — só roda se mensagem foi entregue e gestor cadastrado.
    let transferOk = false;
    let transferDetalhe: { ok: boolean; endpointUsado?: string; detalhe?: unknown } | null = null;
    const gestorId = (empresa as any).gestor_digisac_user_id as string | null | undefined;
    if (resp?.ok && ticketId && gestorId) {
      transferDetalhe = await transferirTicket(BASE_URL, TOKEN, ticketId, gestorId, DEPARTMENT_ID);
      transferOk = transferDetalhe.ok;
    }

    const logBody = {
      department_id: DEPARTMENT_ID,
      gestor_user_id: gestorId ?? null,
      payload_enviado: payload,
      response_status: resp?.status ?? 0,
      response_body: resp ? trimmed : { error: errMsg, took },
      sucesso: !!resp?.ok,
      ticket_id: ticketId,
      transfer_ok: transferOk,
      transfer_endpoint: transferDetalhe?.endpointUsado ?? null,
      transfer_response: transferDetalhe as unknown as Record<string, unknown> | null,
    };
    if (idempotency_key) {
      await supabase.from('avisos_envios_log').update(logBody).eq('idempotency_key', idempotency_key);
    } else {
      await supabase.from('avisos_envios_log').insert({
        empresa_id, aviso_id: aviso_id ?? null, tipo_aviso, ...logBody,
      });
    }

    // Aprende contactId se ainda não tinha
    if (resp?.ok && !empresa.digisac_contact_id && data && typeof data === 'object') {
      const r: any = data;
      const cid = r.contactId || r?.message?.contactId || r?.data?.contactId || r?.contact?.id;
      if (cid) {
        await supabase.from('aviso_empresas').update({ digisac_contact_id: String(cid) }).eq('id', empresa_id);
      }
    }

    const tookMs = Date.now() - t0;
    console.log('[avisos-digisac-send]', {
      empresa_id, tipo_aviso, dest: dest.kind, ok: !!resp?.ok, status: resp?.status ?? 0,
      ticketId, transferOk, transferEndpoint: transferDetalhe?.endpointUsado ?? null, tookMs,
    });

    if (!resp?.ok) {
      return json(502, { erro: errMsg || 'Digisac recusou a mensagem.', status: resp?.status ?? 0, body: trimmed, tookMs });
    }
    return json(200, {
      sucesso: true,
      status: resp.status,
      ticketId,
      transferOk,
      transferDetalhe: transferOk ? null : transferDetalhe,
      tookMs,
    });
  } catch (err) {
    console.error('[avisos-digisac-send] erro', err);
    return json(500, { erro: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});