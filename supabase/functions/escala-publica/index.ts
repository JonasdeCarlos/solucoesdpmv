import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validarEscala } from "../_shared/escalaMotor.ts";
import { carregarEscala, salvarEscala, paramsDe, PARAM_KEYS } from "../_shared/escalaStore.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sha256 = async (t: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, pin } = body || {};
    if (typeof token !== "string" || token.length < 32 || token.length > 200) return json({ error: "Link inválido." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- valida token a cada requisição ---
    const tokenHash = await sha256(token);
    const { data: link } = await db.from("escala_links_publicos").select("*").eq("token_hash", tokenHash).maybeSingle();
    if (!link) return json({ error: "Link inválido." }, 404);
    if (link.revogado_em) return json({ error: "Este link foi revogado pelo escritório." }, 410);
    if (link.expira_em && new Date(link.expira_em) < new Date()) return json({ error: "Este link expirou." }, 410);

    if (link.pin_hash) {
      const { data: tent } = await db.from("escala_pin_tentativas").select("*").eq("link_id", link.id).maybeSingle();
      if (tent?.bloqueado_ate && new Date(tent.bloqueado_ate) > new Date())
        return json({ error: "PIN bloqueado por 15 minutos após 5 tentativas erradas.", pin_bloqueado: true }, 429);
      if (!pin) return json({ precisa_pin: true }, 401);
      const ok = (await sha256(`${String(pin)}:${tokenHash}`)) === link.pin_hash;
      if (!ok) {
        const falhas = (tent?.falhas || 0) + 1;
        await db.from("escala_pin_tentativas").upsert({
          link_id: link.id, falhas: falhas >= 5 ? 0 : falhas,
          bloqueado_ate: falhas >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null, updated_at: new Date().toISOString(),
        });
        return json({ error: falhas >= 5 ? "PIN bloqueado por 15 minutos." : `PIN incorreto (${5 - falhas} tentativa(s) restante(s)).`, precisa_pin: true }, 401);
      }
      if (tent?.falhas) await db.from("escala_pin_tentativas").update({ falhas: 0, bloqueado_ate: null }).eq("link_id", link.id);
    }

    const { data: cliente } = await db.from("clientes").select("id, nome, nome_fantasia, cnpj, logo_url").eq("id", link.cliente_id).maybeSingle();
    const doLink = async (id: string) => {
      const r = await carregarEscala(db, id);
      if (!r || r.escala.link_id !== link.id || r.escala.cliente_id !== link.cliente_id) return null;
      return r;
    };

    if (action === "open") {
      await db.from("escala_links_publicos").update({ ultimo_acesso_em: new Date().toISOString() }).eq("id", link.id);
      const { data: brand } = await db.from("office_branding").select("logo_url, primary_color, office_name").limit(1).maybeSingle();
      const { data: escalas } = await db.from("escalas_revezamento")
        .select("id, titulo, setor, status, data_inicio, data_fim, observacao_escritorio, updated_at")
        .eq("link_id", link.id).order("created_at", { ascending: false });
      return json({ cliente, branding: brand || null, escalas: escalas || [], limite_escalas: link.limite_escalas });
    }

    if (action === "versao") {
      const { data: e } = await db.from("escalas_revezamento").select("updated_at, status, link_id, cliente_id").eq("id", String(body.escala_id || "")).maybeSingle();
      if (!e || e.link_id !== link.id || e.cliente_id !== link.cliente_id) return json({ error: "Escala não encontrada." }, 404);
      return json({ versao: e.updated_at, status: e.status });
    }

    if (action === "get") {
      const r = await doLink(String(body.escala_id || ""));
      if (!r) return json({ error: "Escala não encontrada." }, 404);
      return json(r);
    }

    if (action === "create") {
      const { count } = await db.from("escalas_revezamento").select("id", { count: "exact", head: true }).eq("link_id", link.id);
      if (link.limite_escalas && (count || 0) >= link.limite_escalas) return json({ error: "Limite de escalas deste link atingido." }, 403);
      const hoje = new Date();
      const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
      const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
      const { data, error } = await db.from("escalas_revezamento").insert({
        cliente_id: link.cliente_id, link_id: link.id, origem: "publica", status: "rascunho",
        titulo: "Escala de revezamento", data_inicio: ini, data_fim: fim,
      }).select("id").single();
      if (error) throw error;
      return json({ id: data.id });
    }

    if (action === "save" || action === "enviar") {
      const r = await doLink(String(body.escala_id || ""));
      if (!r) return json({ error: "Escala não encontrada." }, 404);
      if (!["rascunho", "devolvida"].includes(r.escala.status)) return json({ error: "Esta escala já foi enviada e não pode mais ser editada." }, 409);
      const p = body.params || {};
      const patch: Record<string, unknown> = {};
      for (const k of PARAM_KEYS) if (k in p) patch[k] = p[k];
      const str = (x: unknown, n: number) => String(x ?? "").slice(0, n);
      if ("titulo" in body) patch.titulo = str(body.titulo, 200);
      patch.preenchido_por_nome = str(body.preenchido_por_nome, 200);
      patch.preenchido_por_contato = str(body.preenchido_por_contato, 200);
      if (body.aceite_lgpd && !r.escala.aceite_lgpd_em) patch.aceite_lgpd_em = new Date().toISOString();
      const funcs = Array.isArray(body.funcionarios) ? body.funcionarios.slice(0, 300) : [];

      if (action === "enviar") {
        const params = paramsDe({ ...r.escala, ...patch });
        const res = validarEscala(params, funcs);
        const pend: string[] = res.bloqueios.map((b) => b.mensagem);
        if (!patch.preenchido_por_nome) pend.push("Informe o nome de quem está preenchendo.");
        if (!patch.preenchido_por_contato) pend.push("Informe e-mail ou telefone de contato.");
        if (!r.escala.aceite_lgpd_em && !patch.aceite_lgpd_em) pend.push("Marque a ciência do aviso de LGPD.");
        if (pend.length) return json({ error: "Há pendências que impedem o envio.", pendencias: pend }, 422);
        patch.status = "enviada"; patch.enviado_em = new Date().toISOString(); patch.visto_escritorio = false;
      }
      const versao = await salvarEscala(db, r.escala.id, patch, funcs);
      return json({ ok: true, status: patch.status || r.escala.status, versao });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Erro" }, 500);
  }
});
