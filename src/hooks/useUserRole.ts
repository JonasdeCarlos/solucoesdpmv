import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'master' | 'admin' | 'user';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id);
      if (cancelled) return;
      setRoles(((data || []) as any[]).map((r) => r.role as AppRole));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const isMaster = roles.includes('master');
  const isAdmin = isMaster || roles.includes('admin');
  return { roles, isMaster, isAdmin, loading };
}
