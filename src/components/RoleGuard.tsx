import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { profile } = useAuthStore();

  // If no role or role not in allowed roles, redirect to home
  if (!profile?.role?.name || !allowedRoles.includes(profile.role.name)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}