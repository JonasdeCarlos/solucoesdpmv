import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'No auth' }, 401);

    // Validate caller and check admin/master role
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc('is_admin_or_master', { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || password.length < 6) {
      return json({ error: 'E-mail e senha (mín. 6 caracteres) obrigatórios.' }, 400);
    }

    // Find existing user by paginating through listUsers
    let existing: { id: string; email?: string | null } | undefined;
    for (let page = 1; page <= 20 && !existing; page++) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) return json({ error: 'listUsers: ' + listErr.message }, 500);
      existing = list.users.find((u) => (u.email || '').toLowerCase() === email);
      if (!list.users.length || list.users.length < 200) break;
    }

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (error) return json({ error: 'updateUser: ' + error.message }, 500);
      return json({ ok: true, action: 'updated', user_id: existing.id });
    }

    // Ensure email is whitelisted (trigger requires it)
    const { data: invited } = await admin
      .from('invited_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    if (!invited) {
      await admin.from('invited_emails').insert({
        email,
        role: 'user',
        invited_by: userData.user.email || 'admin',
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      // Fallback: if user actually already exists, try to locate and update
      if (/already|registered|exists/i.test(error.message)) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users.find((u) => (u.email || '').toLowerCase() === email);
        if (found) {
          const { error: upErr } = await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
          if (upErr) return json({ error: 'updateUser(fallback): ' + upErr.message }, 500);
          return json({ ok: true, action: 'updated', user_id: found.id });
        }
      }
      return json({ error: 'createUser: ' + error.message }, 500);
    }
    return json({ ok: true, action: 'created', user_id: data.user?.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}