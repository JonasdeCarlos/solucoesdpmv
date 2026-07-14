import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAIO_X_SYSTEM = `Você é analista sênior de Departamento Pessoal especializado em Convenções Coletivas de Trabalho (CCT).
Sua tarefa é ler integralmente os documentos anexados (CCT principal + eventuais termos aditivos, erratas ou anexos) e devolver um Raio-X estruturado em JSON estrito.

REGRAS CRÍTICAS:
- Nunca invente. Quando não localizar a informação nos documentos, use exatamente a string "Não identificado no documento".
- Considere todos os arquivos como partes de uma mesma CCT: aditivos SOBRESCREVEM cláusulas anteriores; sempre indique quando houver alteração por aditivo.
- Cite o trecho de origem em "source_snippet" (máx. 300 caracteres) e, quando possível, page_number.
- Confidence: alto, medio ou baixo por bloco.
- Todo texto em português do Brasil.

Devolva JSON com o schema exato solicitado, sem markdown, sem \`\`\`.`;

const RAIO_X_SCHEMA_HINT = `{
  "identification": {"titulo":"","numero_registro":"","ano_base":"","data_base":"","vigencia_inicial":"","vigencia_final":"","data_assinatura":"","local_assinatura":"","confidence":"","source_snippet":""},
  "unions": {"sindicato_laboral":"","sindicato_patronal":"","cnpj_laboral":"","cnpj_patronal":"","signatarios":[],"confidence":"","source_snippet":""},
  "territorial_base": {"municipios":[],"uf":"","descricao":"","excecoes":"","confidence":"","source_snippet":""},
  "professional_classes": {"categoria":"","funcoes":[],"empresas_abrangidas":"","atividades":"","cnaes":[],"exclusoes":"","confidence":"","source_snippet":""},
  "economic_clauses": {"piso_salarial":[{"funcao":"","valor":""}],"reajuste_percentual":"","reajuste_data":"","compensacao_antecipacoes":"","salarios_normativos":[],"diferencas_retroativas":"","prazo_diferencas":"","confidence":"","source_snippet":""},
  "benefits_summary": {"beneficios":[{"nome":"","valor":"","periodicidade":"","elegiveis":"","condicoes":"","desconto_empregado":"","prazo":"","penalidade":"","observacoes":"","page_number":null}],"confidence":""},
  "journey_rules": {"semanal":"","diaria":"","escalas":"","banco_horas":"","compensacao":"","intervalos":"","domingos_feriados":"","escala_12x36":"","ponto":"","tolerancias":"","confidence":"","source_snippet":""},
  "overtime_rules": {"he_percentual":"","he_domingos":"","he_feriados":"","adicional_noturno":"","hora_noturna_reduzida":"","insalubridade":"","periculosidade":"","gratificacoes":"","regras_especiais":"","confidence":"","source_snippet":""},
  "vacation_absence": {"regras_ferias":"","comunicacao":"","ferias_coletivas":"","abono_faltas":"","estabilidades":"","atestados":"","licencas":"","retorno_trabalho":"","confidence":"","source_snippet":""},
  "admission_termination": {"experiencia":"","homologacao":"","aviso_previo":"","prazos_especiais":"","estabilidades":"","documentos":"","multas_atraso":"","dispensa_coletiva":"","confidence":"","source_snippet":""},
  "union_obligations": {"contribuicao_assistencial":"","contribuicao_confederativa":"","mensalidade":"","taxas_patronais":"","direito_oposicao":"","prazos_recolhimento":"","guias":"","penalidades":"","confidence":"","source_snippet":""},
  "health_safety": {"exames":"","uniformes":"","epis":"","treinamentos":"","cipa":"","pcmso":"","pgr":"","condicoes":"","atividades_risco":"","confidence":"","source_snippet":""},
  "penalties": {"multas":[{"hipotese":"","valor":"","destinatario":"","prazo_regularizacao":""}],"confidence":"","source_snippet":""},
  "dp_attention_points": ["Impacto na folha: ...","Impacto em admissões: ...","Impacto em rescisões: ...","Impacto em férias: ...","Impacto em benefícios: ...","Rubricas a configurar: ...","Alertas ao cliente: ...","Checklist de fechamento: ..."],
  "ai_summary": "Resumo executivo em 3-5 frases claras, direcionado ao gestor de DP.",
  "confidence_score": 0.85
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'analysis_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Carrega análise + todos os arquivos
    const { data: analysis, error: aErr } = await supabase
      .from('cct_analyses').select('*').eq('id', analysis_id).maybeSingle();
    if (aErr || !analysis) {
      return new Response(JSON.stringify({ error: 'Análise não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: files } = await supabase
      .from('cct_analysis_files').select('*').eq('cct_analysis_id', analysis_id).order('order_index');
    let fileList: any[] = files || [];

    // Compatibilidade: se não houver linhas em cct_analysis_files mas houver original_file_path na análise, usa esse
    if ((!fileList || fileList.length === 0) && analysis.original_file_path) {
      fileList = [{
        file_path: analysis.original_file_path,
        file_name: analysis.original_file_name || 'documento.pdf',
        file_kind: 'principal',
      }];
    }

    if (!fileList || fileList.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo anexado à CCT' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Marca como em processamento
    await supabase.from('cct_analyses').update({ status: 'em_analise', ai_model: 'google/gemini-2.5-pro', ai_version: 'raio-x-v1' }).eq('id', analysis_id);

    // Executa análise em background para evitar timeout de 150s
    const runAnalysis = async () => {
      try {
        const parts: any[] = [];
        parts.push({ type: 'text', text: `Analise ${fileList.length} arquivo(s) desta CCT (principal + aditivos, se houver) e devolva o Raio-X em JSON estrito seguindo exatamente este schema:\n\n${RAIO_X_SCHEMA_HINT}\n\nRegras: nunca invente; aditivos sobrescrevem a CCT anterior; use "Não identificado no documento" quando ausente.` });

        for (const f of fileList) {
          const { data: signed, error: sErr } = await supabase.storage.from('cct-docs').createSignedUrl(f.file_path, 3600);
          if (sErr || !signed?.signedUrl) continue;
          const lower = (f.file_name || '').toLowerCase();
          const mime = f.mime_type || (lower.endsWith('.pdf') ? 'application/pdf' : (lower.match(/\.(png|jpe?g|webp|heic)$/) ? `image/${lower.split('.').pop()}` : 'application/octet-stream'));
          parts.push({ type: 'text', text: `\n--- Arquivo: ${f.file_name} (${f.file_kind}) ---` });
          if (mime.startsWith('image/')) {
            parts.push({ type: 'image_url', image_url: { url: signed.signedUrl } });
          } else {
            parts.push({ type: 'file', file: { filename: f.file_name, file_data: signed.signedUrl } });
          }
        }

        const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: RAIO_X_SYSTEM },
              { role: 'user', content: parts },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!aiResp.ok) {
          const errTxt = await aiResp.text();
          console.error('AI error', aiResp.status, errTxt);
          let msg = `Erro IA (${aiResp.status})`;
          if (aiResp.status === 429) msg = 'Limite de requisições atingido. Tente novamente em instantes.';
          if (aiResp.status === 402) msg = 'Créditos de IA esgotados. Adicione créditos ao workspace.';
          await supabase.from('cct_analyses').update({ status: 'erro', ai_summary: msg }).eq('id', analysis_id);
          await supabase.from('cct_audit_log').insert({ cct_analysis_id: analysis_id, action: 'ai_extract_error', metadata: { status: aiResp.status, detail: errTxt.slice(0, 500) } });
          return;
        }

        const aiJson = await aiResp.json();
        const content = aiJson?.choices?.[0]?.message?.content || '';
        let parsed: any = {};
        try { parsed = JSON.parse(content); } catch { parsed = {}; }

        const updates: any = {
          status: 'revisar',
          ai_summary: parsed.ai_summary || null,
          confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : null,
          identification: parsed.identification || {},
          unions: parsed.unions || {},
          territorial_base: parsed.territorial_base || {},
          professional_classes: parsed.professional_classes || {},
          economic_clauses: parsed.economic_clauses || {},
          benefits_summary: parsed.benefits_summary || {},
          journey_rules: parsed.journey_rules || {},
          overtime_rules: parsed.overtime_rules || {},
          vacation_absence: parsed.vacation_absence || {},
          admission_termination: parsed.admission_termination || {},
          union_obligations: parsed.union_obligations || {},
          health_safety: parsed.health_safety || {},
          penalties: parsed.penalties || {},
          dp_attention_points: Array.isArray(parsed.dp_attention_points) ? parsed.dp_attention_points : [],
          ocr_applied: true,
        };

        const { error: uErr } = await supabase.from('cct_analyses').update(updates).eq('id', analysis_id);
        if (uErr) {
          await supabase.from('cct_analyses').update({ status: 'erro', ai_summary: 'Falha ao salvar Raio-X: ' + uErr.message }).eq('id', analysis_id);
          return;
        }

        if (Array.isArray(parsed?.benefits_summary?.beneficios)) {
          await supabase.from('cct_benefits').delete().eq('cct_analysis_id', analysis_id);
          const rows = parsed.benefits_summary.beneficios
            .filter((b: any) => b && (b.nome || b.valor))
            .map((b: any) => ({
              cct_analysis_id: analysis_id,
              benefit_name: b.nome || 'Benefício',
              value_text: b.valor || null,
              periodicity: b.periodicidade || null,
              eligible_employees: b.elegiveis || null,
              conditions: b.condicoes || null,
              due_date_rule: b.prazo || null,
              penalty: b.penalidade || null,
              notes: b.observacoes || null,
              page_number: b.page_number ?? null,
            }));
          if (rows.length) await supabase.from('cct_benefits').insert(rows);
        }

        await supabase.from('cct_audit_log').insert({
          cct_analysis_id: analysis_id,
          action: 'ai_extract',
          metadata: { model: 'google/gemini-2.5-pro', files: fileList.length },
        });
      } catch (bgErr: any) {
        console.error('bg analysis error', bgErr);
        await supabase.from('cct_analyses').update({ status: 'erro', ai_summary: 'Erro na análise: ' + (bgErr?.message || 'desconhecido') }).eq('id', analysis_id);
      }
    };

    // @ts-ignore EdgeRuntime global no Supabase Edge Functions
    EdgeRuntime.waitUntil(runAnalysis());

    return new Response(JSON.stringify({ ok: true, status: 'processing', message: 'Análise iniciada em segundo plano. Acompanhe pelo status da CCT.' }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('cct-analyze error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});