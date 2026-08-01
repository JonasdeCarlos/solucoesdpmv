import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEDIADOR_URL = 'http://www3.mte.gov.br/sistemas/mediador/ConsultarInstColetivo';

type Candidate = {
  source_type: 'oficial' | 'nao_oficial';
  source_name: string;
  source_url: string;
  title: string;
  snippet: string;
};

async function buscaDuckDuckGo(query: string): Promise<Candidate[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarCCT/1.0)' },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Candidate[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 12) {
      const url = decodeURIComponent((m[1].match(/uddg=([^&]+)/)?.[1]) || m[1]);
      const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      const oficial = /(gov\.br|mte\.gov\.br|mediador|sindical)/i.test(url);
      out.push({
        source_type: oficial && /gov\.br/i.test(url) ? 'oficial' : 'nao_oficial',
        source_name: new URL(url.startsWith('http') ? url : `https://${url}`).hostname,
        source_url: url,
        title: strip(m[2]),
        snippet: strip(m[3]).slice(0, 600),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function buscaMediador(sindicato: string): Promise<Candidate[]> {
  try {
    const r = await fetch(`${MEDIADOR_URL}`, { method: 'GET', signal: AbortSignal.timeout(12000) });
    const ok = r.ok;
    // O Mediador exige sessão/captcha para consulta programática: registramos o ponto oficial de conferência.
    return [{
      source_type: 'oficial',
      source_name: 'Sistema Mediador (MTE)',
      source_url: MEDIADOR_URL,
      title: `Consulta oficial no Sistema Mediador — ${sindicato}`,
      snippet: ok
        ? 'Fonte oficial disponível. A consulta detalhada exige validação (captcha) no portal — confirme número de registro, CNPJs participantes e vigência diretamente no Mediador.'
        : 'Portal do Mediador indisponível no momento da varredura. Reconfira manualmente.',
    }];
  } catch {
    return [];
  }
}

// Lê o site oficial do sindicato cadastrado na CCT e devolve trechos relevantes.
async function buscaSiteOficial(url: string, sindicato: string): Promise<Candidate[]> {
  if (!url) return [];
  try {
    const alvo = url.startsWith('http') ? url : `https://${url}`;
    const r = await fetch(alvo, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarCCT/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const html = await r.text();
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [{
      source_type: 'oficial',
      source_name: `Site oficial — ${new URL(alvo).hostname}`,
      source_url: alvo,
      title: `Site oficial do sindicato — ${sindicato}`,
      snippet: texto.slice(0, 4000),
    }];
  } catch {
    return [];
  }
}

async function avaliarComIA(ctx: any, candidatos: Candidate[]) {
  const KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!KEY || candidatos.length === 0) return [];
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Você é analista de CCT. Avalie se cada resultado de busca corresponde a uma NOVA convenção coletiva (ou termo aditivo) do sindicato/base informados, posterior à vigência atual.
Regras: NUNCA invente número de registro, CNPJ ou vigência — só extraia se estiver no título/trecho. Se a evidência for fraca, confidence baixa. Descarte resultados irrelevantes.`,
        },
        {
          role: 'user',
          content: `Contexto da CCT vigente:\n${JSON.stringify(ctx)}\n\nResultados:\n${JSON.stringify(candidatos)}`,
        },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'registrar',
          parameters: {
            type: 'object',
            properties: {
              achados: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source_url: { type: 'string' },
                    finding_type: { type: 'string', enum: ['nova_cct', 'termo_aditivo'] },
                    title: { type: 'string' },
                    numero_registro_mte: { type: 'string' },
                    vigencia_inicio: { type: 'string' },
                    vigencia_fim: { type: 'string' },
                    cnpjs: { type: 'array', items: { type: 'string' } },
                    evidencias: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    notas: { type: 'string' },
                    relevante: { type: 'boolean' },
                  },
                  required: ['source_url', 'finding_type', 'title', 'evidencias', 'confidence', 'relevante'],
                },
              },
            },
            required: ['achados'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'registrar' } },
    }),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  try { return JSON.parse(args || '{}').achados || []; } catch { return []; }
}

async function enviarEmail(emails: string[], assunto: string, texto: string) {
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY || emails.length === 0) return { enviado: false, motivo: RESEND_KEY ? 'sem_destinatarios' : 'sem_resend_key' };
  const from = Deno.env.get('CCT_NOTIFY_FROM') || 'Radar CCT <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: emails, subject: assunto, text: texto }),
  });
  return { enviado: r.ok, motivo: r.ok ? null : await r.text() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const onlyCctId: string | null = body?.client_cct_id ?? null;
    const notify: boolean = body?.notify !== false;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cfgRows } = await admin.from('cct_radar_settings').select('*').limit(1);
    const cfg = cfgRows?.[0] || { emails: [], alert_days_before: 60 };
    const limite = new Date(Date.now() + (cfg.alert_days_before ?? 60) * 86400000).toISOString().slice(0, 10);

    let q = admin
      .from('client_ccts')
      .select('id, client_id, sindicato, union_base, uf, validity_end, cct_analysis_id, is_active, deleted_at, clientes:client_id(nome)')
      .is('deleted_at', null);
    if (onlyCctId) q = q.eq('id', onlyCctId);
    else q = q.or(`validity_end.lte.${limite},validity_end.is.null`);
    const { data: ccts, error } = await q;
    if (error) throw error;

    const alvo = (ccts || []).filter((c: any) => c.is_active !== false).slice(0, 15);
    const novos: any[] = [];

    for (const c of alvo as any[]) {
      const sind = c.sindicato || '';
      if (!sind) continue;
      const ano = new Date().getFullYear();
      const [oficial, web, aditivos] = await Promise.all([
        buscaMediador(sind),
        buscaDuckDuckGo(`"${sind}" convenção coletiva ${ano} ${c.uf || ''} vigência`),
        buscaDuckDuckGo(`"${sind}" termo aditivo convenção coletiva ${ano}`),
      ]);
      const candidatos = [...oficial, ...web, ...aditivos];
      const achados = await avaliarComIA(
        { sindicato: sind, base: c.union_base, uf: c.uf, vigencia_fim_atual: c.validity_end },
        candidatos,
      );

      for (const a of achados as any[]) {
        if (!a.relevante) continue;
        const orig = candidatos.find((x) => x.source_url === a.source_url);
        const { data: existente } = await admin
          .from('cct_radar_findings')
          .select('id')
          .eq('client_cct_id', c.id)
          .eq('source_url', a.source_url)
          .maybeSingle();
        if (existente) continue;
        const { data: ins } = await admin.from('cct_radar_findings').insert({
          client_cct_id: c.id,
          client_id: c.client_id,
          cct_analysis_id: c.cct_analysis_id,
          finding_type: a.finding_type,
          source_type: orig?.source_type || 'nao_oficial',
          source_name: orig?.source_name || null,
          source_url: a.source_url,
          title: a.title,
          numero_registro_mte: a.numero_registro_mte || null,
          vigencia_inicio: /^\d{4}-\d{2}-\d{2}$/.test(a.vigencia_inicio || '') ? a.vigencia_inicio : null,
          vigencia_fim: /^\d{4}-\d{2}-\d{2}$/.test(a.vigencia_fim || '') ? a.vigencia_fim : null,
          cnpjs: a.cnpjs || [],
          evidence: (a.evidencias || []).map((t: string) => ({ trecho: t, url: a.source_url })),
          confidence: a.confidence ?? null,
          ai_notes: a.notas || null,
          status: 'pendente',
        }).select('*').single();
        if (ins) novos.push({ ...ins, cliente: (c.clientes as any)?.nome, sindicato: sind });
      }
    }

    let email: any = { enviado: false, motivo: 'sem_novidades' };
    if (notify && novos.length > 0) {
      const linhas = novos.map((n) =>
        `• [${n.source_type === 'oficial' ? 'FONTE OFICIAL' : '⚠ FONTE NÃO OFICIAL'}] ${n.finding_type === 'termo_aditivo' ? 'Termo aditivo' : 'Nova CCT'} — ${n.cliente || ''} / ${n.sindicato}\n  ${n.title}\n  ${n.source_url}\n  Confiança: ${n.confidence ?? '—'}`,
      ).join('\n\n');
      email = await enviarEmail(
        cfg.emails || [],
        `[Radar CCT] ${novos.length} possível(is) atualização(ões) aguardando aprovação`,
        `Radar de CCT — varredura automática\n\n${linhas}\n\nTodos os achados aguardam APROVAÇÃO no sistema (Gestão de CCT › Radar).`,
      );
    }

    await admin.from('cct_radar_settings').update({ last_run_at: new Date().toISOString() }).eq('id', cfg.id ?? '00000000-0000-0000-0000-000000000000');

    return new Response(JSON.stringify({ ok: true, verificadas: alvo.length, novos: novos.length, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
