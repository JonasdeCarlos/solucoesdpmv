import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Linha = { funcionario?: string; cargo: string; cbo?: string; salario: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { pdf_base64, mime, setor } = await req.json();
    if (!pdf_base64) throw new Error("pdf_base64 obrigatório");
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Você está analisando um EXTRATO MENSAL de folha de pagamento brasileiro.
Extraia TODOS os empregados listados. Para cada um capture:
- funcionario: nome completo
- cargo: nome do cargo (campo "Cargo:" — ignore o código numérico que aparece antes)
- cbo: somente os dígitos do C.B.O.
- salario: valor do campo "Salário:" (número decimal, ponto como separador)

Regras:
- Se um campo não estiver claro, use null.
- NÃO invente empregados.
- Retorne SOMENTE JSON no formato:
{"linhas":[{"funcionario":"...","cargo":"...","cbo":"123456","salario":2800.00}, ...]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime || "application/pdf"};base64,${pdf_base64}` } },
          ],
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`AI ${r.status}: ${txt.slice(0, 300)}`);
    }
    const data = await r.json();
    let parsed: { linhas: Linha[] } = { linhas: [] };
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}"); } catch {}
    const linhas = (parsed.linhas || []).filter(l => l && l.cargo && Number(l.salario) > 0).map(l => ({
      funcionario: (l.funcionario || "").trim(),
      cargo: String(l.cargo).trim(),
      cbo: l.cbo ? String(l.cbo).replace(/\D/g, "") : "",
      salario: Number(l.salario),
    }));

    // Agrupa por cargo (normalizado)
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const grupos = new Map<string, { cargo: string; cbo: string; salarios: number[]; funcionarios: string[] }>();
    for (const l of linhas) {
      const k = norm(l.cargo);
      const g = grupos.get(k) || { cargo: l.cargo, cbo: l.cbo, salarios: [], funcionarios: [] };
      g.salarios.push(l.salario);
      if (l.funcionario) g.funcionarios.push(l.funcionario);
      if (!g.cbo && l.cbo) g.cbo = l.cbo;
      grupos.set(k, g);
    }
    const cargosAgg = Array.from(grupos.values()).map(g => ({
      cargo: g.cargo,
      cbo: g.cbo,
      qtd: g.salarios.length,
      salario_min: Math.min(...g.salarios),
      salario_max: Math.max(...g.salarios),
      salario_medio: g.salarios.reduce((a, b) => a + b, 0) / g.salarios.length,
      funcionarios: g.funcionarios,
    })).sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR"));

    // Inconsistências
    const inconsistencias: { tipo: string; descricao: string }[] = [];
    // Cargos diferentes com mesmo salário
    const porSalario = new Map<number, Set<string>>();
    for (const l of linhas) {
      const s = Math.round(l.salario * 100) / 100;
      if (!porSalario.has(s)) porSalario.set(s, new Set());
      porSalario.get(s)!.add(norm(l.cargo));
    }
    for (const [sal, cargos] of porSalario) {
      if (cargos.size > 1) {
        const lista = Array.from(cargos).map(c => Array.from(grupos.values()).find(g => norm(g.cargo) === c)?.cargo || c).join(", ");
        inconsistencias.push({ tipo: "salario_repetido", descricao: `Cargos distintos com mesmo salário R$ ${sal.toFixed(2)}: ${lista}` });
      }
    }
    // Mesmo cargo com salários diferentes
    for (const g of cargosAgg) {
      if (g.salario_min !== g.salario_max) {
        inconsistencias.push({ tipo: "salario_divergente", descricao: `${g.cargo}: variação de R$ ${g.salario_min.toFixed(2)} a R$ ${g.salario_max.toFixed(2)} (${g.qtd} pessoas)` });
      }
    }
    // Cargos com nomes semelhantes mas distintos (ex.: VIGIA II vs VIGIA NOTURNO II)
    const nomes = cargosAgg.map(g => g.cargo);
    for (let i = 0; i < nomes.length; i++) {
      for (let j = i + 1; j < nomes.length; j++) {
        const a = norm(nomes[i]); const b = norm(nomes[j]);
        if (a !== b && (a.includes(b) || b.includes(a))) {
          inconsistencias.push({ tipo: "cargo_similar", descricao: `Cargos com nomes semelhantes: "${nomes[i]}" e "${nomes[j]}" — verificar se devem ser unificados.` });
        }
      }
    }

    // Sugestão de PCS via IA
    const pcsPrompt = `Você é consultor de Cargos & Salários. Com base nos cargos extraídos da folha (setor: ${setor || "não informado"}), sugira um Plano de Cargos e Salários (PCS) consolidado.

CARGOS EXTRAÍDOS:
${JSON.stringify(cargosAgg, null, 2)}

INCONSISTÊNCIAS DETECTADAS:
${inconsistencias.map(i => "- " + i.descricao).join("\n") || "(nenhuma)"}

Para cada cargo consolidado retorne: nome, area (ex.: Operacional, Administrativa, Segurança), nivel (operacional|tecnico|analista|especialista|gestao|diretoria), cbo, salario_inicial, salario_referencia (usar o praticado atual mais alto), justificativa curta.
Inclua também "recomendacoes": array com 3 a 6 itens de boas práticas e ações para resolver as inconsistências.

Retorne SOMENTE JSON: {"pcs":[{"nome":"...","area":"...","nivel":"...","cbo":"...","salario_inicial":0,"salario_referencia":0,"justificativa":"..."}], "recomendacoes":["..."]}`;
    let pcs: any[] = []; let recomendacoes: string[] = [];
    try {
      const r2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: pcsPrompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (r2.ok) {
        const d2 = await r2.json();
        const p2 = JSON.parse(d2.choices?.[0]?.message?.content || "{}");
        pcs = p2.pcs || [];
        recomendacoes = p2.recomendacoes || [];
      }
    } catch {}

    return new Response(JSON.stringify({ linhas, cargos: cargosAgg, inconsistencias, pcs, recomendacoes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});