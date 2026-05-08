import { Navigate, Outlet } from 'react-router-dom';
import { useOfficeAuth } from '@/hooks/useOfficeAuth';

const OfficeGuard = () => {
  const { authorized } = useOfficeAuth();
  if (!authorized) return <Navigate to="/admissao/escritorio/login" replace />;
  return <Outlet />;
};

export default OfficeGuard;