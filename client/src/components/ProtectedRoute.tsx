import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requiredRole?: 'USER' | 'ADMIN';
}

export function ProtectedRoute({ children, fallback, requiredRole }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <p>Verifying authentication…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="content-panel" style={{ maxWidth: '420px', marginInline: 'auto', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--color-bad)', margin: '0 0 var(--space-xs)', fontSize: 'var(--text-md)' }}>
          Access restricted
        </h3>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
          You must sign in to view this protected resource.
        </p>
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="content-panel" style={{ maxWidth: '420px', marginInline: 'auto', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--color-bad)', margin: '0 0 var(--space-xs)', fontSize: 'var(--text-md)' }}>
          Insufficient privileges
        </h3>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
          This section requires administrator access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
