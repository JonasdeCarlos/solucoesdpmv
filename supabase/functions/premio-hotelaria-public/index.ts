import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let policy_id = url.searchParams.get("policy_id") || url.searchParams.get("id");
    if (!policy_id) {
      const body = await req.json().catch(() => ({}));
      policy_id = body.policy_id || body.id;
    }
    if (!policy_id) throw new Error("policy_id ausente");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: policy, error } = await supa
      .from("prize_policies")
      .select("*")
      .eq("id", policy_id)
      .maybeSingle();
    if (error) throw error;
    if (!policy) return new Response(JSON.stringify({ error: "Política não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (policy.modelo_template !== "hotelaria") {
      return new Response(JSON.stringify({ error: "Política não é do modelo Hotelaria" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: cliente }, { data: criteria }, { data: employees }] = await Promise.all([
      supa.from("clientes").select("nome, cnpj, razao_social, nome_fantasia").eq("id", policy.client_id).maybeSingle(),
      supa.from("prize_criteria").select("nome, descricao, peso, essencial, ordem").eq("policy_id", policy.id).order("ordem", { ascending: true }),
      supa.from("prize_employees").select("id, nome, cpf, cargo, matricula, ativo, pontos").eq("policy_id", policy.id).eq("ativo", true).order("nome"),
    ]);

    return new Response(JSON.stringify({
      policy,
      cliente: cliente || null,
      criteria: criteria || [],
      employees: employees || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});