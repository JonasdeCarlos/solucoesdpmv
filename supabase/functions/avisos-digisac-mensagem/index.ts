import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    const { empresa_id, mensagem } = await req.json();
    if (!empresa_id || !mensagem || typeof mensagem !== 'string') {
      return json(400, { erro: 'Campos obrigatórios: empresa_id, mensagem.' });
    }
    if (mensagem.length > 4000) {
      return json(400, { erro: 'Mensagem muito longa (máx. 4000 caracteres).' });
    }

    const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
    const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
    const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');
    const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');
    if (!TOKEN || !SERVICE_ID || !DEPARTMENT_ID) {
      return json(500, { erro: 'Digisac não configurado.' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: empresa, error: errEmp } = await supabase
      .from('aviso_empresas')
      .select('id, name, whatsapp, whatsapp_numeros, digisac_contact_id, gestor_digisac_user_id')
      .eq('id', empresa_id)
      .maybeSingle();
    if (errEmp || !empresa) return json(404, { erro: 'Empresa não encontrada.' });

    const payload: Record<string, unknown> = {
      text: mensagem, serviceId: SERVICE_ID, departmentId: DEPARTMENT_ID,
    };
    if (empresa.digisac_contact_id) {
      payload.contactId = empresa.digisac_contact_id;
    } else {
      const numeros: string[] = Array.isArray((empresa as any).whatsapp_numeros) && (empresa as any).whatsapp_numeros.length
        ? (empresa as any).whatsapp_numeros
        : (empresa.whatsapp ? [String(empresa.whatsapp)] : []);
      const num = numeros.map((n) => String(n).replace(/\D/g, '')).find(Boolean);
      if (!num) return json(400, { erro: 'Empresa sem contato Digisac nem WhatsApp.' });
      payload.number = num;
    }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30000);
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