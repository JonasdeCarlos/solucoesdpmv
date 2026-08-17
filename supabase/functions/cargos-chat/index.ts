const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-3.7-flash';

const SYSTEM = `Você é consultor SÊNIOR de Cargos & Salários no Brasil (CBO 2002, CLT, convenções coletivas, pesquisas salariais e boas práticas de remuneração).
Sua função é orientar a construção da ESTRUTURA SALARIAL da empresa informada.
Regras:
- Responda em português do Brasil, objetivo e prático (máx. 8 frases ou lista curta).
- Use SEMPRE os dados fornecidos (cargos cadastrados, faixas, escala de evolução, pisos de CCT) para embasar a resposta.
- Quando sugerir valores, apresente faixas realistas em R$ e explique o critério (piso da CCT, mediana de mercado, % de progressão).
- Nunca invente piso de CCT: se não houver dado, diga que precisa da CCT vigente.
- Pode sugerir níveis, amplitude de faixa, overlap entre faixas, critérios de promoção e governança do PCS.

APLICAÇÃO DE MUDANÇAS:
Sempre que sua resposta propuser mudanças concretas em cargos, salários, faixas ou escala de evolução, adicione AO FINAL da resposta um bloco de código com a proposta estruturada, exatamente neste formato:

\`\`\`json
{"proposta":{"resumo":"frase curta","cargos":[{"nome":"...","area":"...","nivel":"...","cbo":"...","salario_atual":0,"piso_salarial":0}],"faixas":[{"cargo":"...","area":"...","niveis":[{"nome":"Inicial","valor":0},{"nome":"Pleno","valor":0},{"nome":"Sênior","valor":0},{"nome":"Referência","valor":0}]}],"escala_evolucao":[{"etapa":"...","percentual_base":0,"descricao":"..."}]}}
\`\`\`

Regras do bloco: inclua apenas as chaves que realmente mudam; use exatamente os nomes de cargos já cadastrados quando estiver alterando um cargo existente; valores numéricos em R$ sem formatação. Se a resposta for apenas explicativa (sem mudanças aplicáveis), NÃO inclua o bloco.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { question, history, empresa, setor, cargos, estrutura, pisos } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: 'question obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const contexto = {
      empresa: empresa || null,
      setor: setor || null,
      cargos: (cargos || []).slice(0, 120),
      faixas: estrutura?.faixas || [],
      escala_evolucao: estrutura?.escala_evolucao || [],
      cargos_sugeridos: (estrutura?.cargos_sugeridos || []).slice(0, 40),
      pisos_cct: (pisos || []).slice(0, 60),
    };

    const messages: any[] = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Contexto atual do Plano de Cargos e Salários:\n${JSON.stringify(contexto, null, 2)}` },
    ];
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h?.role && h?.content) messages.push({ role: h.role, content: String(h.content) });
      }
    }
    messages.push({ role: 'user', content: String(question) });

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': KEY },
      body: JSON.stringify({ model: MODEL, messages }),
    });
    if (!r.ok) {
      const t = await r.text();
      const msg = r.status === 429
        ? 'Limite de requisições à IA atingido. Aguarde e tente novamente.'
        : r.status === 402
          ? 'Créditos da IA esgotados. Adicione créditos no workspace.'
          : `Falha ao consultar IA (${r.status}): ${t.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || 'Não foi possível gerar uma resposta.';
    return new Response(JSON.stringify({ answer, model: MODEL }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
