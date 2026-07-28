import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const body = await req.json().catch(() => ({}));
    const texto = String(body?.texto || "").trim();
    const tipo = String(body?.tipo || "objetivo");
    const verba_label = body?.verba_label || "Prêmio";
    const contexto = body?.contexto || "";

    if (!texto) return json({ error: "Informe um texto para melhorar." }, 400);
    if (texto.length > 4000) return json({ error: "Texto muito longo." }, 400);

    const foco = tipo === "regra"
      ? `Trata-se da REGRA de concessão do ${verba_label}. Deixe a condição de elegibilidade explícita e mensurável (percentuais, metas, prazos), sem inventar números que não estejam no texto original.`
      : `Trata-se do OBJETIVO da política de ${verba_label}. Deixe claro o propósito e o comportamento esperado.`;

    const prompt = `Você é especialista em RH e remuneração variável no Brasil.
Reescreva o texto abaixo corrigindo ortografia, gramática e pontuação, deixando-o claro, profissional e objetivo em português brasileiro.

${foco}
${contexto ? `Contexto adicional: ${contexto}` : ""}

Texto original:
"""${texto}"""

Regras:
1. Mantenha o mesmo sentido e todos os números/condições citados. Não invente informações.
2. Máximo de 600 caracteres, em 1 a 3 frases (ou tópicos curtos separados por "; " se houver várias condições).
3. Responda APENAS com o texto final, sem markdown, aspas, títulos ou comentários.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você revisa e melhora textos corporativos. Responda apenas o texto final, sem saudações ou markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);

    const d = await r.json();
    const melhorado = (d?.choices?.[0]?.message?.content || "").trim().replace(/^"|"$/g, "");
    if (!melhorado) return json({ error: "Não foi possível melhorar o texto." }, 500);
    return json({ texto: melhorado });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
