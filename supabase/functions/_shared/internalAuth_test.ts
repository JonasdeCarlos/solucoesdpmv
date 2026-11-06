import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { requireInternalUser } from './internalAuth.ts';
import { requireLinkOrInternal } from './linkOrInternalAuth.ts';

Deno.test('Internal access rejects callers without a session', async () => {
  const response = await requireInternalUser(new Request('http://localhost'), {});
  assertEquals(response?.status, 401);
});

Deno.test('External AI rejects absent or invalid manager links', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Link inválido' }), { status: 404 });
  try {
    assertEquals((await requireLinkOrInternal(new Request('http://localhost'), {}, 'premiacao'))?.status, 401);
    assertEquals((await requireLinkOrInternal(new Request('http://localhost', { headers: { 'x-external-token': 'invalid-link' } }), {}, 'premiacao'))?.status, 401);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test('External AI accepts a manager link only after successful link validation', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ politica: { id: 'test-policy' } }), { headers: { 'Content-Type': 'application/json' } });
  try {
    assertEquals(await requireLinkOrInternal(new Request('http://localhost', { headers: { 'x-external-token': 'valid-test-link' } }), {}, 'premiacao'), null);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test('Internal access rejects invalid sessions before checking roles', async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = Deno.env.get('SUPABASE_URL');
  const oldKey = Deno.env.get('SUPABASE_ANON_KEY');
  Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
  Deno.env.set('SUPABASE_ANON_KEY', 'test-key');
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401 });
  try {
    const response = await requireInternalUser(new Request('http://localhost', { headers: { Authorization: 'Bearer invalid' } }), {});
    assertEquals(response?.status, 401);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) Deno.env.delete('SUPABASE_URL'); else Deno.env.set('SUPABASE_URL', oldUrl);
    if (oldKey === undefined) Deno.env.delete('SUPABASE_ANON_KEY'); else Deno.env.set('SUPABASE_ANON_KEY', oldKey);
  }
});

Deno.test('A valid session without an internal role is rejected', async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = Deno.env.get('SUPABASE_URL');
  const oldKey = Deno.env.get('SUPABASE_ANON_KEY');
  Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
  Deno.env.set('SUPABASE_ANON_KEY', 'test-key');
  globalThis.fetch = async (input) => new Response(JSON.stringify(String(input).includes('/auth/v1/user')
    ? { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated' } : []), { headers: { 'Content-Type': 'application/json' } });
  try {
    const response = await requireInternalUser(new Request('http://localhost', { headers: { Authorization: 'Bearer valid-test-session' } }), {});
    assertEquals(response?.status, 403);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) Deno.env.delete('SUPABASE_URL'); else Deno.env.set('SUPABASE_URL', oldUrl);
    if (oldKey === undefined) Deno.env.delete('SUPABASE_ANON_KEY'); else Deno.env.set('SUPABASE_ANON_KEY', oldKey);
  }
});