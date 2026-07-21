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
  contactId: string | null,
): Promise<{ ok: boolean; endpointUsado?: string; detalhe?: unknown }> {
  // A API pública do Digisac expõe as ações de ticket via /contacts/{contactId}/ticket/...
  // (mesmo padrão de /contacts/{contactId}/ticket/close documentado no Postman público).
  // As rotas /tickets/{id}/... retornam 404 NotFoundHttpError.
  const tentativas: { label: string; method: string; url: string; body: unknown }[] = [];
  if (contactId) {
    tentativas.push({
      label: 'contacts/{contactId}/ticket/transfer',
      method: 'POST',
      url: `${baseUrl}/api/v1/contacts/${contactId}/ticket/transfer`,
      body: { userId, departmentId, comments: 'Atribuição automática via app (aviso)' },
    });
    tentativas.push({
      label: 'contacts/{contactId}/ticket (PUT)',
      method: 'PUT',
      url: `${baseUrl}/api/v1/contacts/${contactId}/ticket`,
      body: { userId, departmentId },
    });
  }
  // Último recurso: rotas /tickets/{id}/... (caso o tenant exponha esse formato).
  tentativas.push({
    label: 'tickets/{id}/transfer',
    method: 'POST',
    url: `${baseUrl}/api/v1/tickets/${ticketId}/transfer`,
    body: { userId, departmentId, comments: 'Atribuição automática via app (aviso)' },
  });
  let ultimoDetalhe: unknown = null;
  for (const t of tentativas) {
    try {
      const r = await fetch(t.url, {
        method: t.method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body),
        signal: AbortSignal.timeout(15000),
      });
      const text = await r.text();
      if (r.ok) return { ok: true, endpointUsado: t.label, detalhe: tryJson(text) };
      console.warn('[transferirTicket] tentativa falhou', t.label, r.status, text);
      ultimoDetalhe = { tentativa: t.label, status: r.status, body: tryJson(text) };
    } catch (e) {
      console.warn('[transferirTicket] tentativa erro', t.label, e);
      ultimoDetalhe = { tentativa: t.label, erro: String(e) };
    }
  }
  return { ok: false, detalhe: ultimoDetalhe };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { empresa_id, aviso_id, mensagem, tipo_aviso, idempotency_key, number_override } = await req.json();

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

    // Prioridade:
    // 1) number_override explícito do cliente (loop multi-contato) — nunca usa contact_id nem auto-aprende.
    // 2) digisac_contact_id aprendido — somente quando empresa tem 0 ou 1 número cadastrado
    //    (caso contrário o contact_id "trava" o envio em um único destinatário).
    // 3) primeiro número cadastrado como fallback.
    type Dest = { kind: 'contact'; contactId: string } | { kind: 'number'; number: string };
    let dest: Dest | null = null;
    const numerosCadastrados: string[] = Array.isArray((empresa as any).whatsapp_numeros) && (empresa as any).whatsapp_numeros.length
      ? (empresa as any).whatsapp_numeros.map((n: any) => String(n).replace(/\D/g, '')).filter(Boolean)
      : (empresa.whatsapp ? [String(empresa.whatsapp).replace(/\D/g, '')].filter(Boolean) : []);
    const overrideNum = number_override ? String(number_override).replace(/\D/g, '') : '';
    if (overrideNum) {
      dest = { kind: 'number', number: overrideNum };
    } else if (empresa.digisac_contact_id && numerosCadastrados.length <= 1) {
      dest = { kind: 'contact', contactId: empresa.digisac_contact_id };
    } else if (numerosCadastrados[0]) {
      dest = { kind: 'number', number: numerosCadastrados[0] };
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
      const contactIdParaTransfer = (empresa as any).digisac_contact_id
        ?? (data && typeof data === 'object' ? ((data as any).contactId ?? (data as any)?.message?.contactId ?? (data as any)?.contact?.id) : null);
      transferDetalhe = await transferirTicket(
        BASE_URL, TOKEN, ticketId, gestorId, DEPARTMENT_ID,
        contactIdParaTransfer ? String(contactIdParaTransfer) : null,
      );
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

    // Aprende contactId APENAS quando empresa tem 1 número (evita travar envios multi-contato)
    // e quando o envio não veio de um override explícito.
    if (resp?.ok && !overrideNum && !empresa.digisac_contact_id && numerosCadastrados.length <= 1 && data && typeof data === 'object') {
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