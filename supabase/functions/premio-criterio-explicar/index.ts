import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const { criterio_nome, setor, cargo, objetivo, verba_label } = body || {};

    if (!criterio_nome) {
      return json({ error: "Nome do critério é obrigatório." }, 400);
    }

    const prompt = `Você é um especialista em remuneração variável e gestão de desempenho no Brasil.
Escreva uma explicação/descrição objetiva e clara de como apurar o critério de avaliação listado abaixo.

Critério a explicar: "${criterio_nome}"

Contexto da política:
- Verba: ${verba_label || "Prêmio"}
- Setor da empresa: ${setor || "Geral/não informado"}
- Cargo alvo: ${cargo || "Geral/todos"}
- Objetivo geral da política: ${objetivo || "estimular alta performance e dedicação"}

Regras obrigatórias:
1. Explique em poucas palavras (1 ou 2 frases curtas, no máximo 250 caracteres) o que este critério avalia e como o gestor deve apurá-lo de forma objetiva no dia a dia.
2. Seja profissional, direto e realista.
3. NÃO use formatação markdown, tópicos ou títulos. Responda apenas com o texto da explicação em português brasileiro.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um assistente de RH focado em clareza e objetividade. Responda apenas o texto solicitado, sem saudações ou markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (r.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    
    const d = await r.json();
    const explicacao = (d?.choices?.[0]?.message?.content || "").trim().replace(/^"|"\s*$/g, "");
    
    return json({ explicacao });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
