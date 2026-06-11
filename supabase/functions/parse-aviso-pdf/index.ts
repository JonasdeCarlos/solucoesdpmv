import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

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

type ParsedPdf = {
  emission_date?: string;
  emission_time?: string;
  empresas: Array<{
    code: string;
    name: string;
    cnpj: string;
    linhas: Array<{ employee_code: string; employee_name: string; motivo: string; vencimento_raw: string }>;
  }>;
};

const normalize = (s: string) => (s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const toBase64 = (buf: Uint8Array) => {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
};

const MOTIVO_ROW_PATTERN = String.raw`(?:CONTRATO\s+(?:DE\s+)?EXPERI[ÊE]NCIA(?:\s+PRORROG[A-ZÀ-ÿ\s.]*)?|EXPERI[ÊE]NCIA(?:\s+PRORROG[A-ZÀ-ÿ\s.]*)?|AVISO\s+PR[ÉE]VIO(?:\s+DE\s+RESCIS[AÃ]O)?|MONITORAMENTO\s+DE\s+SA[ÚU]DE\s*-?\s*(?:ADMISSIONAL|PERI[ÓO]DICO)|VENCIMENTO\s+DE\s+2[ºO]?\s*F[ÉE]RIAS|RETORNO\s+DE\s+AFASTAMENTO\s+DE\s+DOEN[ÇC]A|PROGRAMA[CÇ][AÃ]O\s+DE\s+F[ÉE]RIAS|ENVIO\s+RESCIS[AÃ]O\s+ESOCIAL)`;

function addRowsFromChunk(company: ParsedPdf['empresas'][number], chunkText: string) {
  const clean = chunkText
    .replace(/\s+/g, ' ')
    .replace(/\b(?:Código|Codigo)\s+Funcion[áa]rio\s+Motivo\s+Vencimento\s+Limite\b/gi, ' ')
    .trim();
  const rowRegex = new RegExp(
    String.raw`(?:^|\s)(\d{1,8})\s+(.{3,120}?)\s+(${MOTIVO_ROW_PATTERN})\s+(\d{2}\/\d{2}\/\d{4}(?:\s*-\s*Limite\s*\d{2}\/\d{2}\/\d{4})?)`,
    'giu',
  );
  for (const match of clean.matchAll(rowRegex)) {
    const employeeName = match[2].replace(/\s+/g, ' ').trim();
    const motivo = match[3].replace(/\s+/g, ' ').trim();
    if (!employeeName || normalize(employeeName).includes('RELACAO DE VENCIMENTOS')) continue;
    company.linhas.push({
      employee_code: match[1].trim(),
      employee_name: employeeName,
      motivo,
      vencimento_raw: match[4].replace(/\s+/g, ' ').trim(),
    });
  }
}

function splitNameAndMotivo(rest: string): { employee_name: string; motivo: string } | null {
  const patterns = [
    /^(.*?)\s+((?:CONTRATO\s+(?:DE\s+)?)?EXPERI[ÊE]NCIA(?:\s+.*)?)$/i,
    /^(.*?)\s+(AVISO\s+PR[ÉE]VIO(?:\s+.*)?)$/i,
    /^(.*?)\s+(MONITORAMENTO(?:\s+.*)?)$/i,
    /^(.*?)\s+(VENCIMENTO(?:\s+.*?F[ÉE]RIAS.*)?)$/i,
    /^(.*?)\s+(RETORNO(?:\s+.*?AFAST.*)?)$/i,
    /^(.*?)\s+(PROGRAMA[CÇ][AÃ]O(?:\s+.*?F[ÉE]RIAS.*)?)$/i,
    /^(.*?)\s+(ENVIO(?:\s+.*?ESOCIAL.*)?)$/i,
  ];
  for (const pattern of patterns) {
    const m = rest.match(pattern);
    if (m?.[1]?.trim() && m?.[2]?.trim()) {
      return { employee_name: m[1].trim(), motivo: m[2].trim() };
    }
  }
  return null;
}

function parseAvisosFromText(text: string): ParsedPdf {
  const parsed: ParsedPdf = { empresas: [] };
  const byKey = new Map<string, ParsedPdf['empresas'][number]>();
  const emission = text.match(/(?:Emiss[aã]o|Emitido\s+em|Data\s+(?:de\s+)?emiss[aã]o)\D*(\d{2}\/\d{2}\/\d{4})(?:\D+(\d{2}:\d{2}(?::\d{2})?))?/i);
  if (emission?.[1]) parsed.emission_date = emission[1];
  if (emission?.[2]) parsed.emission_time = emission[2];

  let pendingCompany: { code: string; name: string } | null = null;
  let current: ParsedPdf['empresas'][number] | null = null;

  const getCompany = (code: string, name: string, cnpj: string) => {
    const cnpjDigits = cnpj.replace(/\D/g, '');
    const key = `${code}|${cnpjDigits || normalize(name)}`;
    let company = byKey.get(key);
    if (!company) {
      company = { code: code.trim(), name: name.trim(), cnpj: cnpj.trim(), linhas: [] };
      byKey.set(key, company);
      parsed.empresas.push(company);
    }
    return company;
  };

  const blockText = text.replace(/\r/g, '\n').replace(/\s+/g, ' ');
  const blockRegex = /Empresa:\s*(\d+)\s*-\s*(.+?)\s+CNPJ:\s*([\d./-]{14,18})(.*?)(?=\s+Empresa:\s*\d+\s*-|$)/giu;
  for (const block of blockText.matchAll(blockRegex)) {
    const company = getCompany(block[1], block[2], block[3]);
    addRowsFromChunk(company, block[4] || '');
  }

  const cnpjFirstBlockRegex = /([\d./-]{14,18})\s*CNPJ:\s*Empresa:\s*(\d+)\s*-\s*(.*?)(?=\s+[\d./-]{14,18}\s*CNPJ:\s*Empresa:|$)/giu;
  const firstRowRegex = new RegExp(String.raw`\s\d{1,8}\s+.{3,120}?\s+${MOTIVO_ROW_PATTERN}\s+\d{2}\/\d{2}\/\d{4}`, 'iu');
  for (const block of blockText.matchAll(cnpjFirstBlockRegex)) {
    const body = (block[3] || '').replace(/\s+/g, ' ').trim();
    const rowStart = body.search(firstRowRegex);
    if (rowStart < 0) continue;
    const companyName = body.slice(0, rowStart).trim();
    const rowsText = body.slice(rowStart).trim();
    const company = getCompany(block[2], companyName, block[1]);
    addRowsFromChunk(company, rowsText);
  }

  if (countRows(parsed) > 0) {
    parsed.empresas = parsed.empresas.filter((empresa) => empresa.linhas.length > 0);
    return parsed;
  }

  const normalizedText = text
    .replace(/\r/g, '\n')
    .replace(/\s+(Empresa:\s*\d+\s*-)/gi, '\n$1')
    .replace(/\s+(CNPJ:\s*\d{2}[.\d/-]+)/gi, '\n$1');
  const lines = normalizedText.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

  for (const line of lines) {
    const n = normalize(line);
    if (/^(RELACAO DE VENCIMENTOS|PAGINA\s+\d+|CODIGO\s+FUNCIONARIO|FUNCIONARIO\s+MOTIVO|[-_]{4,})/.test(n)) continue;

    const emp = line.match(/Empresa:\s*(\d+)\s*-\s*(.+?)(?:\s+CNPJ:|$)/i);
    if (emp) {
      pendingCompany = { code: emp[1], name: emp[2].trim() };
      const cnpjInline = line.match(/CNPJ:\s*([\d./-]{14,18})/i);
      if (cnpjInline) current = getCompany(pendingCompany.code, pendingCompany.name, cnpjInline[1]);
      continue;
    }

    const cnpj = line.match(/CNPJ:\s*([\d./-]{14,18})/i);
    if (cnpj && pendingCompany) {
      current = getCompany(pendingCompany.code, pendingCompany.name, cnpj[1]);
      continue;
    }

    if (!current || !/\d{2}\/\d{2}\/\d{4}/.test(line)) continue;
    const vencMatch = line.match(/\d{2}\/\d{2}\/\d{4}(?:\s*-\s*Limite\s*\d{2}\/\d{2}\/\d{4})?/i);
    if (!vencMatch || vencMatch.index == null) continue;

    const beforeDate = line.slice(0, vencMatch.index).trim();
    const rowMatch = beforeDate.match(/^(\d{1,8})\s+(.+)$/);
    if (!rowMatch) continue;
    const split = splitNameAndMotivo(rowMatch[2].trim());
    if (!split) continue;
    current.linhas.push({
      employee_code: rowMatch[1].trim(),
      employee_name: split.employee_name,
      motivo: split.motivo,
      vencimento_raw: vencMatch[0].replace(/\s+/g, ' ').trim(),
    });
  }

  parsed.empresas = parsed.empresas.filter((empresa) => empresa.linhas.length > 0);
  return parsed;
}

const countRows = (parsed: ParsedPdf) => parsed.empresas.reduce((total, empresa) => total + empresa.linhas.length, 0);

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
    let extractedText = '';
    try {
      const pdf = await getDocumentProxy(buf);
      const { text: pages } = await extractText(pdf, { mergePages: false });
      const arr = Array.isArray(pages) ? pages : [pages as string];
      extractedText = arr.join('\n');
    } catch (e) {
      console.warn('unpdf failed, will use PDF vision fallback', e);
    }

    const localParsed = extractedText ? parseAvisosFromText(extractedText) : { empresas: [] } as ParsedPdf;
    const localRows = countRows(localParsed);
    if (localRows > 0) {
      console.log(`parse-aviso-pdf parsed locally: ${localParsed.empresas.length} empresas, ${localRows} linhas`);
      return new Response(JSON.stringify({ ...localParsed, extraction_method: 'text_local' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const b64 = toBase64(buf);

    const buildBody = (model: string) => JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: extractedText && extractedText.length > 500
            ? `Extraia todas as empresas e avisos do texto abaixo e chame a função submit_avisos.\n\nTEXTO DO PDF:\n${extractedText.slice(0, 120000)}`
            : [
              { type: 'text', text: 'Extraia todas as empresas e avisos deste PDF e chame a função submit_avisos.' },
              { type: 'file', file: { filename: 'relacao.pdf', file_data: `data:application/pdf;base64,${b64}` } },
            ],
        },
      ],
      tools: [TOOL],
      tool_choice: { type: 'function', function: { name: 'submit_avisos' } },
    });
    // Preferimos modelos mais novos e texto extraído para reduzir falhas do upstream multimodal.
    // Cada tentativa tem timeout de 35s para evitar load eterno.
    const attempts: Array<{ model: string; delayMs: number }> = extractedText && extractedText.length > 500
      ? [
        { model: 'google/gemini-3-flash-preview', delayMs: 0 },
        { model: 'google/gemini-3.1-flash-lite-preview', delayMs: 1200 },
        { model: 'openai/gpt-5-mini', delayMs: 1200 },
      ]
      : [
        { model: 'google/gemini-3-flash-preview', delayMs: 0 },
        { model: 'google/gemini-2.5-flash', delayMs: 1200 },
        { model: 'google/gemini-2.5-pro', delayMs: 1200 },
      ];
    let aiResp: Response | null = null;
    let lastErrText = '';
    let lastStatus = 0;
    for (let i = 0; i < attempts.length; i++) {
      const { model, delayMs } = attempts[i];
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 35_000);
      try {
        aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Lovable-API-Key': LOVABLE_API_KEY, 'Content-Type': 'application/json' },
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
