import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'office_member_until';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function isAuthorized(): boolean {
  const v = localStorage.getItem(KEY);
  if (!v) return false;
  const ts = parseInt(v, 10);
  return !isNaN(ts) && Date.now() < ts;
}

export function useOfficeAuth() {
  const [authorized, setAuthorized] = useState<boolean>(() => isAuthorized());

  useEffect(() => {
    const onStorage = () => setAuthorized(isAuthorized());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('office-auth', {
      body: { password },
    });
    if (error) return false;
    if (data?.ok) {
      localStorage.setItem(KEY, String(Date.now() + TTL_MS));
      setAuthorized(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setAuthorized(false);
  }, []);

  return { authorized, login, logout };
}