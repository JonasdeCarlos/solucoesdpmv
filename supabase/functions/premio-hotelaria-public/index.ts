import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supa = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Fields on prize_policies the pousada can patch through the public link
const POLICY_PATCH_WHITELIST = new Set([
  "hotelaria_config",
  "hotelaria_pontos",
  "hotelaria_apuracao",
  "hotelaria_apuracoes",
  "objetivo",
  "aviso_legal",
]);

// Guarantee the assessment belongs to the given policy
async function assertAssessmentInPolicy(s: ReturnType<typeof supa>, assessment_id: string, policy_id: string) {
  const { data, error } = await s.from("prize_assessments").select("id, policy_id").eq("id", assessment_id).maybeSingle();
  if (error) throw error;
  if (!data || data.policy_id !== policy_id) throw new Error("assessment_id fora da política");
}

async function assertAeInPolicy(s: ReturnType<typeof supa>, ae_id: string, policy_id: string) {
  const { data, error } = await s
    .from("prize_assessment_employees")
    .select("id, assessment:prize_assessments(policy_id)")
    .eq("id", ae_id)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data as any).assessment?.policy_id !== policy_id) throw new Error("assessment_employee fora da política");
}

async function handle(action: string, policy_id: string, body: any) {
  const s = supa();

  if (action === "get_bundle") {
    const { data: policy, error } = await s.from("prize_policies").select("*").eq("id", policy_id).maybeSingle();
    if (error) throw error;
    if (!policy) return json({ error: "Política não encontrada" }, 404);
    if (policy.modelo_template !== "hotelaria") return json({ error: "Política não é do modelo Hotelaria" }, 400);
    const [{ data: cliente }, { data: criteria }, { data: employees }] = await Promise.all([
      s.from("clientes").select("id, nome, cnpj, nome_fantasia").eq("id", policy.client_id).maybeSingle(),
      s.from("prize_criteria").select("*").eq("policy_id", policy_id).order("ordem", { ascending: true }),
      s.from("prize_employees").select("*").eq("policy_id", policy_id).order("nome"),
    ]);
    return json({ policy, cliente: cliente || null, criteria: criteria || [], employees: employees || [] });
  }

  if (action === "list_criteria") {
    const { data } = await s.from("prize_criteria").select("*").eq("policy_id", policy_id).order("ordem");
    return json({ items: data || [] });
  }
  if (action === "list_employees") {
    const { data } = await s.from("prize_employees").select("*").eq("policy_id", policy_id).order("nome");
    return json({ items: data || [] });
  }
  if (action === "list_assessments") {
    const { data } = await s.from("prize_assessments").select("*").eq("policy_id", policy_id).order("competencia", { ascending: false });
    return json({ items: data || [] });
  }
  if (action === "list_assessment_employees") {
    await assertAssessmentInPolicy(s, body.assessment_id, policy_id);
    const { data } = await s.from("prize_assessment_employees").select("*, employee:prize_employees(*)").eq("assessment_id", body.assessment_id);
    return json({ items: data || [] });
  }
  if (action === "list_criterion_results") {
    await assertAeInPolicy(s, body.assessment_employee_id, policy_id);
    const { data } = await s.from("prize_assessment_criterion_results").select("*").eq("assessment_employee_id", body.assessment_employee_id);
    return json({ items: data || [] });
  }

  if (action === "update_policy") {
    const patch: any = {};
    for (const k of Object.keys(body.patch || {})) {
      if (POLICY_PATCH_WHITELIST.has(k)) patch[k] = body.patch[k];
    }
    if (Object.keys(patch).length === 0) return json({ ok: true });
    const { error } = await s.from("prize_policies").update(patch).eq("id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }

  if (action === "create_criterion") {
    const { error } = await s.from("prize_criteria").insert({ ...body.payload, policy_id });
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "create_criteria_many") {
    const rows = (body.rows || []).map((r: any) => ({ ...r, policy_id }));
    if (rows.length === 0) return json({ ok: true });
    const { error } = await s.from("prize_criteria").insert(rows);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "update_criterion") {
    const { error } = await s.from("prize_criteria").update(body.patch).eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "delete_criterion") {
    const { error } = await s.from("prize_criteria").delete().eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }

  if (action === "create_employee") {
    const { error } = await s.from("prize_employees").insert({ ativo: true, ...body.payload, policy_id });
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "create_employees_many") {
    const rows = (body.rows || []).map((r: any) => ({ ativo: true, ...r, policy_id }));
    if (rows.length === 0) return json({ ok: true });
    const { error } = await s.from("prize_employees").insert(rows);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "update_employee") {
    const { error } = await s.from("prize_employees").update(body.patch).eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "delete_employee") {
    const { error } = await s.from("prize_employees").delete().eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }

  if (action === "create_assessment") {
    const { data, error } = await s
      .from("prize_assessments")
      .insert({ policy_id, competencia: body.competencia, observacao: body.observacao || null })
      .select("*")
      .single();
    if (error) throw error;
    return json({ item: data });
  }
  if (action === "update_assessment") {
    const { error } = await s.from("prize_assessments").update(body.patch).eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "delete_assessment") {
    const { error } = await s.from("prize_assessments").delete().eq("id", body.id).eq("policy_id", policy_id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "enroll_assessment") {
    await assertAssessmentInPolicy(s, body.assessment_id, policy_id);
    const { data: emps } = await s.from("prize_employees").select("id").eq("policy_id", policy_id).eq("ativo", true);
    if (!emps?.length) return json({ count: 0 });
    const rows = emps.map((e: any) => ({ assessment_id: body.assessment_id, employee_id: e.id }));
    const { error } = await s
      .from("prize_assessment_employees")
      .upsert(rows, { onConflict: "assessment_id,employee_id", ignoreDuplicates: true });
    if (error) throw error;
    return json({ count: rows.length });
  }
  if (action === "update_assessment_employee") {
    await assertAeInPolicy(s, body.id, policy_id);
    const { error } = await s.from("prize_assessment_employees").update(body.patch).eq("id", body.id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "delete_assessment_employee") {
    await assertAeInPolicy(s, body.id, policy_id);
    await s.from("prize_assessment_criterion_results").delete().eq("assessment_employee_id", body.id);
    const { error } = await s.from("prize_assessment_employees").delete().eq("id", body.id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "upsert_criterion_result") {
    await assertAeInPolicy(s, body.assessment_employee_id, policy_id);
    const { error } = await s
      .from("prize_assessment_criterion_results")
      .upsert(
        { assessment_employee_id: body.assessment_employee_id, criterion_id: body.criterion_id, ...body.patch },
        { onConflict: "assessment_employee_id,criterion_id" }
      );
    if (error) throw error;
    return json({ ok: true });
  }

  throw new Error("Ação inválida");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Backwards-compat: GET without action returns the original bundle
    const url = new URL(req.url);
    let policy_id = url.searchParams.get("policy_id") || url.searchParams.get("id");
    let action = url.searchParams.get("action") || "get_bundle";
    let body: any = {};
    if (req.method !== "GET") {
      body = await req.json().catch(() => ({}));
      policy_id = policy_id || body.policy_id || body.id;
      action = body.action || action;
    }
    if (!policy_id) throw new Error("policy_id ausente");
    // Backwards-compat: old callers with no action expected the bundle shape.
    if (action === "get" || !action) action = "get_bundle";
    return await handle(action, policy_id, body);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});