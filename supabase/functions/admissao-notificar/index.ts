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
  try {
    const { request_id } = await req.json().catch(() => ({}));
    if (!request_id || typeof request_id !== 'string') {
      return json(400, { erro: 'request_id obrigatório.' });
    }

    const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
    const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
    const SERVICE_ID = Deno.env.get('DIGISAC_SERVICE_ID');
    const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');
    if (!TOKEN || !SERVICE_ID) return json(500, { erro: 'Digisac não configurado.' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cfg } = await supabase
      .from('admissao_notify_settings')
      .select('enabled, whatsapp_numeros')
      .limit(1)
      .maybeSingle();

    if (!cfg || cfg.enabled === false) return json(200, { sucesso: true, ignorado: 'notificacao_desativada' });
    const numeros: string[] = Array.isArray(cfg.whatsapp_numeros)
      ? cfg.whatsapp_numeros.map((n: unknown) => String(n).replace(/\D/g, '')).filter(Boolean)
      : [];
    if (!numeros.length) return json(200, { sucesso: true, ignorado: 'sem_numeros' });

    const { data: reqRow } = await supabase
      .from('admission_requests')
      .select('id, company_name, employee_name, template_name_snapshot, submitted_at, answers, draft_answers')
      .eq('id', request_id)
      .maybeSingle();
    if (!reqRow) return json(404, { erro: 'Admissão não encontrada.' });

    // Fallback: buscar nome do colaborador / empresa nas respostas do formulário
    const ans: Record<string, unknown> = {
      ...(reqRow.draft_answers as Record<string, unknown> || {}),
      ...(reqRow.answers as Record<string, unknown> || {}),
    };
    const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    const pick = (patterns: RegExp[], excludedKeyPatterns: RegExp[] = []) => {
      for (const [k, v] of Object.entries(ans)) {
        if (typeof v !== 'string' || !v.trim()) continue;
        if (excludedKeyPatterns.some((p) => p.test(k))) continue;
        if (patterns.some((p) => p.test(k))) return v.trim();
      }
      return '';
    };
    const companyName = reqRow.company_name?.trim() || '';
    const empresaResposta = pick(
      [/razao_?social/i, /razão_?social/i, /nome_?empresarial/i, /nome_?da_?empresa/i, /^empresa$/i, /^company(?:_?name)?$/i],
      [/e-?mail/i, /email/i, /contato/i, /responsavel/i, /responsável/i],
    );
    const empresa = (!isEmail(companyName) && companyName) ||
      (!isEmail(empresaResposta) && empresaResposta) || '—';
    const colaborador = reqRow.employee_name?.trim() ||
      pick([/nome_?completo/i, /^nome$/i, /colaborador/i, /funcionario/i, /funcionário/i, /employee/i]) || '—';

    const dataBR = new Date(reqRow.submitted_at || Date.now()).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const mensagem =
      `🔔 *Nova admissão pendente*\n\n` +
      `Empresa: ${empresa}\n` +
      `Colaborador: ${colaborador}\n` +
      `Formulário: ${reqRow.template_name_snapshot || '—'}\n` +
      `Recebida em: ${dataBR}\n\n` +
      `Acesse o módulo de Admissão para dar andamento.`;

    const resultados: unknown[] = [];
    for (const number of numeros) {
      const payload: Record<string, unknown> = { text: mensagem, serviceId: SERVICE_ID, number };
      if (DEPARTMENT_ID) payload.departmentId = DEPARTMENT_ID;
      try {
        const r = await fetch(`${BASE_URL}/api/v1/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
        const text = await r.text();
        if (!r.ok) console.error(`[admissao-notificar] Digisac falhou [${r.status}]: ${text}`);
        resultados.push({ number, ok: r.ok, status: r.status });
      } catch (e) {
        console.error('[admissao-notificar] erro', number, String(e));
        resultados.push({ number, ok: false, erro: String(e) });
      }
    }

    return json(200, { sucesso: resultados.some((x: any) => x.ok), resultados });
  } catch (err) {
    console.error('[admissao-notificar] exception', err);
    return json(500, { erro: (err as Error).message });
  }
});
