import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cargos, empresa, pisos, setor } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const prompt = `Você é consultor sênior de Cargos & Salários no Brasil.
Empresa: "${empresa || ""}" ${setor ? `(setor: ${setor})` : ""}.

CARGOS ATUAIS (com salário praticado e piso da CCT quando informado):
${JSON.stringify(cargos, null, 2)}

PISOS DA CCT EVIDENCIADOS (referência obrigatória para salário inicial quando aplicável):
${JSON.stringify(pisos || [], null, 2)}

REGRAS OBRIGATÓRIAS:
1. CADA CARGO CADASTRADO É UMA LINHA INDIVIDUAL — NÃO agrupe cargos diferentes na mesma faixa. Cada cargo terá sua própria escala de níveis (steps).
2. Para cada cargo, gere exatamente 4 níveis nesta ordem: "Inicial", "Pleno", "Sênior", "Referência".
3. O nível "Referência" (último) DEVE ter valor IGUAL ao salário atual praticado do cargo. Se o cargo não tiver salário atual informado, use a mediana de mercado para o cargo/setor.
4. O nível "Inicial" (primeiro) NUNCA pode ser inferior ao piso da CCT informado para o cargo/grupo. Se não houver piso, use ~75% do salário Referência (mínimo legal: salário-mínimo nacional vigente).
5. Os níveis intermediários ("Pleno", "Sênior") devem ser distribuídos de forma crescente entre Inicial e Referência (progressão linear ou geométrica suave).
6. Sugira cargos ADICIONAIS que a empresa deveria ter ainda que não cadastrados (ex.: supervisão, back-office, qualidade, segurança do trabalho, etc. conforme o setor) — retorne em "cargos_sugeridos" com nome, área, nivel, justificativa, salario_min, salario_max.
7. Monte um ORGANOGRAMA hierárquico contemplando os cargos atuais E os sugeridos. Cada nó: id (slug único), nome, parent_id (null para topo), nivel.
8. Escala de evolução (4 etapas iguais às dos cargos) com percentual_base representando o % DO SALÁRIO DE REFERÊNCIA (teto). Portanto Inicial≈75%, Pleno≈85%, Sênior≈93%, Referência=100%. Descrição curta de cada etapa.

Retorne SOMENTE JSON válido neste formato:
{
 "faixas":[{"cargo":"...","area":"...","cbo":"...","niveis":[{"nome":"Inicial","valor":0},{"nome":"Pleno","valor":0},{"nome":"Sênior","valor":0},{"nome":"Referência","valor":0}],"piso_cct":0,"salario_atual":0}],
 "escala_evolucao":[{"etapa":"...","percentual_base":0,"descricao":"..."}],
 "cargos_sugeridos":[{"nome":"...","area":"...","nivel":"...","justificativa":"...","salario_min":0,"salario_max":0}],
 "organograma":[{"id":"...","nome":"...","parent_id":null,"nivel":"..."}]
}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});