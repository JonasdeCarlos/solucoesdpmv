import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente jurídico-trabalhista que extrai feriados e pontos facultativos de decretos municipais/estaduais e Convenções Coletivas (CCT) brasileiras.
Responda SEMPRE em JSON estrito no formato:
{
  "items": [
    {
      "data": "YYYY-MM-DD",
      "nome": "string",
      "tipo": "distrital|municipal|estadual|sindical|ponto_facultativo|interno",
      "is_holiday": true|false,
      "is_optional": true|false,
      "scope_type": "todos|uf|municipio|empresa|cct",
      "uf": "MG" | null,
      "municipio": "Camanducaia" | null,
      "confidence": 0.0-1.0,
      "evidence_text": "trecho literal do documento que evidencia a data"
    }
  ]
}
Regras:
- Use o ano do documento se o texto disser apenas dia/mês.
- Marque is_optional=true quando o documento citar "ponto facultativo".
- Use confidence < 0.7 quando houver dúvida real.
- NÃO inclua feriados nacionais óbvios (1º de janeiro, 25 de dezembro etc.) a menos que o documento os altere.
- Não invente datas que não aparecem no texto.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { source_doc_id } = await req.json();
    if (!source_doc_id) return new Response(JSON.stringify({ error: 'source_doc_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: doc, error: docErr } = await supabase
      .from('holiday_source_documents').select('*').eq('id', source_doc_id).single();
    if (docErr || !doc) throw new Error('Documento não encontrado');

    // Download file
    const { data: file, error: dlErr } = await supabase.storage.from('feriados-docs').download(doc.file_path);
    if (dlErr || !file) throw new Error('Falha ao baixar arquivo');

    let text = '';
    let isPdf = false;
    if ((doc.file_name as string).toLowerCase().endsWith('.pdf')) {
      isPdf = true;
      const buf = new Uint8Array(await file.arrayBuffer());
      try {
        const pdf = await getDocumentProxy(buf);
        const { text: pages } = await extractText(pdf, { mergePages: false });
        const arr = Array.isArray(pages) ? pages : [pages as string];
        text = arr.slice(0, 40).join('\n');
      } catch (e) {
        console.warn('unpdf failed, will fallback to vision', e);
        text = '';
      }
    } else {
      text = await file.text();
    }

    const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    const goodText = text && text.length > 500 && letters > 100;

    // Build messages: prefer text; if PDF text is poor, send PDF as inline file to Gemini vision
    const baseUserPrompt = `Tipo do documento: ${doc.doc_type}
UF: ${doc.uf || ''}
Município: ${doc.municipio || ''}
Ano referência: ${doc.ano || ''}

Extraia TODOS os feriados e pontos facultativos encontrados no documento. Responda apenas com o JSON no formato especificado.`;

    let userMessage: any;
    if (goodText) {
      userMessage = { role: 'user', content: `${baseUserPrompt}\n\nTEXTO:\n${text.slice(0, 30000)}` };
    } else if (isPdf) {
      // Send PDF directly to Gemini via OpenAI-compatible file part
      const buf = new Uint8Array(await (await supabase.storage.from('feriados-docs').download(doc.file_path)).data!.arrayBuffer());
      let b64 = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        b64 += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
      }
      b64 = btoa(b64);
      const dataUrl = `data:application/pdf;base64,${b64}`;
      userMessage = {
        role: 'user',
        content: [
          { type: 'text', text: baseUserPrompt },
          { type: 'file', file: { filename: doc.file_name, file_data: dataUrl } },
        ],
      };
    } else {
      throw new Error('Não foi possível extrair conteúdo do documento');
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          userMessage,
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`AI gateway: ${aiResp.status} ${errText}`);
    }
    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Insert extraction items
    const rows = items
      .filter((it: any) => it && it.data && it.nome)
      .map((it: any) => ({
        source_doc_id,
        data: it.data,
        nome: String(it.nome).slice(0, 200),
        tipo: it.tipo || (doc.doc_type === 'cct' ? 'sindical' : (doc.doc_type === 'decreto_estadual' ? 'estadual' : 'municipal')),
        is_holiday: it.is_holiday !== false,
        is_optional: !!it.is_optional,
        scope_type: it.scope_type || (doc.doc_type === 'cct' ? 'cct' : (doc.municipio ? 'municipio' : 'uf')),
        uf: it.uf || doc.uf || null,
        municipio: it.municipio || doc.municipio || null,
        cct_id: doc.cct_id || null,
        confidence: Number(it.confidence ?? 0.5),
        evidence_text: String(it.evidence_text || '').slice(0, 1000),
        status: 'pendente',
      }));

    if (rows.length) {
      await supabase.from('holiday_extraction_items').insert(rows);
    }

    await supabase.from('holiday_source_documents').update({
      status: 'processado',
      total_extracted: rows.length,
      extraction_json: parsed,
    }).eq('id', source_doc_id);

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-holidays-doc error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});