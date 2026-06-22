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
1. Agrupe em no mínimo 4 faixas salariais coerentes com o porte/setor.
2. Para cada faixa retorne: nome, cargos que a compõem (lista), min, mid, max em BRL numérico.
3. O salário ATUAL praticado deve ser respeitado como teto do cargo (último nível da faixa = max ≥ salário atual).
4. O salário INICIAL (min) NUNCA pode ser inferior ao piso da CCT informado para o cargo/grupo. Se não houver piso, use mediana de mercado.
5. Calcule o mid como média entre min e max (ou ponto coerente entre eles).
6. Sugira cargos ADICIONAIS que a empresa deveria ter ainda que não cadastrados (ex.: supervisão, back-office, qualidade, segurança do trabalho, etc. conforme o setor) — retorne em "cargos_sugeridos" com nome, área, nivel, justificativa, salario_min, salario_max.
7. Monte um ORGANOGRAMA hierárquico contemplando os cargos atuais E os sugeridos. Cada nó: id (slug único), nome, parent_id (null para topo), nivel.
8. Escala de evolução (5 etapas: Inicial, Em desenvolvimento, Pleno, Sênior, Referência) com percentuais de incremento base.

Retorne SOMENTE JSON válido neste formato:
{
 "faixas":[{"nome":"...","cargos":["..."],"min":0,"mid":0,"max":0}],
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