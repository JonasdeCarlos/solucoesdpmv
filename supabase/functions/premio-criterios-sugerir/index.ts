import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const { setor, cargo, objetivo, verba_label, quantidade } = body || {};
    const qtd = Math.min(Math.max(Number(quantidade || 6), 3), 12);
    const verba = (verba_label || "Prêmio").toString().trim();

    const prompt = `Você é um especialista em remuneração variável e gestão de desempenho no Brasil.
Gere ${qtd} critérios OBJETIVOS, MENSURÁVEIS e LEGÍTIMOS para concessão de ${verba} a colaboradores.
Contexto:
- Setor/atividade: ${setor || "não informado"}
- Cargo/função alvo: ${cargo || "geral"}
- Objetivo da política: ${objetivo || "incentivar desempenho consistente"}

Regras OBRIGATÓRIAS:
- Critérios devem ser ATIVIDADES OBSERVÁVEIS pelo gestor (assiduidade, pontualidade, organização, atendimento, qualidade, produtividade, segurança, conformidade etc.).
- NÃO inclua critérios discriminatórios (gênero, raça, religião, orientação, estado civil, deficiência, idade).
- NÃO mencione punições, advertência, demissão.
- Cada critério: nome curto (até 60 caracteres) + descrição clara (1-2 frases explicando como apurar).
- Atribua peso entre 1 e 5 (5 = mais importante). Marque "essencial: true" apenas se a falha nele zera o ${verba}.

Retorne APENAS JSON válido, sem markdown, no formato:
{"criterios":[{"nome":"...","descricao":"...","peso":3,"essencial":false}]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido, sem markdown, sem comentários." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    const d = await r.json();
    const raw = d?.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
    const criterios = Array.isArray(parsed?.criterios) ? parsed.criterios.map((c: any) => ({
      nome: String(c.nome || "").slice(0, 100),
      descricao: String(c.descricao || "").slice(0, 500),
      peso: Math.min(Math.max(Number(c.peso || 1), 1), 5),
      essencial: !!c.essencial,
    })).filter((c: any) => c.nome) : [];
    return json({ criterios });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}