import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function severityFromDays(d: number | null): { severity: string; type: string } {
  if (d == null) return { severity: 'baixa', type: 'sem_vigencia' };
  if (d < 0) return { severity: 'alta', type: 'vencida' };
  if (d <= 30) return { severity: 'alta', type: 'vencendo_30d' };
  if (d <= 90) return { severity: 'media', type: 'vencendo_90d' };
  return { severity: 'baixa', type: 'ok' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: ccts, error } = await supabase
      .from('client_ccts')
      .select('id, client_id, sindicato, validity_end, data_base, cct_analysis_id, is_active, deleted_at')
      .is('deleted_at', null);
    if (error) throw error;

    // Fecha alertas anteriores em aberto (regenera do zero)
    await supabase.from('cct_alerts').update({ status: 'substituido' }).eq('status', 'aberto');

    const now = Date.now();
    let created = 0;
    for (const c of (ccts || []) as any[]) {
      if (!c.is_active) continue;
      const end = c.validity_end ? new Date(c.validity_end).getTime() : null;
      const dias = end != null ? Math.ceil((end - now) / 86400000) : null;
      const info = severityFromDays(dias);
      if (info.type === 'ok') continue;
      const message = info.type === 'vencida'
        ? `CCT ${c.sindicato || ''} venceu há ${Math.abs(dias!)} dia(s).`
        : info.type === 'vencendo_30d'
          ? `CCT ${c.sindicato || ''} vence em ${dias} dia(s) — urgente.`
          : info.type === 'vencendo_90d'
            ? `CCT ${c.sindicato || ''} vence em ${dias} dia(s).`
            : `CCT ${c.sindicato || ''} sem vigência cadastrada.`;
      await supabase.from('cct_alerts').insert({
        cct_analysis_id: c.cct_analysis_id,
        client_cct_id: c.id,
        client_id: c.client_id,
        alert_type: info.type,
        severity: info.severity,
        due_date: c.validity_end || null,
        message,
        status: 'aberto',
      });
      created++;
    }

    return new Response(JSON.stringify({ ok: true, created, total: (ccts || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});