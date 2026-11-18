import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireInternalUser } from '../_shared/internalAuth.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { buildMessagePayload, MAX_PDF_BASE64 } from '../_shared/mensageriaPdf.ts';

const bodySchema = z.object({
  empresa_id: z.string().uuid(),
  mensagem: z.string().trim().min(1).max(4000),
  anexo: z.object({ name: z.string().min(1).max(180), mimetype: z.literal('application/pdf'), base64: z.string().min(1).max(MAX_PDF_BASE64) }).strict().optional(),
}).strict();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = await requireInternalUser(req, corsHeaders);
  if (denied) return denied;
  const t0 = Date.now();
  try {
    if (Number(req.headers.get('content-length') || 0) > MAX_PDF_BASE64 + 16384) return json(413, { erro: 'Selecione um PDF de até 5 MB.' });
    let body: unknown;
    try { body = await req.json(); } catch { return json(400, { erro: 'Pedido de envio inválido.' }); }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return json(400, { erro: 'Confira a empresa, o texto (máx. 4000 caracteres) e o PDF (máx. 5 MB).' });
    const { empresa_id, mensagem, anexo } = parsed.data;
    let payload: Record<string, unknown>;
    try { payload = buildMessagePayload(mensagem, '', '', anexo); }
    catch (error) { return json(400, { erro: error instanceof Error ? error.message : 'PDF inválido.' }); }

    const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
    const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
    const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');
    const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');
    if (!TOKEN || !SERVICE_ID || !DEPARTMENT_ID) {
      return json(500, { erro: 'Digisac não configurado.' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const { data: empresa, error: errEmp } = await supabase
      .from('aviso_empresas')
      .select('id, name, whatsapp, whatsapp_numeros, digisac_contact_id, gestor_digisac_user_id')
      .eq('id', empresa_id)
      .maybeSingle();
    if (errEmp || !empresa) return json(404, { erro: 'Empresa não encontrada.' });

    payload.serviceId = SERVICE_ID;
    payload.departmentId = DEPARTMENT_ID;
    const numeros: string[] = Array.isArray((empresa as any).whatsapp_numeros) && (empresa as any).whatsapp_numeros.length
      ? (empresa as any).whatsapp_numeros
      : (empresa.whatsapp ? [String(empresa.whatsapp)] : []);
    const num = numeros.map((n) => String(n).replace(/\D/g, '')).find(Boolean);
    if (num) {
      // Número cadastrado tem prioridade sobre contactId aprendido (pode estar desatualizado).
      payload.number = num;
    } else if (empresa.digisac_contact_id) {
      payload.contactId = empresa.digisac_contact_id;
    } else {
      return json(400, { erro: 'Empresa sem contato Digisac nem WhatsApp.' });
    }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), anexo ? 60000 : 30000);
    let resp: Response | null = null;
    let data: any = null;
    let errMsg: string | null = null;
    try {
      resp = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await resp.text();
      try { data = JSON.parse(text); } catch { data = text; }
    } catch (e) {
      errMsg = (e as Error)?.message || 'erro de rede';
    } finally {
      clearTimeout(to);
    }

    if (!resp?.ok) {
      return json(502, { erro: errMsg || 'Digisac recusou a mensagem.', status: resp?.status ?? 0, body: data });
    }

    // Aprende contactId se ainda não tinha
    if (!empresa.digisac_contact_id && data && typeof data === 'object') {
      const cid = data.contactId || data?.message?.contactId || data?.data?.contactId || data?.contact?.id;
      if (cid) {
        await supabase.from('aviso_empresas').update({ digisac_contact_id: String(cid) }).eq('id', empresa_id);
      }
    }

    return json(200, { sucesso: true, tookMs: Date.now() - t0 });
  } catch (err) {
    console.error('[avisos-digisac-mensagem] erro', err);
    return json(500, { erro: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});