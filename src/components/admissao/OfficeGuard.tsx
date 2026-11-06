import { Navigate, Outlet } from 'react-router-dom';
import { useOfficeAuth } from '@/hooks/useOfficeAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

const OfficeGuard = () => {
  const { authorized } = useOfficeAuth();
  if (!authorized) return <Navigate to="/admissao/escritorio/login" replace />;
  return <ProtectedRoute><Outlet /></ProtectedRoute>;
};

export default OfficeGuard;