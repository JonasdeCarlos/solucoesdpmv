import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ATIVIDADES_ANEXO_IV, CATEGORIA_LABEL } from "../_shared/escalaMotor.ts";

const MODEL = "openai/gpt-6-astra";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["atividade_descricao", "categoria_atividade", "atividade_anexo_iv", "regime", "n_domingos", "prazo_folga_compensatoria_feriado", "fundamento_trabalho_domingo", "cct_clausula_feriados", "cct_n_domingos_max", "cct_max_consecutivos", "cct_prazo_folga_feriado", "justificativa", "alertas"],
  properties: {
    atividade_descricao: { type: "string" },
    categoria_atividade: { type: "string", enum: Object.keys(CATEGORIA_LABEL) },
    atividade_anexo_iv: { type: "string", enum: ATIVIDADES_ANEXO_IV },
    regime: { type: "string", enum: ["6x1", "5x2", "5x1", "4x2", "12x36"] },
    n_domingos: { type: "integer" },
    prazo_folga_compensatoria_feriado: { type: "integer" },
    fundamento_trabalho_domingo: { type: "string" },
    cct_clausula_feriados: { type: ["boolean", "null"] },
    cct_n_domingos_max: { type: ["integer", "null"] },
    cct_max_consecutivos: { type: ["integer", "null"] },
    cct_prazo_folga_feriado: { type: ["integer", "null"] },
    justificativa: { type: "string" },
    alertas: { type: "array", items: { type: "string" } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    const b = await req.json().catch(() => ({}));
    const cnae = String(b?.cnae || "").slice(0, 200).trim();
    if (!cnae) return json({ error: "Informe o CNAE." }, 400);
    const cct = String(b?.dados_cct || "").slice(0, 60000);

    const prompt = `Você é especialista em legislação trabalhista brasileira (CLT, Lei 10.101/2000 art. 6º e 6º-A, Lei 605/49, Decreto 27.048/49, Portaria MTP 671/2021 Anexo IV, art. 386 CLT, art. 67 CLT, art. 59-A CLT).
Sugira os parâmetros de uma escala de revezamento para a empresa abaixo, conforme a legislação vigente em 2026.

CNAE: ${cnae}
Setor: ${b?.setor || "—"}
Empresa: ${b?.empresa || "—"}
Dados específicos / cláusulas da CCT informados pelo usuário:
${cct || "(nenhum — use só a lei)"}

Regras:
- categoria_atividade: COMERCIO se for comércio varejista (Lei 10.101 art. 6º: domingo de folga ao menos a cada 3 semanas, n_domingos máx 3); DEMAIS_AUTORIZADAS se a atividade consta no Anexo IV da Portaria 671 (n_domingos máx 7, folga dominical ao menos 1 vez a cada 7 semanas); AUTORIZACAO_TRANSITORIA_OU_CCT nos demais casos.
- atividade_anexo_iv: escolha da lista a atividade correspondente ou "nenhuma".
- fundamento_trabalho_domingo: cite o fundamento legal (e a cláusula da CCT, se informada).
- prazo_folga_compensatoria_feriado: padrão 7 dias, salvo CCT diferente.
- Campos cct_*: preencha SOMENTE se os dados da CCT acima trouxerem a regra; senão null. Não invente cláusulas.
- Se a CCT for mais restritiva que a lei, prevaleça a CCT e explique em alertas.
- justificativa: 3 a 6 frases objetivas em pt-BR.
- alertas: pontos a conferir (ex.: necessidade de CCT para comércio em feriados, art. 6º-A).`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content: prompt }],
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "parametros_escala", strict: true, schema } },
      }),
    });
    if (!r.ok || !r.body) {
      const txt = await r.text().catch(() => "");
      if (r.status === 429) return json({ error: "Limite de requisições de IA atingido. Tente novamente em instantes." }, 429);
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: txt || `Falha na IA (${r.status})` }, r.status);
    }
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "text/event-stream");
    return new Response(r.body, { status: 200, headers });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
