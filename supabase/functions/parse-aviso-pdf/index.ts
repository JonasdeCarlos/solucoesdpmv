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
Para vencimento que tenha "Limite", devolva o texto completo (ex.: "22/06/2026 - Limite 24/05/2026").

REGRAS CRÍTICAS DE VINCULAÇÃO EMPRESA × LINHAS (siga RIGOROSAMENTE):
1. Cada linha de funcionário PERTENCE EXCLUSIVAMENTE à última empresa declarada acima dela ("Empresa: CODIGO - NOME" + "CNPJ:") DENTRO DO MESMO BLOCO VISUAL.
2. Os blocos são delimitados por LINHAS HORIZONTAIS SEPARADORAS (filetes/réguas) e/ou pelo cabeçalho "Empresa:/CNPJ:". JAMAIS atribua uma linha à empresa anterior ou posterior se houver uma linha separadora ou um novo cabeçalho "Empresa:" entre eles.
3. QUEBRAS DE PÁGINA: se uma página inicia sem repetir "Empresa:/CNPJ:", as linhas continuam pertencendo à última empresa do bloco anterior — APENAS até encontrar uma nova linha separadora ou um novo cabeçalho "Empresa:". Se a página repetir o cabeçalho, use o cabeçalho da página atual.
4. IGNORE textos de cabeçalho/rodapé como "RELAÇÃO DE VENCIMENTOS", "Página X de Y", data/hora de emissão, números de página, e nomes de colunas ("Código", "Funcionário", "Motivo", "Vencimento", "Limite").
5. Se houver dúvida sobre a qual empresa uma linha pertence, NÃO inclua a linha (prefira omitir a inventar). Reporte apenas o que estiver inequivocamente dentro de um bloco de empresa.
6. Para a MESMA empresa que aparece várias vezes (continuação em outra página), MESCLE as linhas dentro do MESMO objeto de empresa no resultado — não duplique a empresa.
7. Preserve o NOME e o CNPJ exatamente como aparecem no cabeçalho "Empresa:/CNPJ:" — nunca pegue texto de cabeçalho de colunas ou linhas separadoras como nome.`;

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

    const buildBody = (model: string) => JSON.stringify({
      model,
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
    });
    // Tenta gemini-2.5-flash; em 502/503/504/429 cai para gemini-2.5-pro como fallback.
    // Cada tentativa tem timeout de 60s para evitar load eterno.
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: 'google/gemini-2.5-flash', delayMs: 0 },
      { model: 'google/gemini-2.5-flash', delayMs: 2000 },
      { model: 'google/gemini-2.5-pro', delayMs: 0 },
    ];
    let aiResp: Response | null = null;
    let lastErrText = '';
    let lastStatus = 0;
    for (let i = 0; i < attempts.length; i++) {
      const { model, delayMs } = attempts[i];
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 60_000);
      try {
        aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: buildBody(model),
          signal: ctrl.signal,
        });
      } catch (err) {
        lastErrText = err instanceof Error ? err.message : String(err);
        lastStatus = 504;
        console.warn(`AI gateway tentativa ${i + 1} (${model}) falhou: ${lastErrText}`);
        aiResp = null;
        continue;
      } finally {
        clearTimeout(to);
      }
      if (aiResp.ok) break;
      lastStatus = aiResp.status;
      if (![502, 503, 504, 429].includes(aiResp.status)) break;
      lastErrText = await aiResp.text().catch(() => '');
      console.warn(`AI gateway ${aiResp.status} tentativa ${i + 1} (${model}): ${lastErrText.slice(0, 200)}`);
      aiResp = null;
    }

    if (!aiResp || !aiResp.ok) {
      const txt = aiResp ? await aiResp.text().catch(() => lastErrText) : lastErrText;
      const status = aiResp?.status ?? lastStatus ?? 503;
      console.error('AI error', status, txt);
      const userMsg = status === 503 || status === 502 || status === 504
        ? 'O serviço de IA está temporariamente indisponível. Aguarde alguns minutos e tente novamente.'
        : status === 429
          ? 'Limite de requisições da IA atingido. Aguarde alguns segundos e tente novamente.'
          : status === 402
            ? 'Créditos de IA esgotados. Adicione créditos para continuar.'
            : `Falha no serviço de IA (${status}).`;
      const respStatus = status === 402 || status === 429 ? status : 503;
      return new Response(JSON.stringify({ error: userMsg, detail: txt, upstream_status: status }), { status: respStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
