import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'master' | 'admin' | 'user';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoadedFor(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (error) console.error('[useUserRole]', error);
      setRoles(((data || []) as any[]).map((r) => r.role as AppRole));
      setLoadedFor(user.id);
    })();
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  // Loading until roles were fetched for the *current* user (avoids a race right after login)
  const loading = authLoading || loadedFor !== (user ? user.id : null);

  const isMaster = roles.includes('master');
  const isAdmin = isMaster || roles.includes('admin');
  return { roles, isMaster, isAdmin, loading };
}
