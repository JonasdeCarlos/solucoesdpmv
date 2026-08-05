import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em leitura de cartões de ponto brasileiros (CLT).
Analise a imagem do cartão de ponto e extraia TODOS os registros de marcações de ponto.

Retorne EXCLUSIVAMENTE um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "empregado_nome": "nome se visível ou null",
  "mes_ano": "YYYY-MM se identificável ou null",
  "registros": [
    {
      "dia": 1,
      "marcacoes": ["08:00", "12:00", "13:00", "17:00"],
      "observacao": ""
    }
  ],
  "confianca": "alta|media|baixa",
  "observacoes_gerais": "notas sobre legibilidade"
}

REGRAS:
- Cada "dia" é o número do dia do mês (1-31).
- "marcacoes" é um array de strings "HH:MM" na ordem em que aparecem (entrada, saída intervalo, entrada intervalo, saída). Pode ter 2, 4 ou 6 marcações.
- Se um horário está ilegível, use "??:??" naquela posição.
- Se um dia não tem marcações (folga, feriado, falta), use marcacoes vazio [].
- NÃO invente dados. Se algo não está legível, marque como ilegível.
- Tente identificar o nome do empregado e o mês/ano do cartão.
- "confianca" reflete a qualidade geral da leitura.
- Retorne SOMENTE o JSON, sem nenhum texto adicional, sem backticks, sem markdown.

CALIBRAÇÃO DE DÍGITOS (crítico — erros comuns 1 x 2, 3 x 8, 5 x 6, 0 x 8, 7 x 1):
- Analise a FORMA do dígito: "1" é um traço vertical simples (com ou sem serifa curta no topo); "2" tem curva superior e base horizontal. Nunca converta um em outro por "parecer provável".
- Valide o horário: horas entre 00 e 23, minutos entre 00 e 59. Se a leitura resultar em minutos > 59 (ex.: "12:75"), releia o dígito duvidoso.
- Use coerência da jornada como conferência, NÃO como invenção: entradas costumam ficar entre 06:00 e 09:00, saída de intervalo próxima do meio-dia, retorno 1h a 2h depois, saída final entre 16:00 e 19:00. Se a leitura destoar muito do padrão dos OUTROS dias do mesmo cartão, releia o dígito antes de confirmar.
- As marcações de um dia devem estar em ordem cronológica crescente (salvo turno que cruza a meia-noite). Se não estiverem, o dígito lido está errado — releia.
- Compare a coluna inteira: no mesmo cartão os horários se repetem quase todos os dias. Um valor isolado muito diferente dos vizinhos é forte indício de dígito mal lido.
- Se após reler ainda houver dúvida real entre dois dígitos, use "??:??" naquela marcação e reduza a "confianca". É melhor sinalizar ilegível do que chutar.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images } = await req.json();
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawContent = "";
    let provider = "";

    // 1) Tenta primeiro a chave Anthropic do usuário (visão)
    const ANTH = Deno.env.get("ANTHROPIC_API_KEY");
    if (ANTH) {
      try {
        let modelos: string[] = [];
        const lm = await fetch("https://api.anthropic.com/v1/models?limit=50", {
          headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01" },
        });
        if (lm.ok) {
          const lj = await lm.json();
          modelos = (lj?.data || []).map((m: any) => String(m?.id || "")).filter(Boolean);
        }
        const preferido =
          modelos.find((m) => m.includes("opus-4")) ||
          modelos.find((m) => m.includes("sonnet-4-5")) ||
          modelos.find((m) => m.includes("sonnet-4")) ||
          modelos.find((m) => m.includes("sonnet")) ||
          modelos.find((m) => m.includes("haiku")) ||
          modelos[0];

        if (preferido) {
          const blocks: any[] = [];
          for (const img of images) {
            const url = String(img?.dataUrl || "");
            const m = url.match(/^data:([^;]+);base64,(.+)$/);
            if (!m) continue;
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: m[1], data: m[2] },
            });
          }
          blocks.push({ type: "text", text: "Analise o(s) cartão(ões) de ponto a seguir e extraia todas as marcações dia a dia." });

          const ar = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": ANTH, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({
              model: preferido,
              max_tokens: 8000,
              temperature: 0,
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: blocks }],
            }),
          });
          if (ar.ok) {
            const ad = await ar.json();
            rawContent = ad?.content?.map((c: any) => (c?.type === "text" ? c.text : "")).join("") || "";
            provider = `anthropic:${preferido}`;
          } else {
            console.error("ocr-ponto anthropic error", ar.status, (await ar.text()).slice(0, 400));
          }
        }
      } catch (e) {
        console.error("ocr-ponto anthropic exception", e);
      }
    }

    if (!rawContent) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build content array with all images
    const contentParts: any[] = [
      { type: "text", text: "Analise o(s) cartão(ões) de ponto a seguir e extraia todas as marcações dia a dia." }
    ];

    for (const img of images) {
      contentParts.push({
        type: "image_url",
        image_url: { url: img.dataUrl }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentParts },
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no painel." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de OCR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    rawContent = data.choices?.[0]?.message?.content ?? "";
    provider = "lovable:google/gemini-2.5-flash";
    }
    
    // Try to parse the JSON from the response
    let parsed;
    try {
      // Remove potential markdown backticks
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse OCR result:", rawContent);
      return new Response(JSON.stringify({ 
        error: "Não foi possível interpretar o cartão de ponto. Tente com uma imagem mais nítida.",
        raw: rawContent 
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanidade: invalida horários impossíveis e fora de ordem (dígito mal lido)
    const isValid = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    let suspeitos = 0;
    if (Array.isArray(parsed?.registros)) {
      for (const reg of parsed.registros) {
        if (!Array.isArray(reg?.marcacoes)) continue;
        reg.marcacoes = reg.marcacoes.map((m: unknown) => {
          const s = String(m ?? "").trim();
          if (!s || s.includes("?")) return "??:??";
          if (!isValid(s)) { suspeitos++; return "??:??"; }
          return s;
        });
        // ordem cronológica (tolera 1 virada de meia-noite)
        const mins = reg.marcacoes.map((m: string) => (m.includes("?") ? null : toMin(m)));
        let quebras = 0;
        for (let i = 1; i < mins.length; i++) {
          if (mins[i] !== null && mins[i - 1] !== null && mins[i] < mins[i - 1]) quebras++;
        }
        if (quebras > 1) {
          suspeitos++;
          reg.observacao = [reg.observacao, "Sequência fora de ordem — revisar leitura."].filter(Boolean).join(" ");
        }
      }
    }
    if (suspeitos > 0 && parsed?.confianca === "alta") parsed.confianca = "media";

    return new Response(JSON.stringify({ ...parsed, _provider: provider, _suspeitos: suspeitos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-ponto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
