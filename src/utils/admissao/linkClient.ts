import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** A dedicated client scopes the secret to this admission, never to other requests. */
export function admissionClient(token?: string) {
  if (!token) return supabase;
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { 'x-admission-token': token } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}