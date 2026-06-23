import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (await req.json().catch(() => ({}))).token;
    if (!token) throw new Error("token ausente");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supa
      .from("feedback_records")
      .select("id, client_id, tipo, employee_name, employee_role, manager_name, tom, generated_text, signed_at, signed_by, created_at")
      .eq("public_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response(JSON.stringify({ error: "Registro não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cli } = await supa.from("clientes").select("nome").eq("id", data.client_id).maybeSingle();

    // log visualização
    const ua = req.headers.get("user-agent") || "";
    const ip = req.headers.get("x-forwarded-for") || "";
    await supa.rpc("noop").catch(() => {});
    const { data: rec } = await supa.from("feedback_records").select("view_log").eq("public_token", token).maybeSingle();
    const log = Array.isArray(rec?.view_log) ? rec!.view_log : [];
    log.push({ at: new Date().toISOString(), ua, ip });
    await supa.from("feedback_records").update({ view_log: log }).eq("public_token", token);

    return new Response(JSON.stringify({ ...data, empresa: cli?.nome || "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});