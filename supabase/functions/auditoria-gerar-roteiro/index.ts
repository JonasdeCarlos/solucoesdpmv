import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { empresa, cnpj, objetivo, segmento } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Você é auditor trabalhista sênior. Gere um roteiro estruturado de auditoria trabalhista para a empresa "${empresa}" (CNPJ: ${cnpj || "n/i"}; segmento: ${segmento || "n/i"}).
Objetivo informado: ${objetivo || "Auditoria trabalhista completa"}.

Cubra no mínimo 11 áreas: Admissão e Documentação, Contratos de Trabalho, Jornada de Trabalho, Folha de Pagamento, Benefícios Obrigatórios, SST, FGTS e INSS, Contratos Especiais, Férias e 13º, Rescisões, eSocial. Acrescente outras se relevantes.
Em "Contratos de Trabalho" inclua itens como: tipo de contrato (CLT, experiência, prazo determinado, intermitente, teletrabalho), cláusulas obrigatórias, prorrogações, aditivos, assinatura/registro, conformidade com CCT, exclusividade, confidencialidade e cláusulas restritivas.
Para cada área, gere de 3 a 6 itens com: titulo (curto), descricao (o que verificar), acao (como verificar, passo do auditor).
Retorne SOMENTE JSON sem markdown no formato:
{"areas":[{"nome":"...","itens":[{"titulo":"...","descricao":"...","acao":"..."}]}]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "ai error", detail: t }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});