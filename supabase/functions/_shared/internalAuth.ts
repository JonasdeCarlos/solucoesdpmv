import { createClient } from 'npm:@supabase/supabase-js@2';

/** Validate the caller on the server; neither an anon key nor a UI flag grants access. */
export async function requireInternalUser(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const deny = (status: number) => new Response(JSON.stringify({ error: 'Acesso restrito a usuários autorizados.' }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return deny(401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return deny(503);
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !data.user) return deny(401);
    const { data: roles, error: roleError } = await client.from('user_roles')
      .select('role').eq('user_id', data.user.id).in('role', ['master', 'admin', 'user']).limit(1);
    if (roleError || !roles?.length) return deny(403);
    return null;
  } catch {
    return deny(503);
  }
}