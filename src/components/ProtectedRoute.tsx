import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();
  const location = useLocation();

  const noRole = !!user && !rolesLoading && roles.length === 0;

  useEffect(() => {
    if (noRole) {
      toast.error('Acesso não autorizado. Solicite convite ao administrador.');
      supabase.auth.signOut();
    }
  }, [noRole]);

  if (loading || (user && rolesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || noRole) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
