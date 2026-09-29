import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supa = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function sha256(txt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Admin (usuário logado) gerencia os links ----
async function manageLink(body: any, authHeader: string) {
  const token = (authHeader || "").replace("Bearer ", "");
  if (!token) return json({ error: "Não autenticado" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "Não autenticado" }, 401);

  const s = supa();
  const { politica_id, op, link_id, senha } = body;

  if (op === "list") {
    const { data } = await s.from("premiacao_public_links").select("id, token, ativo, created_at, senha_hash")
      .eq("politica_id", politica_id).order("created_at", { ascending: false });
    return json({ items: (data || []).map((l: any) => ({ ...l, protegido: !!l.senha_hash, senha_hash: undefined })) });
  }
  if (op === "create") {
    const hash = senha ? await sha256(senha) : null;
    const { data, error } = await s.from("premiacao_public_links").insert({ politica_id, senha_hash: hash }).select("id, token, ativo").single();
    if (error) throw error;
    return json({ link: data });
  }
  if (op === "set_password") {
    const hash = senha ? await sha256(senha) : null;
    const { error } = await s.from("premiacao_public_links").update({ senha_hash: hash }).eq("id", link_id);
    if (error) throw error;
    return json({ ok: true, protegido: !!hash });
  }
  if (op === "toggle") {
    const { error } = await s.from("premiacao_public_links").update({ ativo: !!body.ativo }).eq("id", link_id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (op === "delete") {
    const { error } = await s.from("premiacao_public_links").delete().eq("id", link_id);
    if (error) throw error;
    return json({ ok: true });
  }
  return json({ error: "op inválida" }, 400);
}

// ---- Autenticação do gestor pelo link ----
async function authLink(token: string, senha: string | undefined) {
  const s = supa();
  const { data: link } = await s.from("premiacao_public_links").select("*").eq("token", token).eq("ativo", true).maybeSingle();
  if (!link) return { error: json({ error: "Link inválido ou desativado" }, 404) };
  if (link.senha_hash) {
    if (!senha) return { error: json({ requires_password: true }, 200) };
    if ((await sha256(senha)) !== link.senha_hash) return { error: json({ requires_password: true, wrong: true }, 200) };
  }
  return { link };
}

async function handle(action: string, link: any, body: any) {
  const s = supa();
  const pid = link.politica_id;
  const { data: politica } = await s.from("premiacao_politicas").select("*").eq("id", pid).maybeSingle();
  if (!politica) return json({ error: "Política não encontrada" }, 404);
  const empresaId = politica.empresa_id;

  if (action === "get_bundle") {
    const [md, sv, mt, ds, rf, cl, cg, vs, clie, brand] = await Promise.all([
      s.from("premiacao_medalhas").select("*").eq("politica_id", pid).order("ordem"),
      s.from("premiacao_servicos").select("*").eq("politica_id", pid).order("codigo"),
      s.from("premiacao_metas").select("*").eq("politica_id", pid).order("created_at"),
      s.from("premiacao_desabonos").select("*").eq("politica_id", pid).order("codigo"),
      s.from("premiacao_referencias").select("*").eq("politica_id", pid),
      s.from("premiacao_colaboradores").select("*").eq("empresa_id", empresaId).order("nome"),
      s.from("cargos").select("id,nome,area").eq("client_id", empresaId).order("nome"),
      s.from("premiacao_regulamento_versoes").select("*").eq("politica_id", pid).order("versao", { ascending: false }),
      s.from("clientes").select("id, nome, cnpj, nome_fantasia, logo_url").eq("id", empresaId).maybeSingle(),
      s.from("office_branding").select("*").limit(1).maybeSingle(),
    ]);
    const metaIds = (mt.data || []).map((m: any) => m.id);
    const ms = metaIds.length
      ? await s.from("premiacao_metas_servicos").select("*").in("meta_id", metaIds)
      : { data: [] };
    const b: any = brand.data || {};
    const branding = brand.data
      ? { logo_url: b.logo_url || undefined, primary_color: b.primary_color || undefined, office_name: b.office_name || undefined }
      : null;
    return json({
      politica, cliente: clie.data || null, branding,
      medalhas: md.data || [], servicos: sv.data || [], metas: mt.data || [], metas_servicos: ms.data || [],
      desabonos: ds.data || [], referencias: rf.data || [], colaboradores: cl.data || [], cargos: cg.data || [],
      versoes: vs.data || [],
    });
  }

  if (action === "list_lancamentos") {
    let q = s.from("premiacao_lancamentos").select("*").eq("politica_id", pid).eq("competencia", body.competencia).order("data_ocorrencia");
    if (body.colaborador_id) q = q.eq("colaborador_id", body.colaborador_id);
    const { data, error } = await q;
    if (error) throw error;
    return json({ items: data || [] });
  }

  if (action === "list_apuracoes") {
    const { data, error } = await s.from("premiacao_apuracoes").select("*").eq("politica_id", pid).eq("competencia", body.competencia);
    if (error) throw error;
    return json({ items: data || [] });
  }

  if (action === "saldo_anterior") {
    const { data } = await s.from("premiacao_apuracoes").select("colaborador_id, saldo_transportado, saldo_apurado")
      .eq("politica_id", pid).eq("status", "fechada").lt("competencia", body.competencia)
      .order("competencia", { ascending: false }).limit(500);
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { if (!(r.colaborador_id in map)) map[r.colaborador_id] = r.saldo_transportado ?? r.saldo_apurado ?? 0; });
    return json({ saldos: map });
  }

  if (action === "lancar") {
    const { colaborador_id, competencia, codigo, quantidade, data_ocorrencia, observacao, referencia_os } = body;
    if (!colaborador_id || !competencia || !codigo) return json({ error: "Informe colaborador, competência e código" }, 400);
    const qtd = Math.max(1, Math.min(999, Number(quantidade) || 1));

    // competência fechada não aceita lançamento
    const { data: fech } = await s.from("premiacao_apuracoes").select("id").eq("politica_id", pid)
      .eq("competencia", competencia).in("status", ["fechada", "exportada"]).limit(1);
    if (fech && fech.length) return json({ error: "Competência fechada — peça a reabertura ao escritório" }, 400);

    const { data: colab } = await s.from("premiacao_colaboradores").select("*").eq("id", colaborador_id).eq("empresa_id", empresaId).maybeSingle();
    if (!colab) return json({ error: "Colaborador não encontrado" }, 404);

    const { data: serv } = await s.from("premiacao_servicos").select("*").eq("politica_id", pid).eq("codigo", codigo).eq("ativo", true).maybeSingle();
    const { data: des } = serv ? { data: null } : await s.from("premiacao_desabonos").select("*").eq("politica_id", pid).eq("codigo", codigo).eq("ativo", true).maybeSingle();
    if (!serv && !des) return json({ error: `Código ${codigo} não encontrado` }, 404);

    if (serv) {
      if (serv.limite_por_competencia) {
        const { data: exist } = await s.from("premiacao_lancamentos").select("quantidade")
          .eq("politica_id", pid).eq("competencia", competencia).eq("colaborador_id", colaborador_id).eq("servico_id", serv.id);
        const total = (exist || []).reduce((t: number, l: any) => t + l.quantidade, 0);
        if (total + qtd > serv.limite_por_competencia)
          return json({ error: `Limite de ${serv.limite_por_competencia} por mês para o código ${codigo} (já há ${total})` }, 400);
      }
      let pontos = 0;
      if (serv.gera_pontos) {
        if (serv.pontos_override !== null && serv.pontos_override !== undefined) pontos = serv.pontos_override;
        else if (serv.medalha_id) {
          const { data: md } = await s.from("premiacao_medalhas").select("pontos_padrao").eq("id", serv.medalha_id).maybeSingle();
          pontos = md?.pontos_padrao ?? 0;
        }
      }
      const { error } = await s.from("premiacao_lancamentos").insert({
        empresa_id: empresaId, politica_id: pid, colaborador_id, competencia,
        data_ocorrencia: data_ocorrencia || new Date().toISOString().slice(0, 10),
        tipo: "servico", servico_id: serv.id, codigo: serv.codigo, descricao: serv.descricao,
        quantidade: qtd, pontos_unitarios: pontos, pontos_total: pontos * qtd, gera_pontos: serv.gera_pontos,
        referencia_os: referencia_os || null, observacao: observacao || null,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    // desabono
    if (!observacao || !String(observacao).trim()) return json({ error: "Desabono exige observação" }, 400);
    const { error } = await s.from("premiacao_lancamentos").insert({
      empresa_id: empresaId, politica_id: pid, colaborador_id, competencia,
      data_ocorrencia: data_ocorrencia || new Date().toISOString().slice(0, 10),
      tipo: "desabono", desabono_id: des.id, codigo: des.codigo, descricao: des.descricao,
      quantidade: qtd, pontos_unitarios: des.pontos, pontos_total: des.pontos * qtd, gera_pontos: false,
      referencia_os: referencia_os || null, observacao,
    });
    if (error) throw error;
    return json({ ok: true });
  }

  if (action === "add_colaborador") {
    const { codigo, nome, cpf, cargo_id, funcao } = body;
    if (!nome || !String(nome).trim()) return json({ error: "Informe o nome" }, 400);
    const { data, error } = await s.from("premiacao_colaboradores").insert({
      empresa_id: empresaId, codigo: codigo || null, nome: String(nome).trim(),
      cpf: cpf || null, cargo_id: cargo_id || null, funcao: funcao || null,
    }).select("*").single();
    if (error) throw error;
    return json({ ok: true, colaborador: data });
  }

  if (action === "apurar") {
    const { error } = await s.rpc("premiacao_apurar", { p_politica_id: pid, p_competencia: body.competencia });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "fechar" || action === "reabrir") {
    const { error } = await s.rpc(action === "fechar" ? "premiacao_fechar" : "premiacao_reabrir", { p_politica_id: pid, p_competencia: body.competencia });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "get_feedback") {
    const { data } = await s.from("premiacao_feedbacks").select("*").eq("politica_id", pid)
      .eq("colaborador_id", body.colaborador_id).eq("competencia", body.competencia).maybeSingle();
    return json({ feedback: data || null });
  }

  if (action === "save_feedback") {
    const texto = String(body.texto || "").slice(0, 20000);
    if (!texto.trim() || !body.colaborador_id || !body.competencia) return json({ error: "Dados incompletos" }, 400);
    const { data: colab } = await s.from("premiacao_colaboradores").select("id").eq("id", body.colaborador_id).eq("empresa_id", empresaId).maybeSingle();
    if (!colab) return json({ error: "Colaborador não encontrado" }, 404);
    const { error } = await s.from("premiacao_feedbacks").upsert({
      empresa_id: empresaId, politica_id: pid, colaborador_id: body.colaborador_id, competencia: body.competencia,
      texto, origem: body.origem === "ia" ? "ia" : "manual",
    }, { onConflict: "politica_id,colaborador_id,competencia" });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Ação inválida" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action } = body;
    if (action === "manage_link") return await manageLink(body, req.headers.get("Authorization") || "");
    const { token, senha } = body;
    if (!token) return json({ error: "Token ausente" }, 400);
    const { link, error } = await authLink(token, senha);
    if (error) return error;
    return await handle(action, link, body);
  } catch (e: any) {
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
