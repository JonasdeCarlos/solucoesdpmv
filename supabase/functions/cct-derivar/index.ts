import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

const BLOCOS = [
  'identification',
  'unions',
  'territorial_base',
  'professional_classes',
  'economic_clauses',
  'benefits_summary',
  'journey_rules',
  'overtime_rules',
  'vacation_absence',
  'admission_termination',
  'union_obligations',
  'health_safety',
  'penalties',
];

const SYSTEM = `Você é analista de Departamento Pessoal. Recebe o Raio-X de uma CCT VIGENTE e um DOCUMENTO PARCIAL de alteração (circular, ata de assembleia, comunicado sindical, termo aditivo).
Sua tarefa: gerar a versão CONSOLIDADA da CCT aplicando SOMENTE os pontos expressamente mencionados no documento parcial, mantendo TODO o restante exatamente como está na CCT vigente.
Regras rígidas:
- NÃO invente e NÃO altere nada que o documento parcial não mencione.
- Retorne apenas os blocos que sofreram alteração (os demais serão mantidos automaticamente).
- Em cada bloco alterado, devolva o bloco COMPLETO já consolidado (parte antiga + parte nova).
- Liste as mudanças aplicadas com valor anterior e valor novo.
Responda EXCLUSIVAMENTE com JSON válido:
{"blocos_alterados":{"chave_do_bloco":{...}},"mudancas":[{"bloco":"chave","titulo":"...","anterior":"...","nova":"...","impacto":"..."}],"resumo":"texto curto","dp_attention_points":["..."]}`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function extractJson(txt: string): any {
  const clean = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(clean); } catch { /* continua */ }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* continua */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { base_analysis_id, finding_id, texto_alteracao, titulo } = await req.json();
    if (!base_analysis_id) return json(400, { error: 'Informe a CCT vigente que será atualizada.' });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json(500, { error: 'LOVABLE_API_KEY ausente' });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: base } = await supabase.from('cct_analyses').select('*').eq('id', base_analysis_id).maybeSingle();
    if (!base) return json(404, { error: 'CCT vigente não encontrada.' });

    let finding: any = null;
    if (finding_id) {
      const { data } = await supabase.from('cct_radar_findings').select('*').eq('id', finding_id).maybeSingle();
      finding = data;
    }

    const documentoParcial = [
      finding?.title ? `Título: ${finding.title}` : '',
      finding?.source_name ? `Origem: ${finding.source_name}` : '',
      finding?.source_url ? `Link: ${finding.source_url}` : '',
      finding?.finding_type ? `Tipo: ${finding.finding_type}` : '',
      finding?.vigencia_inicio || finding?.vigencia_fim ? `Vigência: ${finding?.vigencia_inicio || '—'} a ${finding?.vigencia_fim || '—'}` : '',
      Array.isArray(finding?.evidence) && finding.evidence.length
        ? `Evidências:\n${finding.evidence.map((e: any) => `- ${e?.trecho || JSON.stringify(e)}`).join('\n')}`
        : '',
      finding?.ai_notes ? `Notas: ${finding.ai_notes}` : '',
      texto_alteracao ? `Texto informado pelo usuário:\n${texto_alteracao}` : '',
    ].filter(Boolean).join('\n');

    if (!documentoParcial.trim()) return json(400, { error: 'Não há conteúdo de alteração para aplicar.' });

    const raioX: Record<string, unknown> = { titulo: base.title };
    for (const k of BLOCOS) raioX[k] = (base as any)[k] ?? null;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `CCT VIGENTE (Raio-X):\n${JSON.stringify(raioX).slice(0, 120000)}\n\nDOCUMENTO PARCIAL DE ALTERAÇÃO:\n${documentoParcial.slice(0, 30000)}`,
          },
        ],
        max_tokens: 8000,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      if (resp.status === 429) return json(429, { error: 'Limite de uso da IA atingido. Tente novamente em instantes.' });
      if (resp.status === 402) return json(402, { error: 'Créditos de IA esgotados. Adicione créditos no workspace.' });
      return json(502, { error: `Falha na IA (${resp.status}): ${detail.slice(0, 300)}` });
    }

    const aiJson = await resp.json();
    const parsed = extractJson(String(aiJson?.choices?.[0]?.message?.content || ''));
    if (!parsed) return json(422, { error: 'A IA não conseguiu consolidar a nova CCT. Tente novamente.' });

    const alterados = parsed.blocos_alterados && typeof parsed.blocos_alterados === 'object' ? parsed.blocos_alterados : {};
    const mudancas = Array.isArray(parsed.mudancas) ? parsed.mudancas : [];
    if (Object.keys(alterados).length === 0) {
      return json(422, { error: 'O documento não trouxe pontos que alterem a CCT vigente.' });
    }

    const novaLinha: Record<string, unknown> = {
      title: titulo || `${base.title || 'CCT'} — consolidada (${finding?.title || 'alteração parcial'})`,
      client_cct_id: base.client_cct_id,
      status: 'revisar',
      ocr_applied: true,
      ai_model: MODEL,
      confidence_score: finding?.confidence ?? null,
      parent_analysis_id: base.id,
      derived_from_finding_id: finding_id || null,
      derivation_type: 'parcial',
      derivation_changes: mudancas,
      ai_summary: String(parsed.resumo || '').trim() || base.ai_summary,
      dp_attention_points: Array.isArray(parsed.dp_attention_points) && parsed.dp_attention_points.length
        ? parsed.dp_attention_points
        : (base.dp_attention_points ?? []),
    };
    for (const k of BLOCOS) novaLinha[k] = (alterados as any)[k] ?? (base as any)[k] ?? null;

    const { data: nova, error: insErr } = await supabase.from('cct_analyses').insert(novaLinha).select('*').single();
    if (insErr) return json(500, { error: insErr.message });

    await supabase.from('cct_comparacoes').insert({
      analise_anterior_id: base.id,
      analise_nova_id: nova.id,
      resumo: String(parsed.resumo || '').trim() || null,
      resultado: { itens: mudancas.map((m: any) => ({ ...m, tipo: 'alterado' })), origem: 'derivacao', gerado_em: new Date().toISOString() },
    });

    if (finding_id) {
      await supabase.from('cct_radar_findings')
        .update({ review_notes: `CCT consolidada gerada automaticamente (${nova.id}).` })
        .eq('id', finding_id);
    }

    return json(200, { ok: true, analysis_id: nova.id, mudancas });
  } catch (err) {
    console.error('[cct-derivar]', err);
    return json(500, { error: err instanceof Error ? err.message : 'erro desconhecido' });
  }
});