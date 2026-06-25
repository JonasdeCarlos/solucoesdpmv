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

    const isEmptyStr = (v: any) => !v || (typeof v === "string" && !v.trim());
    const isEmptyArr = (v: any) => !Array.isArray(v) || v.length === 0;
    const vazios: string[] = [];
    if (isEmptyStr(atuais.cbo)) vazios.push("cbo");
    if (isEmptyStr(atuais.area)) vazios.push("area");
    if (isEmptyStr(atuais.nivel)) vazios.push("nivel");
    if (isEmptyStr(atuais.descricao_sumaria)) vazios.push("descricao_sumaria");
    if (isEmptyArr(atuais.atividades)) vazios.push("atividades");
    if (isEmptyStr(atuais.escolaridade)) vazios.push("requisitos.escolaridade");
    if (isEmptyStr(atuais.experiencia)) vazios.push("requisitos.experiencia");
    if (isEmptyArr(atuais.competencias)) vazios.push("requisitos.competencias");

    const prompt = `Você é um especialista em descrição de cargos (RH/DP). Empresa: ${empresa || "n/i"}.
Cargo: "${atuais.nome}"${atuais.cbo ? ` (CBO ${atuais.cbo})` : ""}.

SUA TAREFA: gerar conteúdo técnico e detalhado APENAS para os campos listados abaixo como VAZIOS. Não invente conteúdo para campos preenchidos — para esses, devolva exatamente o valor atual.

CAMPOS VAZIOS QUE VOCÊ DEVE PREENCHER OBRIGATORIAMENTE: ${vazios.length ? vazios.join(", ") : "(nenhum — devolva os valores atuais)"}.

Regras de conteúdo:
- "cbo": 6 dígitos plausíveis para o cargo.
- "area": departamento (ex.: Produção, Operacional, Administrativo, Comercial, RH).
- "nivel": exatamente um de operacional | tecnico | especialista | supervisao | coordenacao | gerencia | diretoria.
- "descricao_sumaria": 3 a 5 linhas, linguagem formal.
- "atividades": array com 8 a 12 itens, cada item começando com verbo no infinitivo.
- "requisitos.escolaridade" e "requisitos.experiencia": frases curtas, objetivas.
- "requisitos.competencias": array com 5 a 10 itens (substantivos/skills).

CAMPOS ATUAIS (JSON, fonte da verdade para o que JÁ está preenchido):
${JSON.stringify(atuais, null, 2)}

Responda SOMENTE com JSON válido neste formato (sem markdown, sem comentários):
{"nome":"","cbo":"","area":"","nivel":"","descricao_sumaria":"","atividades":[],"requisitos":{"escolaridade":"","experiencia":"","competencias":[]}}`;

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