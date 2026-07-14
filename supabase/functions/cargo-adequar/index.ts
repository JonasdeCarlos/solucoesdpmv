import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const { nome, empresa, setor, cbo, descricao_sumaria, atividades } = await req.json().catch(() => ({}));
    const nomeCargo = String(nome || "").trim();
    if (!nomeCargo) {
      return new Response(JSON.stringify({ error: "Informe o nome do cargo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contexto = [
      cbo ? `CBO informado: ${String(cbo).replace(/\D/g, "")}` : "",
      descricao_sumaria ? `Descrição sumária: ${String(descricao_sumaria).slice(0, 800)}` : "",
      Array.isArray(atividades) && atividades.length ? `Atividades: ${atividades.slice(0, 12).map((a: any) => String(a)).join(" | ").slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Você é um especialista em descrição de cargos, CBO e legislação trabalhista brasileira.
Empresa: ${empresa || "n/i"}. Setor: ${setor || "n/i"}.
Cargo informado pelo usuário: "${nomeCargo}".
${contexto ? `\nContexto adicional do cargo já cadastrado (use como âncora — NÃO troque a profissão):\n${contexto}\n` : ""}

REGRAS DURAS PARA CONSELHO DE CLASSE:
- Marque "profissao_regulamentada": true SOMENTE quando existir lei federal específica exigindo formação e registro em conselho profissional para EXERCER o cargo descrito (ex.: Contador→CRC, Advogado→OAB, Engenheiro→CREA, Arquiteto→CAU, Médico→CRM, Enfermeiro→COREN, Odontólogo→CRO, Farmacêutico→CRF, Psicólogo→CRP, Assistente Social→CRESS, Nutricionista→CRN, Fisioterapeuta→CREFITO, Educador Físico→CREF, Técnico em Segurança do Trabalho→registro MTE, Corretor→CRECI, Administrador→CFA/CRA, Economista→CORECON, Técnico em Contabilidade→CRC, Biomédico→CRBM).
- Se o cargo for auxiliar/assistente/estagiário/técnico de apoio SEM formação regulamentada exigida por lei, defina "profissao_regulamentada": false e "conselho_registro.obrigatorio": false.
- NUNCA invente um conselho por semelhança de nome. Se houver dúvida, retorne obrigatorio=false, sigla="" e explique na "conselho_mensagem".
- "conselho_mensagem": frase curta pronta para relatório PDF, sempre preenchida, começando por "Este cargo EXIGE inscrição em..." ou "Este cargo NÃO exige inscrição em conselho de classe...". Inclua a base legal quando exigir, e uma justificativa objetiva quando não exigir.

SUA TAREFA: sugerir a adequação técnica e legal deste cargo, retornando obrigatoriamente:
- "cbo": código CBO oficial (6 dígitos, sem hífen) mais adequado ao cargo. Se houver ambiguidade escolha o mais praticado no Brasil.
- "titulo_cbo": título oficial correspondente ao CBO.
- "area": departamento típico (ex.: Operacional, Administrativo, Comercial, RH, Financeiro, Produção, TI, Saúde).
- "nivel": um destes valores: operacional | tecnico | analista | especialista | gestao | diretoria.
- "descricao_sumaria": 3 a 5 linhas em linguagem formal descrevendo o propósito e a natureza do trabalho.
- "atividades": array com 8 a 12 itens curtos, cada um começando por verbo no infinitivo.
- "requisitos": { "escolaridade": "...", "experiencia": "...", "competencias": [5 a 10 itens] }.
- "profissao_regulamentada": true/false — indicar se a profissão é regulamentada por lei federal no Brasil.
- "base_legal": string com a lei/decreto de regulamentação quando existir (ex.: "Lei 5.194/1966 — Engenharia"), ou "" quando não houver.
- "conselho_registro": { "obrigatorio": true/false, "sigla": "CREA/CRC/COREN/OAB/CRM/CRO/CFA/CFC/CRA/etc.", "descricao": "explicação curta" } — sigla vazia quando não houver conselho.
- "observacoes_regulamentacao": string curta com riscos, exigências adicionais (NR aplicável, certificações obrigatórias, CNH, treinamentos legais como NR-11, NR-35, NR-10, etc.), ou "" quando nada aplicável.
- "conselho_mensagem": ver regras acima. NUNCA vazio.

Responda SOMENTE com JSON válido no formato exato:
{"cbo":"","titulo_cbo":"","area":"","nivel":"","descricao_sumaria":"","atividades":[],"requisitos":{"escolaridade":"","experiencia":"","competencias":[]},"profissao_regulamentada":false,"base_legal":"","conselho_registro":{"obrigatorio":false,"sigla":"","descricao":""},"observacoes_regulamentacao":"","conselho_mensagem":""}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "edge-function", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!r.ok) {
      const detail = await r.text();
      console.error("cargo-adequar AI error", r.status, detail.slice(0, 500));
      return json({ error: "A IA não conseguiu adequar o cargo neste momento." }, r.status);
    }
    const d = await r.json();
    const raw = d?.choices?.[0]?.message?.content || "{}";
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
    const out = {
      cbo: String(parsed.cbo || "").replace(/\D/g, "").slice(0, 6),
      titulo_cbo: String(parsed.titulo_cbo || ""),
      area: String(parsed.area || ""),
      nivel: String(parsed.nivel || ""),
      descricao_sumaria: String(parsed.descricao_sumaria || ""),
      atividades: Array.isArray(parsed.atividades) ? parsed.atividades.map((s: any) => String(s || "").trim()).filter(Boolean) : [],
      requisitos: {
        escolaridade: String(parsed.requisitos?.escolaridade || ""),
        experiencia: String(parsed.requisitos?.experiencia || ""),
        competencias: Array.isArray(parsed.requisitos?.competencias) ? parsed.requisitos.competencias.map((s: any) => String(s || "").trim()).filter(Boolean) : [],
      },
      profissao_regulamentada: !!parsed.profissao_regulamentada,
      base_legal: String(parsed.base_legal || ""),
      conselho_registro: {
        obrigatorio: !!parsed.conselho_registro?.obrigatorio,
        sigla: String(parsed.conselho_registro?.sigla || ""),
        descricao: String(parsed.conselho_registro?.descricao || ""),
      },
      observacoes_regulamentacao: String(parsed.observacoes_regulamentacao || ""),
      conselho_mensagem: String(parsed.conselho_mensagem || (parsed.conselho_registro?.obrigatorio
        ? `Este cargo EXIGE inscrição em ${parsed.conselho_registro?.sigla || 'conselho de classe'}${parsed.base_legal ? ' (' + parsed.base_legal + ')' : ''}.`
        : 'Este cargo NÃO exige inscrição em conselho de classe.')),
    };
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}