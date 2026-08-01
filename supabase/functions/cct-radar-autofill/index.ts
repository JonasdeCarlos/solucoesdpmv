import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extrairCnpjs(texto: string): string[] {
  const limpo = texto.replace(/\D/g, '');
  const encontrados: string[] = [];
  for (let i = 0; i + 13 < limpo.length; i++) {
    const slice = limpo.slice(i, i + 14);
    if (/^\d{14}$/.test(slice)) {
      const cnpj = `${slice.slice(0, 2)}.${slice.slice(2, 5)}.${slice.slice(5, 8)}/${slice.slice(8, 12)}-${slice.slice(12, 14)}`;
      if (!encontrados.includes(cnpj)) encontrados.push(cnpj);
    }
  }
  return encontrados;
}

function extrairUrls(texto: string): string[] {
  const re = /https?:\/\/[^\s<>"'\)\]\}]+/gi;
  const matches = texto.match(re) || [];
  return Array.from(new Set(matches)).filter((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase();
      return !['mte.gov.br', 'gov.br', 'sistemas.mte.gov.br'].some((h) => host.includes(h));
    } catch {
      return false;
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: ccts, error } = await admin
      .from('client_ccts')
      .select('id, sindicato, union_base, uf, numero_registro_mte, cct_analysis_id, radar_site_oficial, radar_cnpjs, radar_termos, radar_mediador_registro, radar_enabled')
      .is('deleted_at', null);
    if (error) throw error;

    const atualizados: any[] = [];

    for (const c of (ccts || []) as any[]) {
      if (!c.cct_analysis_id) continue;

      const { data: analise } = await admin
        .from('cct_analyses')
        .select('ai_summary, extracted_clauses, numero_registro_mte')
        .eq('id', c.cct_analysis_id)
        .maybeSingle();

      const textos: string[] = [];
      if (analise?.ai_summary) textos.push(String(analise.ai_summary));
      if (analise?.extracted_clauses) textos.push(JSON.stringify(analise.extracted_clauses));

      const texto = textos.join('\n');

      const cnpjs = extrairCnpjs(texto);
      const urls = extrairUrls(texto);
      const siteOficial = c.radar_site_oficial || urls[0] || null;
      const mediador = c.radar_mediador_registro || analise?.numero_registro_mte || c.numero_registro_mte || null;
      const ano = new Date().getFullYear();
      const termosPadrao = [
        `"${c.sindicato || ''}" convenção coletiva ${ano} ${c.uf || ''} vigência`,
        `"${c.sindicato || ''}" termo aditivo convenção coletiva ${ano}`,
      ];
      const termosExistentes: string[] = Array.isArray(c.radar_termos) ? c.radar_termos : [];
      const termos = Array.from(new Set([...termosPadrao, ...termosExistentes])).filter(Boolean);

      const update: any = {
        radar_site_oficial: siteOficial,
        radar_cnpjs: cnpjs.length ? cnpjs : c.radar_cnpjs || [],
        radar_termos: termos,
        radar_mediador_registro: mediador,
        radar_enabled: c.radar_enabled !== false,
      };

      const { data: upd, error: updErr } = await admin.from('client_ccts').update(update).eq('id', c.id).select('*').single();
      if (!updErr && upd) atualizados.push(upd);
    }

    return new Response(JSON.stringify({ ok: true, atualizados: atualizados.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
