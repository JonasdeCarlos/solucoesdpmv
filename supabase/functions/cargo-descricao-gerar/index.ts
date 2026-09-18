import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome || "").trim();
    const cbo = String(body?.cbo || "").trim();
    const area = String(body?.area || "").trim();
    const nivel = String(body?.nivel || "").trim();
    const empresa = String(body?.empresa || "").trim();
    const setor = String(body?.setor || "").trim();
    const pontos = String(body?.pontos_obrigatorios || "").trim();
    const descricaoAtual = String(body?.descricao_sumaria || "").trim();
    const entrevista = String(body?.entrevista || "").trim();

    if (!nome) return json({ error: "Informe o nome do cargo." }, 400);
    if (!pontos && !entrevista && !descricaoAtual) return json({ error: "Informe o que não pode faltar na descrição." }, 400);

    const prompt = `Você é especialista em descrição de cargos (RH/DP) no Brasil.
Empresa: ${empresa || "n/i"}. Atividade/setor: ${setor || "n/i"}.
Cargo: "${nome}"${cbo ? ` (CBO ${cbo})` : ""}${area ? ` — área ${area}` : ""}${nivel ? ` — nível ${nivel}` : ""}.

PONTOS QUE NÃO PODEM FALTAR (obrigatórios, informados pelo gestor):
"""${pontos || "(não informado)"}"""

${descricaoAtual ? `Descrição atual (base a preservar quando fizer sentido):\n"""${descricaoAtual}"""\n` : ""}${entrevista ? `Entrevista com ocupante/gestor:\n"""${entrevista}"""\n` : ""}

Tarefa: escreva a DESCRIÇÃO SUMÁRIA do cargo de forma completa e técnica, desdobrando cada ponto obrigatório em todas as etapas implícitas do trabalho.
Exemplo do nível de detalhe esperado: se o ponto for "auxiliar no café da manhã", a descrição deve contemplar montagem do buffet, reposição e conservação dos itens, atendimento ao hóspede, desmontagem, higienização de utensílios e organização do salão.

Regras:
1. Um único parágrafo corrido de 4 a 7 linhas, linguagem formal de RH, verbos no infinitivo.
2. Contemplar obrigatoriamente todos os pontos informados; não inventar responsabilidades incompatíveis com o cargo ou com o setor.
3. Sem markdown, sem títulos, sem aspas. Responda apenas o texto final.
4. Devolva também de 6 a 12 atividades derivadas, cada uma começando com verbo no infinitivo.

Responda SOMENTE JSON: {"descricao_sumaria":"...","atividades":["..."]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!r.ok) return json({ error: "A IA não conseguiu gerar a descrição agora." }, r.status);

    const d = await r.json();
    const raw = (d?.choices?.[0]?.message?.content || "{}").replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const descricao = String(parsed?.descricao_sumaria || "").trim();
    if (!descricao) return json({ error: "Não foi possível gerar a descrição." }, 500);
    const atividades = Array.isArray(parsed?.atividades)
      ? parsed.atividades.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];
    return json({ descricao_sumaria: descricao, atividades });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
