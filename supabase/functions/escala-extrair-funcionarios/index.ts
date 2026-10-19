import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `Você recebe um extrato/relatório/lista de funcionários de uma empresa brasileira (PDF, foto ou scan).
Extraia UMA linha por funcionário com:
- codigo: código/matrícula (só dígitos) ou ""
- nome: copie letra por letra como impresso. NUNCA invente, complete ou corrija nomes. Não crie pessoas a partir de cabeçalhos, rodapés, assinaturas, nome da empresa ou responsável.
- cargo: cargo/função exatamente como impresso (ex.: "Camareira", "Recepcionista") ou "" se não houver
- setor: setor/departamento/seção se houver (inclusive quando aparece como título de grupo acima dos funcionários) ou ""
Ignore linhas de total. Não invente dados.
Responda SOMENTE JSON: {"funcionarios":[{"codigo":"","nome":"","cargo":"","setor":""}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await uc.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const body = await req.json().catch(() => ({}));
    const arquivos: { dataUrl: string }[] = Array.isArray(body?.arquivos) ? body.arquivos.slice(0, 8) : [];
    const parts = arquivos.map((a) => String(a?.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/)).filter(Boolean) as RegExpMatchArray[];
    if (!parts.length) return json({ error: "Nenhum arquivo enviado" }, 400);
    if (parts.reduce((s, m) => s + m[2].length, 0) > 25_000_000) return json({ error: "Arquivos muito grandes" }, 400);
    const textos: string[] = Array.isArray(body?.textos) ? body.textos.slice(0, 30).map((t: any) => String(t || "").slice(0, 40000)) : [];
    const texto = textos.join("\n");
    const prompt = PROMPT + (texto.trim().length > 200 ? `\n\nTEXTO DIGITAL DO PDF (fonte da verdade; células separadas por " | "). Todo nome e cargo devolvido deve existir literalmente aqui:\n<<<\n${texto}\n>>>` : "");
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", store: false, reasoning: { effort: "medium" },
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          ...parts.map((m, i) => m[1] === "application/pdf"
            ? { type: "input_file", filename: `arquivo${i + 1}.pdf`, file_data: m[0] }
            : { type: "input_image", image_url: m[0] }),
        ] }],
      }),
    });
    if (r.status === 429) return json({ error: "Limite de requisições atingido. Tente em instantes." }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message || "Falha na leitura" }, 500);
    const raw: string = d?.output_text || (d?.output || []).flatMap((o: any) => o?.content || []).map((c: any) => c?.text || "").join("");
    let parsed: any = {};
    try { parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch { parsed = {}; }
    const low = texto.toLowerCase();
    const funcionarios = (parsed.funcionarios || []).map((f: any) => ({
      codigo: String(f?.codigo ?? "").replace(/\D/g, ""),
      nome: String(f?.nome ?? "").trim(),
      cargo: String(f?.cargo ?? "").trim(),
      setor: String(f?.setor ?? "").trim(),
    })).filter((f: any) => f.nome && (low.length < 200 || low.includes(f.nome.toLowerCase().split(" ")[0])));
    return json({ funcionarios });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
