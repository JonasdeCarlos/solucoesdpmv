import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { supabase } from '@/integrations/supabase/client';
import { checkPrizePublicReply, invokePrizePublic } from './prizePublicRequest';

describe('protected prize links', () => {
  it('requires a password before exposing the bundle', () => {
    expect(() => checkPrizePublicReply({ requires_password: true })).toThrow(expect.objectContaining({ requiresPassword: true }));
  });
  it('keeps wrong passwords behind the password gate', () => {
    expect(() => checkPrizePublicReply({ requires_password: true, wrong: true })).toThrow(expect.objectContaining({ requiresPassword: true }));
  });
  it('does not swallow access denied responses', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: 'denied' }), { status: 403 }) } } as any);
    await expect(invokePrizePublic({ policy_id: 'test' })).rejects.toThrow('denied');
  });
  it('returns the bundle after server authorization', () => {
    const bundle = { policy: { id: 'authorized' } };
    expect(checkPrizePublicReply(bundle)).toBe(bundle);
  });
});