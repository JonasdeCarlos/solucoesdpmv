// Extrai dados estruturados de PDFs de "Relação de Vencimentos" usando Lovable AI.
// Recebe { file_path } no bucket 'aviso-pdfs', retorna { emission_date, emission_time, empresas:[...] }.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const SYSTEM_PROMPT = `Você é um extrator de dados de PDFs brasileiros de "RELAÇÃO DE VENCIMENTOS" do sistema da contabilidade.

O documento contém blocos repetidos no formato:
  Empresa: <CODIGO> - <NOME>
  CNPJ: <CNPJ formatado>
  (linhas) <COD_FUNCIONARIO> <NOME_FUNCIONARIO> <TIPO/MOTIVO> <DATA_VENCIMENTO ou "DATA - Limite DATA">

Sua tarefa é extrair TODOS os blocos e linhas do PDF inteiro e devolver APENAS via tool call. Não invente dados.
Datas devem permanecer no formato DD/MM/AAAA original.
Para vencimento que tenha "Limite", devolva o texto completo (ex.: "22/06/2026 - Limite 24/05/2026").`;

const TOOL = {
  type: 'function',
  function: {
    name: 'submit_avisos',
    description: 'Submete os avisos extraídos do PDF.',
    parameters: {
      type: 'object',
      properties: {
        emission_date: { type: 'string', description: 'Data de emissão DD/MM/AAAA, se houver no cabeçalho' },
        emission_time: { type: 'string', description: 'Hora HH:MM:SS, se houver' },
        empresas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              cnpj: { type: 'string' },
              linhas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    employee_code: { type: 'string' },
                    employee_name: { type: 'string' },
                    motivo: { type: 'string' },
                    vencimento_raw: { type: 'string' },
                  },
                  required: ['employee_code', 'employee_name', 'motivo', 'vencimento_raw'],
                  additionalProperties: false,
                },
              },
            },
            required: ['code', 'name', 'cnpj', 'linhas'],
            additionalProperties: false,
          },
        },
      },
      required: ['empresas'],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { file_path } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: 'file_path obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download PDF from storage
    const dl = await fetch(`${SUPABASE_URL}/storage/v1/object/aviso-pdfs/${file_path}`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    if (!dl.ok) {
      return new Response(JSON.stringify({ error: `Falha ao baixar PDF: ${dl.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const buf = new Uint8Array(await dl.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia todas as empresas e avisos deste PDF e chame a função submit_avisos.' },
              { type: 'file', file: { filename: 'relacao.pdf', file_data: `data:application/pdf;base64,${b64}` } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: 'submit_avisos' } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error('AI error', aiResp.status, txt);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return new Response(JSON.stringify({ error: `AI gateway: ${aiResp.status}`, detail: txt }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const aiJson = await aiResp.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ error: 'IA não retornou tool_call', ai: aiJson }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const args = JSON.parse(tc.function.arguments || '{}');
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('parse-aviso-pdf error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'erro' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
