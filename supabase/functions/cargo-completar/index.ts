import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cargo, empresa } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const atuais = {
      nome: cargo?.nome || "",
      cbo: cargo?.cbo || "",
      area: cargo?.area || "",
      nivel: cargo?.nivel || "",
      descricao_sumaria: cargo?.descricao_sumaria || "",
      atividades: Array.isArray(cargo?.atividades) ? cargo.atividades : [],
      escolaridade: cargo?.requisitos?.escolaridade || "",
      experiencia: cargo?.requisitos?.experiencia || "",
      competencias: Array.isArray(cargo?.requisitos?.competencias) ? cargo.requisitos.competencias : [],
      entrevista: cargo?.entrevista || "",
    };

    const prompt = `Você é um especialista em descrição de cargos (RH/DP). Empresa: ${empresa || "n/i"}.
Receberá os campos atuais de um cargo. PRESERVE todos os valores já preenchidos exatamente como estão.
Preencha SOMENTE os campos vazios, de forma técnica, coerente com o nome do cargo e CBO informados, e consistente entre si.

Regras:
- Não sobrescreva valores existentes. Se "atividades" já tem itens, devolva o MESMO array.
- Se "competencias" já tem itens, devolva o MESMO array.
- "cbo" deve ter 6 dígitos quando sugerido.
- "nivel" deve ser um de: operacional, tecnico, especialista, supervisao, coordenacao, gerencia, diretoria.
- "atividades": mínimo 8 itens, verbo no infinitivo + complemento (só preencha se estiver vazio).
- "descricao_sumaria": até 5 linhas, linguagem formal (só preencha se estiver vazia).
- "escolaridade", "experiencia": frases curtas.
- "competencias": 5 a 10 itens.

CAMPOS ATUAIS (JSON):
${JSON.stringify(atuais, null, 2)}

Retorne SOMENTE JSON no formato:
{"nome":"...","cbo":"...","area":"...","nivel":"...","descricao_sumaria":"...","atividades":["..."],"requisitos":{"escolaridade":"...","experiencia":"...","competencias":["..."]}}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});