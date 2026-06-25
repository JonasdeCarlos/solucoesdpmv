import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cargos, empresa, pisos, setor } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");
    const prompt = `Você é consultor SÊNIOR de Cargos & Salários no Brasil, com profundo conhecimento de estrutura organizacional setorial (CBO 2002, pesquisas Catho/Robert Half/Hays, convenções coletivas SINTHORESP/FOHB/ABRASEL para A&B, NR's, e benchmarking de mercado).

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
6. SUGESTÕES AMPLAS E PROFUNDAS DE CARGOS (cargos_sugeridos) — Esta é a parte mais importante. Você DEVE sugerir um conjunto AMPLO (mínimo 10–20 cargos quando o porte/setor permitir) cobrindo TODOS os níveis hierárquicos e funcionais típicos do setor, mesmo que não cadastrados. Pense exaustivamente em:
   • Operação principal — todos os cargos típicos da atividade-fim do setor. Para Alimentos & Bebidas (restaurantes/bares/hotéis), considere obrigatoriamente: Maître/Chefe de Salão, Chefe de Fila (Chef de Rang), Garçom, Commis de Rang (Cumim), Sommelier, Barman/Bartender, Barback, Hostess/Recepcionista de salão, Chef Executivo, Sous Chef, Chef de Partida (Chef de Partie), Cozinheiro, Auxiliar de Cozinha, Confeiteiro, Padeiro, Pizzaiolo, Churrasqueiro, Steward, Copeiro, Lavador de Louça. Para outros setores, faça o mesmo nível de granularidade.
   • Supervisão e gerência intermediária (supervisor, encarregado, líder de turno, gerente operacional, gerente de unidade).
   • Back-office e suporte (compras, almoxarifado/estoque, controladoria, financeiro, RH/DP, TI, marketing, comercial).
   • Qualidade, segurança do trabalho (técnico de segurança, SESMT quando aplicável), manutenção, higienização.
   • Diretoria/C-level conforme o porte.
   Para CADA sugestão, retorne: nome, area, nivel, justificativa (cite a referência: CBO, CCT, pesquisa salarial ou prática de mercado), salario_min, salario_max (faixa realista pt-BR).
   NÃO repita cargos já cadastrados. Priorize cobertura ampla — é melhor sugerir 15 cargos relevantes do que 4 genéricos.
7. Monte um ORGANOGRAMA hierárquico contendo EXCLUSIVAMENTE os cargos cadastrados (lista CARGOS ATUAIS acima). NÃO inclua cargos sugeridos nem cargos que não estejam cadastrados. Cada nó: id (slug único derivado do nome do cargo cadastrado), nome (EXATAMENTE como aparece em CARGOS ATUAIS), parent_id (null para topo, ou id de outro cargo cadastrado), nivel. Respeite a cadeia de comando real do setor para ordenar APENAS os cargos cadastrados.
8. Escala de evolução (4 etapas iguais às dos cargos) com percentual_base representando o % DO SALÁRIO DE REFERÊNCIA (teto). Portanto Inicial≈75%, Pleno≈85%, Sênior≈93%, Referência=100%. Descrição curta de cada etapa.

Retorne SOMENTE JSON válido neste formato:
{
 "faixas":[{"cargo":"...","area":"...","cbo":"...","niveis":[{"nome":"Inicial","valor":0},{"nome":"Pleno","valor":0},{"nome":"Sênior","valor":0},{"nome":"Referência","valor":0}],"piso_cct":0,"salario_atual":0}],
 "escala_evolucao":[{"etapa":"...","percentual_base":0,"descricao":"..."}],
 "cargos_sugeridos":[{"nome":"...","area":"...","nivel":"...","justificativa":"...","salario_min":0,"salario_max":0}],
 "organograma":[{"id":"...","nome":"...","parent_id":null,"nivel":"..."}]
}`;
    const models = ["google/gemini-2.5-pro", "google/gemini-2.5-flash"];
    let lastErr: { status: number; body: string } | null = null;
    for (const model of models) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        lastErr = { status: r.status, body: await r.text() };
        console.error(`AI ${model} falhou:`, r.status, lastErr.body);
        if (r.status === 429 || r.status === 402) break; // sem créditos
        continue;
      }
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastErr = { status: 500, body: "Resposta vazia da IA" };
        continue;
      }
      return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const msg = lastErr?.status === 429
      ? "Limite de requisições à IA atingido. Aguarde alguns instantes e tente novamente."
      : lastErr?.status === 402
        ? "Créditos da IA esgotados. Adicione créditos no workspace para continuar."
        : lastErr?.status === 403
          ? "Acesso à IA bloqueado (403). Verifique se a IA Lovable está habilitada e com créditos disponíveis no workspace."
          : `Falha ao consultar IA (${lastErr?.status}). Tente novamente.`;
    return new Response(JSON.stringify({ error: msg, detail: lastErr?.body }), { status: lastErr?.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});