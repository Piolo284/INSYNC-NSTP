import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route element; redirects to /login when not authenticated, and
 * optionally gates by role (e.g. roles={['super_admin']} for admin-only
 * screens). The backend enforces this for real — this is purely for UX.
 */
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, initializing, currentUser } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length && !roles.includes(currentUser?.role)) {
    return (
      <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <h2>Access Denied</h2>
        <p style={{ marginTop: '8px' }}>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
