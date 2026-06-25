import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client_id } = await req.json().catch(() => ({ client_id: null }));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Busca CCTs próximas do vencimento (<= 90 dias) ou já vencidas
    let query = admin
      .from("client_ccts")
      .select("id, client_id, sindicato, union_base, uf, validity_end, doc_name, clientes:client_id(nome)")
      .is("deleted_at", null)
      .not("validity_end", "is", null)
      .lte("validity_end", new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
    if (client_id) query = query.eq("client_id", client_id);
    const { data: ccts, error: cctErr } = await query;
    if (cctErr) throw cctErr;

    if (!ccts || ccts.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, message: "Nenhuma CCT próxima do vencimento (≤ 90 dias)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Destinatários = usuários do sistema (invited_emails)
    const { data: convidados } = await admin.from("invited_emails").select("email");
    const destinos = (convidados || []).map((r: any) => r.email).filter(Boolean);

    if (destinos.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, message: "Nenhum usuário cadastrado para receber o aviso." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const linhas = ccts.map((c: any) => {
      const dias = Math.ceil((new Date(c.validity_end).getTime() - Date.now()) / 86400000);
      const cliente = (c.clientes as any)?.nome || "—";
      return `• ${cliente} — ${c.sindicato || "Sindicato"} ${c.uf ? "(" + c.uf + ")" : ""} — vence em ${new Date(c.validity_end).toLocaleDateString("pt-BR")} ${dias < 0 ? `(VENCIDA há ${Math.abs(dias)}d)` : `(em ${dias}d)`}`;
    }).join("\n");

    const subject = `[CCT] ${ccts.length} convenção(ões) próxima(s) do vencimento`;
    const text = `Aviso automático — CCTs próximas do vencimento\n\n${linhas}\n\nAcesse o sistema para tratativas.`;

    // Tenta enviar via Resend (preferencial). Caso não exista, retorna instrução.
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const SENDER = Deno.env.get("CCT_NOTIFY_FROM") || "Aviso CCT <onboarding@resend.dev>";

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({
        enviados: 0,
        message: "Envio de e-mail ainda não configurado. Solicite ao administrador habilitar o canal (Resend ou domínio de e-mail).",
        preview: { subject, text, destinatarios: destinos },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: SENDER,
        to: destinos,
        subject,
        text,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Resend error ${resp.status}: ${err}`);
    }

    return new Response(JSON.stringify({ enviados: destinos.length, ccts: ccts.length, message: `Aviso enviado para ${destinos.length} destinatário(s).` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});