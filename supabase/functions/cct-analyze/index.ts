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

const MODEL = 'google/gemini-2.5-flash';
const JSON_FIELDS = [
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
] as const;

const fileKindWeight = (kind?: string) => {
  const value = (kind || '').toLowerCase();
  if (value === 'principal') return 0;
  if (value === 'aditivo') return 1;
  return 2;
};

const parseJsonFromAi = (content: unknown) => {
  const raw = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part: any) => part?.text || '').join('\n')
      : '';
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Resposta da IA não veio em JSON válido');
  }
};

const hasUsefulExtraction = (parsed: any) => {
  if (!parsed || typeof parsed !== 'object') return false;
  return JSON_FIELDS.some((field) => {
    const value = parsed[field];
    if (!value || typeof value !== 'object') return false;
    return JSON.stringify(value) !== '{}';
  }) || Array.isArray(parsed.dp_attention_points) && parsed.dp_attention_points.length > 0;
};

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

    fileList = [...fileList].sort((a, b) => fileKindWeight(a.file_kind) - fileKindWeight(b.file_kind) || (a.order_index ?? 0) - (b.order_index ?? 0));

    // Marca como em processamento
    await supabase.from('cct_analyses').update({ status: 'em_analise', ai_model: MODEL, ai_version: 'raio-x-v3-por-arquivo', ai_summary: 'Análise em andamento...' }).eq('id', analysis_id);

    // Executa análise em background para evitar timeout de 150s
    const runAnalysis = async () => {
      try {
        console.log('[cct-analyze] bg start', { analysis_id, files: fileList.length });
        const callGateway = async (parts: any[], label: string, hasPdf = true) => {
          console.log('[cct-analyze] chamando gateway', { label, parts: parts.length, model: MODEL, hasPdf });
          let lastStatus = 0;
          let lastText = '';
          for (let attempt = 1; attempt <= 3; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort('timeout'), 135000);
            try {
              const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
                signal: controller.signal,
                body: JSON.stringify({
                  model: MODEL,
                  messages: [
                    { role: 'system', content: RAIO_X_SYSTEM },
                    { role: 'user', content: parts },
                  ],
                  response_format: { type: 'json_object' },
                }),
              });
              clearTimeout(timeout);
              console.log('[cct-analyze] tentativa', { label, attempt, status: aiResp.status });
              if (aiResp.ok) {
                const aiJson = await aiResp.json();
                const parsed = parseJsonFromAi(aiJson?.choices?.[0]?.message?.content || '');
                if (!hasUsefulExtraction(parsed)) throw new Error('IA retornou JSON vazio');
                return parsed;
              }
              lastStatus = aiResp.status;
              lastText = await aiResp.text();
              console.warn('[cct-analyze] falha tentativa', { label, attempt, status: lastStatus, detail: lastText.slice(0, 240) });
              if (![429, 502, 503, 504].includes(aiResp.status)) break;
            } catch (err: any) {
              clearTimeout(timeout);
              lastStatus = err?.name === 'AbortError' ? 504 : 500;
              lastText = err?.message || String(err);
              console.warn('[cct-analyze] exceção tentativa', { label, attempt, detail: lastText.slice(0, 240) });
            }
            await new Promise((r) => setTimeout(r, 2500 * attempt));
          }
          throw new Error(`Falha ao analisar ${label}: ${lastStatus} ${lastText.slice(0, 240)}`);
        };

        const buildPartsForFile = async (f: any) => {
          const lower = (f.file_name || '').toLowerCase();
          const mime = f.mime_type || (lower.endsWith('.pdf') ? 'application/pdf' : (lower.match(/\.(png|jpe?g|webp|heic)$/) ? `image/${lower.split('.').pop()}` : 'application/octet-stream'));
          const { data: signed, error: sErr } = await supabase.storage.from('cct-docs').createSignedUrl(f.file_path, 3600);
          if (sErr || !signed?.signedUrl) throw new Error(`Falha ao gerar link temporário para ${f.file_name}: ${sErr?.message || 'sem URL'}`);
          const parts: any[] = [{ type: 'text', text: `Extraia somente do arquivo abaixo (${f.file_kind || 'documento'}: ${f.file_name}) os dados de CCT no JSON estrito do schema. Se este arquivo for aditivo, destaque o que ele altera.\n\n${RAIO_X_SCHEMA_HINT}` }];
          if (mime.startsWith('image/')) {
            parts.push({ type: 'image_url', image_url: { url: signed.signedUrl } });
          } else {
            parts.push({ type: 'file', file: { filename: f.file_name, file_data: signed.signedUrl } });
          }
          return { parts, hasPdf: !mime.startsWith('image/') };
        };

        const perFileResults: any[] = [];
        for (const f of fileList) {
          try {
            await supabase.from('cct_analyses').update({ ai_summary: `Analisando ${f.file_name}...` }).eq('id', analysis_id);
            const { parts, hasPdf } = await buildPartsForFile(f);
            const extraction = await callGateway(parts, f.file_name || f.file_path, hasPdf);
            perFileResults.push({ file_name: f.file_name, file_kind: f.file_kind, extraction });
          } catch (fileErr: any) {
            console.error('[cct-analyze] erro arquivo', f.file_name, fileErr?.message || fileErr);
            await supabase.from('cct_audit_log').insert({ cct_analysis_id: analysis_id, action: 'ai_file_extract_error', metadata: { file_name: f.file_name, detail: fileErr?.message || String(fileErr) } });
          }
        }

        if (!perFileResults.length) {
          const msg = 'Não foi possível extrair dados dos PDFs. Tente reenviar arquivos menores ou em PDF pesquisável.';
          await supabase.from('cct_analyses').update({ status: 'erro', ai_summary: msg }).eq('id', analysis_id);
          await supabase.from('cct_audit_log').insert({ cct_analysis_id: analysis_id, action: 'ai_extract_error', metadata: { detail: msg, files: fileList.length } });
          return;
        }

        let parsed: any = perFileResults[0].extraction;
        if (perFileResults.length > 1) {
          try {
            await supabase.from('cct_analyses').update({ ai_summary: 'Consolidando CCT principal e termos aditivos...' }).eq('id', analysis_id);
            parsed = await callGateway([{ type: 'text', text: `Consolide as extrações abaixo em um único Raio-X final de CCT. A CCT principal é a base; termos aditivos/erratas posteriores sobrescrevem regras anteriores. Devolva JSON estrito seguindo exatamente este schema:\n\n${RAIO_X_SCHEMA_HINT}\n\nExtrações por arquivo, já em ordem de prioridade (principal primeiro, aditivos depois):\n${JSON.stringify(perFileResults)}` }], 'consolidação final', false);
          } catch (mergeErr: any) {
            console.warn('[cct-analyze] consolidação falhou, usando extração principal', mergeErr?.message || mergeErr);
            const principal = perFileResults.find((r) => r.file_kind === 'principal');
            parsed = principal?.extraction || perFileResults[0].extraction;
            parsed.dp_attention_points = Array.isArray(parsed.dp_attention_points) ? parsed.dp_attention_points : [];
            parsed.dp_attention_points.push('Atenção: a consolidação automática dos aditivos falhou; revise os arquivos anexados manualmente.');
          }
        }

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
          metadata: { model: MODEL, files: fileList.length, extracted_files: perFileResults.length },
        });
      } catch (bgErr: any) {
        console.error('bg analysis error', bgErr);
        await supabase.from('cct_analyses').update({ status: 'erro', ai_summary: 'Erro na análise: ' + (bgErr?.message || 'desconhecido') }).eq('id', analysis_id);
      }
      console.log('[cct-analyze] bg done', analysis_id);
    };

    // Mantém o isolate vivo enquanto a análise roda
    const bgPromise = runAnalysis();
    // @ts-ignore EdgeRuntime global no Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      // @ts-ignore
      EdgeRuntime.waitUntil(bgPromise);
      console.log('[cct-analyze] EdgeRuntime.waitUntil registrado');
    } else {
      console.warn('[cct-analyze] EdgeRuntime.waitUntil indisponível — promessa solta');
    }

    return new Response(JSON.stringify({ ok: true, status: 'processing', message: 'Análise iniciada em segundo plano. Acompanhe pelo status da CCT.' }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('cct-analyze error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});