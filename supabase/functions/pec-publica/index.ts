import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sha256 = async (t: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, "0")).join("");

const CAMPOS_SETOR = ["nome", "ordem", "funcionarios_atuais", "funcionarios_por_sexo", "parciais", "funcionamento", "postos", "intensidade_dias", "regime_compensacao", "limite_diario", "insalubre"];
const CAMPOS_PARAMS = ["marcos", "regime_compensacao_padrao", "limite_diario_padrao", "multiplicadores_intensidade", "indices_reposicao"];
const pick = (o: any, ks: string[]) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ks.includes(k)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json().catch(() => ({}));
    const { action, token } = b || {};
    if (typeof token !== "string" || token.length < 32 || token.length > 200) return json({ error: "Link inválido." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link } = await db.from("transicao_links").select("*").eq("token_hash", await sha256(token)).maybeSingle();
    if (!link) return json({ error: "Link inválido." }, 404);
    if (link.revogado_em) return json({ error: "Este link foi revogado pelo escritório." }, 410);
    if (link.expira_em && new Date(link.expira_em) < new Date()) return json({ error: "Este link expirou." }, 410);
    const emp = link.empresa_id as string;
    const setorDaEmpresa = async (id: unknown) => {
      if (typeof id !== "string") return false;
      const { data } = await db.from("transicao_setores").select("id").eq("id", id).eq("empresa_id", emp).maybeSingle();
      return !!data;
    };

    switch (action) {
      case "load": {
        const [{ data: c }, { data: p }, { data: s }, { data: cen }] = await Promise.all([
          db.from("clientes").select("nome, cnpj").eq("id", emp).maybeSingle(),
          db.from("transicao_parametros").select("*").eq("empresa_id", emp).maybeSingle(),
          db.from("transicao_setores").select("*").eq("empresa_id", emp).order("ordem"),
          db.from("transicao_cenarios").select("*").eq("empresa_id", emp).order("created_at", { ascending: false }),
        ]);
        const ids = (s || []).map((x: any) => x.id);
        const { data: ds } = ids.length ? await db.from("transicao_datas_especiais").select("*").in("setor_id", ids) : { data: [] };
        return json({ empresa: c, parametros: p, setores: s || [], datas: ds || [], cenarios: cen || [] });
      }
      case "params": {
        const { error } = await db.from("transicao_parametros").upsert({ empresa_id: emp, ...pick(b.dados, CAMPOS_PARAMS) }, { onConflict: "empresa_id" });
        return error ? json({ error: error.message }, 400) : json({ ok: true });
      }
      case "setor_add": {
        const { data, error } = await db.from("transicao_setores").insert({ empresa_id: emp, ...pick(b.dados, CAMPOS_SETOR) }).select("*").single();
        return error ? json({ error: error.message }, 400) : json({ setor: data });
      }
      case "setor_update": {
        if (!(await setorDaEmpresa(b.id))) return json({ error: "Setor não encontrado." }, 404);
        const { error } = await db.from("transicao_setores").update(pick(b.dados, CAMPOS_SETOR)).eq("id", b.id);
        return error ? json({ error: error.message }, 400) : json({ ok: true });
      }
      case "setor_del": {
        if (!(await setorDaEmpresa(b.id))) return json({ error: "Setor não encontrado." }, 404);
        await db.from("transicao_setores").delete().eq("id", b.id);
        return json({ ok: true });
      }
      case "datas": {
        if (!(await setorDaEmpresa(b.id))) return json({ error: "Setor não encontrado." }, 404);
        await db.from("transicao_datas_especiais").delete().eq("setor_id", b.id);
        const rows = (Array.isArray(b.dados) ? b.dados : []).slice(0, 200).filter((d: any) => d?.data)
          .map((d: any) => ({ setor_id: b.id, data: String(d.data).slice(0, 10), nivel: String(d.nivel || "alto"), observacao: d.observacao ? String(d.observacao).slice(0, 300) : null }));
        if (rows.length) await db.from("transicao_datas_especiais").insert(rows);
        return json({ ok: true });
      }
      case "cenario_add": {
        const { error } = await db.from("transicao_cenarios").insert({ empresa_id: emp, nome: String(b.dados?.nome || "Cenário").slice(0, 120), snapshot: b.dados?.snapshot || {} });
        return error ? json({ error: error.message }, 400) : json({ ok: true });
      }
      case "cenario_del": {
        await db.from("transicao_cenarios").delete().eq("id", b.id).eq("empresa_id", emp);
        return json({ ok: true });
      }
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
