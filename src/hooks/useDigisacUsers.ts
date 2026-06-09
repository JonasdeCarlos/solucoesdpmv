import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DigisacUser { id: string; nome: string; email: string | null; }

let cache: { ts: number; users: DigisacUser[] } | null = null;
const STALE_MS = 5 * 60 * 1000;

export function useDigisacUsers() {
  const [users, setUsers] = useState<DigisacUser[]>(cache?.users || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cache && Date.now() - cache.ts < STALE_MS) {
        setUsers(cache.users); setLoading(false); return;
      }
      setLoading(true); setError(null);
      const { data, error } = await supabase.functions.invoke('digisac-list-users', { body: {} });
      if (cancelled) return;
      if (error || (data as any)?.erro) {
        setError(error?.message || (data as any)?.erro || 'Falha ao carregar gestores');
        setLoading(false);
        return;
      }
      const list: DigisacUser[] = (data as any)?.usuarios || [];
      cache = { ts: Date.now(), users: list };
      setUsers(list);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => { cache = null; };

  return { users, loading, error, refresh };
}