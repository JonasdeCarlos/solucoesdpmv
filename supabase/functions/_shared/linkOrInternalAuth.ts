import { requireInternalUser } from './internalAuth.ts';

/** Reuse each link's existing revocation, expiry, password and scope validation. */
export async function requireLinkOrInternal(req: Request, cors: Record<string, string>, kind: 'premiacao' | 'premio' | 'escala' | 'pec') {
  const denied = await requireInternalUser(req, cors);
  if (!denied) return null;
  const commercial = req.headers.get('x-commercial-token');
  if (commercial && (kind === 'pec' || kind === 'escala') && /^[a-f0-9]{64}$/.test(commercial)) {
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pec-comercial`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' }, body: JSON.stringify({ action: 'authorize', token: commercial }),
      });
      const data = await r.json();
      if (r.ok && data.empresa && !data.error) return null;
    } catch { /* fail closed */ }
    return denied;
  }
  const credential = req.headers.get('x-external-token');
  if (!credential || credential.length > 200) return denied;
  const password = req.headers.get('x-external-password') || '';
  const endpoint = { premiacao: 'premiacao-public', premio: 'premio-hotelaria-public', escala: 'escala-publica', pec: 'pec-publica' }[kind];
  const body = kind === 'premio' ? { policy_id: credential, password, action: 'get_bundle' }
    : { token: credential, senha: password, pin: password, action: kind === 'escala' ? 'open' : kind === 'pec' ? 'load' : 'get_bundle' };
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.error || data.requires_password || data.precisa_pin) return denied;
    const valid = kind === 'premio' ? !!data.policy : kind === 'premiacao' ? !!data.politica : kind === 'escala' ? !!data.cliente : !!data.empresa;
    return valid ? null : denied;
  } catch { return denied; }
}