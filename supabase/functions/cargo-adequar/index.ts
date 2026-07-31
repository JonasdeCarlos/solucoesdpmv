import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const { nome, empresa, setor, cbo, titulo_cbo, cbo_confirmado, descricao_sumaria, atividades, contexto: contextoUsuario } = await req.json().catch(() => ({}));
    const nomeCargo = String(nome || "").trim();
    if (!nomeCargo) {
      return new Response(JSON.stringify({ error: "Informe o nome do cargo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contexto = [
      contextoUsuario ? `DESCRIÇÃO DO QUE O CARGO EXECUTA (informada pelo usuário — esta é a FONTE DE VERDADE sobre a ocupação; prevalece sobre o título quando houver conflito): ${String(contextoUsuario).slice(0, 1200)}` : "",
      cbo ? `CBO informado: ${String(cbo).replace(/\D/g, "")}` : "",
      cbo_confirmado ? `O USUÁRIO CONFIRMOU ESTE CBO (${String(cbo).replace(/\D/g, "")}${titulo_cbo ? " — " + titulo_cbo : ""}). Mantenha OBRIGATORIAMENTE este código em "cbo", use o título oficial correspondente em "titulo_cbo", refaça toda a análise (área, nível, descrição, atividades, requisitos, regulamentação e conselho de classe) COM BASE NESTE CBO e retorne "cbo_alternativas" como array VAZIO.` : "",
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

REGRAS DURAS PARA CLASSIFICAÇÃO CBO (CBO 2002 - MTE):
- Classifique pela NATUREZA DA OCUPAÇÃO efetivamente exercida, não por palavras parecidas no título. Percorra mentalmente: Grande Grupo → Subgrupo Principal → Subgrupo → Família Ocupacional → Ocupação, e só então escolha o código de 6 dígitos.
- Não confunda ocupações de COMUNICAÇÃO/JORNALISMO (família 2611 - jornalistas, repórteres, editores de texto) com ocupações de PRODUÇÃO AUDIOVISUAL / CINEMA / TV (família 2624 e correlatas - produtor de audiovisual, diretor de produção, produtor cultural; técnicos em 2617/3721 conforme o caso). Um "Produtor Audiovisual" NÃO é jornalista.
- Erros clássicos a evitar: produtor audiovisual ≠ jornalista; designer ≠ publicitário; analista de suporte ≠ programador; auxiliar administrativo ≠ assistente administrativo; motorista de caminhão ≠ motorista de carro de passeio; técnico em segurança do trabalho ≠ engenheiro de segurança.
- ROTINAS DE DEPARTAMENTO PESSOAL / RH (admissão, folha de pagamento, eSocial, férias, rescisão, ponto, encargos): classifique nas famílias de RECURSOS HUMANOS (2524 / 4110 conforme o nível). NUNCA classifique em famílias de produção, artes, comércio ou contabilidade societária.
- Quando o usuário descrever as rotinas do cargo, a classificação DEVE refletir essas rotinas, mesmo que o título seja genérico ("Analista", "Assistente", "Coordenador").
- OCUPAÇÕES DIGITAIS / MARKETING (social media, analista de mídias sociais, gestor de tráfego, community manager, analista de marketing digital, growth, SEO): classifique nas famílias de MARKETING/PUBLICIDADE/COMUNICAÇÃO EMPRESARIAL. É TERMINANTEMENTE PROIBIDO classificar esses cargos em famílias de ARTES CÊNICAS, ESPETÁCULOS, DIREÇÃO TEATRAL, CINEMA OU MÚSICA (2624, 2625, 2626 e correlatas). "Social media" NÃO é diretor teatral, produtor de espetáculo nem artista.
- TABELA CANÔNICA OBRIGATÓRIA (use EXATAMENTE estes códigos quando o cargo corresponder; não substitua por "publicitário" 254105/253105 nem por outro código parecido):
  • Social media / Analista de mídias sociais / Community manager / Gestor de redes sociais → 253405 — Analista de mídias sociais
  • Gestor de tráfego pago / Analista de mídia paga / Especialista em performance digital → 253405 (alternativa 253115 quando o escopo for marketing amplo)
  • Analista de marketing digital / Growth / SEO → 253115 — Profissional de marketing (alternativa 253405 quando o foco for mídias sociais)
  • Produtor audiovisual → 261610 — Produtor de audiovisual
  • Analista de departamento pessoal / Analista de DP / Analista de RH / Analista de folha de pagamento → 252405 — Analista de recursos humanos
  • Assistente/Auxiliar de departamento pessoal / Auxiliar de pessoal / Auxiliar de folha de pagamento → 411005 — Auxiliar de pessoal (assistente administrativo de pessoal)
- Antes de responder, faça uma CONFERÊNCIA FINAL: leia o "titulo_cbo" que você escolheu e pergunte-se "uma pessoa contratada com o título informado pelo usuário exerceria exatamente esta ocupação no dia a dia?". Se a resposta for não, refaça a classificação. Nunca escolha um código só porque uma palavra do título coincide.
- Se o usuário já informou um CBO no contexto, valide-o: se estiver coerente, mantenha; se estiver incoerente com a ocupação, corrija e explique.
- Nunca "chute" um código: se houver mais de uma opção plausível, escolha a mais praticada e liste as demais em "cbo_alternativas".
- Preencha SEMPRE "titulo_cbo" com o TÍTULO OFICIAL exato da ocupação na CBO correspondente ao código informado (não invente sinônimos), "cbo_familia" com o código e o nome da família ocupacional (4 dígitos) e "cbo_justificativa" com 1 a 2 frases explicando por que este código foi escolhido e por que ocupações vizinhas foram descartadas.

SUA TAREFA: sugerir a adequação técnica e legal deste cargo, retornando obrigatoriamente:
- "cbo": código CBO oficial (6 dígitos, sem hífen) mais adequado ao cargo. Se houver ambiguidade escolha o mais praticado no Brasil.
- "titulo_cbo": título oficial correspondente ao CBO.
- "cbo_familia": "XXXX — Nome da família ocupacional".
- "cbo_justificativa": justificativa curta da escolha do código.
- "cbo_alternativas": array (0 a 3) de {"cbo":"","titulo":"","quando_usar":""} com códigos alternativos plausíveis.
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
{"cbo":"","titulo_cbo":"","cbo_familia":"","cbo_justificativa":"","cbo_alternativas":[{"cbo":"","titulo":"","quando_usar":""}],"area":"","nivel":"","descricao_sumaria":"","atividades":[],"requisitos":{"escolaridade":"","experiencia":"","competencias":[]},"profissao_regulamentada":false,"base_legal":"","conselho_registro":{"obrigatorio":false,"sigla":"","descricao":""},"observacoes_regulamentacao":"","conselho_mensagem":""}`;

    const SYS = "Você é especialista em CBO 2002 (MTE) e responde APENAS com JSON válido, sem markdown.";
    let raw = "";

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "edge-function", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (r.ok) {
      const d = await r.json();
      raw = d?.choices?.[0]?.message?.content || "{}";
    } else {
      const detail = await r.text();
      console.error("cargo-adequar gateway error", r.status, detail.slice(0, 300));
      const ANTH = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTH) {
        if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
        if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
        return json({ error: "A IA não conseguiu adequar o cargo neste momento." }, r.status);
      }
      // Descobre um modelo disponível para esta chave
      let modelos: string[] = [];
      try {
        const lm = await fetch("https://api.anthropic.com/v1/models?limit=50", {
          headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01" },
        });
        if (lm.ok) {
          const lj = await lm.json();
          modelos = (lj?.data || []).map((m: any) => String(m?.id || "")).filter(Boolean);
        }
      } catch (_) { /* ignore */ }
      const preferido =
        modelos.find((m) => m.includes("opus-4")) ||
        modelos.find((m) => m.includes("sonnet-4-5")) ||
        modelos.find((m) => m.includes("sonnet-4")) ||
        modelos.find((m) => m.includes("sonnet")) ||
        modelos.find((m) => m.includes("haiku")) ||
        modelos[0];
      if (!preferido) {
        return json({ error: "Nenhum modelo Anthropic disponível para a chave configurada." }, 502);
      }
      const ar = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: preferido,
          max_tokens: 4000,
          system: SYS,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!ar.ok) {
        const adetail = await ar.text();
        console.error("cargo-adequar anthropic error", ar.status, adetail.slice(0, 500));
        return json({ error: `Falha na IA (Anthropic ${ar.status}).`, detail: adetail.slice(0, 300) }, ar.status);
      }
      const ad = await ar.json();
      raw = ad?.content?.map((c: any) => (c?.type === "text" ? c.text : "")).join("") || "{}";
    }
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
    const out = {
      cbo: String(parsed.cbo || "").replace(/\D/g, "").slice(0, 6),
      titulo_cbo: String(parsed.titulo_cbo || ""),
      cbo_familia: String(parsed.cbo_familia || ""),
      cbo_justificativa: String(parsed.cbo_justificativa || ""),
      cbo_alternativas: Array.isArray(parsed.cbo_alternativas)
        ? parsed.cbo_alternativas
            .map((a: any) => ({
              cbo: String(a?.cbo || "").replace(/\D/g, "").slice(0, 6),
              titulo: String(a?.titulo || ""),
              quando_usar: String(a?.quando_usar || ""),
            }))
            .filter((a: any) => a.cbo || a.titulo)
            .slice(0, 3)
        : [],
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
    if (!cbo_confirmado) {
      const canon = canonizar(nomeCargo);
      if (canon && out.cbo !== canon.cbo) {
        if (out.cbo) {
          out.cbo_alternativas = [{ cbo: out.cbo, titulo: out.titulo_cbo, quando_usar: "Sugestão original da IA" }, ...out.cbo_alternativas].slice(0, 3);
        }
        out.cbo = canon.cbo;
        out.titulo_cbo = canon.titulo;
        out.cbo_familia = canon.familia;
        out.cbo_justificativa = canon.justificativa;
      }
    }
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CANONICOS: { re: RegExp; cbo: string; titulo: string; familia: string; justificativa: string }[] = [
  {
    re: /(social ?media|midias? sociais|redes sociais|community manager|gestor de trafego|gestora de trafego|trafego pago|midia paga)/,
    cbo: "253405",
    titulo: "Analista de mídias sociais",
    familia: "2534 — Profissionais de mídias sociais e comunicação digital",
    justificativa: "Ocupação de gestão de conteúdo e performance em mídias sociais/digitais; não se confunde com publicitário (254105) nem com ocupações artísticas.",
  },
  {
    re: /(marketing digital|growth|seo|inbound)/,
    cbo: "253115",
    titulo: "Profissional de marketing",
    familia: "2531 — Profissionais de publicidade, mercadologia, comunicação e negócios",
    justificativa: "Atuação em estratégia e execução de marketing digital, enquadrada na família 2531.",
  },
  {
    re: /produtor(a)? audiovisual/,
    cbo: "261610",
    titulo: "Produtor de audiovisual",
    familia: "2616 — Produtores de espetáculos e de audiovisual",
    justificativa: "Produção audiovisual não é jornalismo (2611).",
  },
  {
    re: /(analista|especialista|consultor(a)?|coordenador(a)?)\s+(de\s+)?(departamento pessoal|dep\.? pessoal|dp\b|recursos humanos|rh\b|folha de pagamento)/,
    cbo: "252405",
    titulo: "Analista de recursos humanos",
    familia: "2524 — Profissionais de recursos humanos",
    justificativa: "Rotinas de admissão, folha de pagamento, eSocial, férias e rescisão enquadram-se na família 2524 (profissionais de recursos humanos).",
  },
  {
    re: /(auxiliar|assistente|aux\.?)\s+(de\s+)?(departamento pessoal|dep\.? pessoal|dp\b|pessoal|folha de pagamento|recursos humanos|rh\b)/,
    cbo: "411005",
    titulo: "Auxiliar de pessoal",
    familia: "4110 — Escriturários em geral, agentes, assistentes e auxiliares administrativos",
    justificativa: "Atividades de apoio administrativo em rotinas de pessoal, sem responsabilidade técnica plena, enquadram-se na família 4110.",
  },
];

function canonizar(nome: string) {
  const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CANONICOS.find((c) => c.re.test(n)) || null;
}