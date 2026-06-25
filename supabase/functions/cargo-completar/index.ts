import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const normalizarTexto = (s: string) => (s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

function fallbackCargo(atuais: any) {
  const nome = atuais.nome || "Cargo";
  const n = normalizarTexto(nome);
  const isRocadeira = n.includes("rocadeira") || n.includes("rocador") || n.includes("roçadeira");
  const isOperacional = isRocadeira || n.includes("operador") || n.includes("auxiliar") || n.includes("servente") || n.includes("jardineiro");
  const area = isRocadeira ? "Operacional / Manutenção de Áreas Verdes" : isOperacional ? "Operacional" : "Administrativo / Operacional";
  const nivel = isOperacional ? "operacional" : "tecnico";
  const cbo = isRocadeira ? "622020" : "000000";
  const descricao = isRocadeira
    ? "Executar serviços de roçada, capina e manutenção de áreas verdes, utilizando roçadeira costal e ferramentas auxiliares. Preparar, operar e conservar os equipamentos de trabalho, observando normas de segurança, uso correto de EPIs e orientações do encarregado. Apoiar a limpeza, organização e descarte adequado dos resíduos gerados nas frentes de serviço."
    : `Executar atividades inerentes ao cargo de ${nome}, seguindo procedimentos internos, normas de segurança e orientações da liderança imediata. Apoiar a rotina operacional da área, mantendo organização, qualidade e registro das atividades realizadas.`;
  const atividades = isRocadeira ? [
    "Operar roçadeira costal e equipamentos correlatos para manutenção de áreas verdes",
    "Realizar roçada, capina, limpeza e acabamento em terrenos, jardins e áreas externas",
    "Preparar o equipamento antes do uso, verificando combustível, lâmina, fio de corte e condições gerais",
    "Utilizar equipamentos de proteção individual durante toda a execução das atividades",
    "Isolar e sinalizar a área de trabalho quando necessário para proteção de terceiros",
    "Recolher e destinar resíduos vegetais conforme orientação da empresa",
    "Executar limpeza básica e conservação preventiva da roçadeira e ferramentas auxiliares",
    "Comunicar falhas, riscos, necessidade de manutenção ou reposição de materiais ao responsável",
    "Apoiar outras atividades de conservação, jardinagem e limpeza externa quando solicitado",
  ] : [
    `Executar as rotinas operacionais relacionadas ao cargo de ${nome}`,
    "Cumprir procedimentos internos e orientações da liderança imediata",
    "Manter o local de trabalho organizado, limpo e seguro",
    "Registrar ou comunicar ocorrências, não conformidades e necessidades de apoio",
    "Utilizar corretamente ferramentas, materiais e equipamentos disponibilizados",
    "Atender padrões de qualidade, produtividade e segurança da empresa",
    "Apoiar atividades correlatas sempre que compatíveis com a função",
    "Zelar pela conservação dos recursos e equipamentos sob sua responsabilidade",
  ];
  return {
    nome,
    cbo,
    area,
    nivel,
    descricao_sumaria: descricao,
    atividades,
    requisitos: {
      escolaridade: isRocadeira ? "Ensino fundamental, preferencialmente completo." : "Escolaridade compatível com as exigências da função.",
      experiencia: isRocadeira ? "Experiência prática com roçadeira costal, jardinagem, limpeza externa ou atividades similares." : "Experiência anterior na função ou em atividades correlatas será considerada diferencial.",
      competencias: isRocadeira ? ["Atenção à segurança", "Responsabilidade", "Disciplina operacional", "Zelo por equipamentos", "Trabalho em equipe", "Organização", "Resistência física"] : ["Responsabilidade", "Organização", "Comunicação", "Atenção a procedimentos", "Trabalho em equipe", "Proatividade"],
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cargo, empresa, campos_vazios } = await req.json();
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

    const isEmptyStr = (v: any) =>
      v === null || v === undefined ||
      (typeof v === "string" && ["", "null", "undefined", "—", "-"].includes(v.trim().toLowerCase()));
    const isEmptyArr = (v: any) => !Array.isArray(v) || v.map((x) => String(x || "").trim()).filter(Boolean).length === 0;
    const vazios: string[] = [];
    if (isEmptyStr(atuais.cbo)) vazios.push("cbo");
    if (isEmptyStr(atuais.area)) vazios.push("area");
    if (isEmptyStr(atuais.nivel)) vazios.push("nivel");
    if (isEmptyStr(atuais.descricao_sumaria)) vazios.push("descricao_sumaria");
    if (isEmptyArr(atuais.atividades)) vazios.push("atividades");
    if (isEmptyStr(atuais.escolaridade)) vazios.push("requisitos.escolaridade");
    if (isEmptyStr(atuais.experiencia)) vazios.push("requisitos.experiencia");
    if (isEmptyArr(atuais.competencias)) vazios.push("requisitos.competencias");

    const camposVaziosInformados = Array.isArray(campos_vazios) ? campos_vazios.map((c) => String(c || "").trim()).filter(Boolean) : [];
    const camposParaPreencher = camposVaziosInformados.length ? camposVaziosInformados : vazios;

    if (!camposParaPreencher.length) {
      return new Response(JSON.stringify({ ...atuais, requisitos: { escolaridade: atuais.escolaridade, experiencia: atuais.experiencia, competencias: atuais.competencias }, campos_vazios: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um especialista em descrição de cargos (RH/DP). Empresa: ${empresa || "n/i"}.
Cargo: "${atuais.nome}"${atuais.cbo ? ` (CBO ${atuais.cbo})` : ""}.

SUA TAREFA: gerar conteúdo técnico e detalhado APENAS para os campos listados abaixo como VAZIOS. Não invente conteúdo para campos preenchidos — para esses, devolva exatamente o valor atual.

CAMPOS VAZIOS QUE VOCÊ DEVE PREENCHER OBRIGATORIAMENTE: ${camposParaPreencher.join(", ")}.

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
      headers: { "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "edge-function", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ ...fallbackCargo(atuais), campos_vazios: camposParaPreencher, fallback: true, observacao: "A IA atingiu o limite momentâneo; foi aplicado preenchimento técnico automático." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402 || r.status === 403) return new Response(JSON.stringify({ ...fallbackCargo(atuais), campos_vazios: camposParaPreencher, fallback: true, observacao: "A IA está indisponível por limite de créditos; foi aplicado preenchimento técnico automático." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) {
      const detail = await r.text();
      console.error("cargo-completar AI error", r.status, detail.slice(0, 500));
      return new Response(JSON.stringify({ error: "A IA não conseguiu completar o cargo neste momento." }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const content = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim() || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const normalized = {
      nome: atuais.nome,
      cbo: isEmptyStr(atuais.cbo) ? (parsed.cbo || "") : atuais.cbo,
      area: isEmptyStr(atuais.area) ? (parsed.area || "") : atuais.area,
      nivel: isEmptyStr(atuais.nivel) ? (parsed.nivel || "") : atuais.nivel,
      descricao_sumaria: isEmptyStr(atuais.descricao_sumaria) ? (parsed.descricao_sumaria || "") : atuais.descricao_sumaria,
      atividades: isEmptyArr(atuais.atividades) && Array.isArray(parsed.atividades) ? parsed.atividades.map((s: any) => String(s || "").trim()).filter(Boolean) : atuais.atividades,
      requisitos: {
        escolaridade: isEmptyStr(atuais.escolaridade) ? (parsed.requisitos?.escolaridade || "") : atuais.escolaridade,
        experiencia: isEmptyStr(atuais.experiencia) ? (parsed.requisitos?.experiencia || "") : atuais.experiencia,
        competencias: isEmptyArr(atuais.competencias) && Array.isArray(parsed.requisitos?.competencias) ? parsed.requisitos.competencias.map((s: any) => String(s || "").trim()).filter(Boolean) : atuais.competencias,
      },
      campos_vazios: camposParaPreencher,
    };
    return new Response(JSON.stringify(normalized), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});