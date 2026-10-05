import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import {
  ApiClientError,
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  setUnauthorizedHandler,
} from '../api/client';

const AuthContext = createContext(null);

// Only these roles may use this admin panel — students/cadets/officers
// sign in through the separate Flutter mobile app. system_maintenance_admin
// is a technical-maintenance-only role (see Sidebar.jsx/App.js) — it shares
// this login gate but gets a completely separate shell once inside.
const ALLOWED_ROLES = ['admin_cwts', 'admin_rotc', 'super_admin', 'system_maintenance_admin'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
  }, []);

  // Wire the api client's 401 handler to a real logout so an expired session
  // anywhere in the app drops the user back to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setCurrentUser(null);
    });
  }, []);

  // Revalidate the stored token once on load; drop the session quietly if
  // it's no longer valid instead of leaving a stale "logged in" state.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const token = getToken();
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const res = await authApi.me();
        if (!cancelled) {
          setCurrentUser(res.data.user);
          setStoredUser(res.data.user);
        }
      } catch (err) {
        if (!cancelled) {
          clearSession();
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lets any screen (e.g. a profile-picture upload) push a fresh user object
  // from the server into both state and localStorage in one call, so every
  // consumer of currentUser (sidebars, TopBar, etc.) updates immediately.
  const updateCurrentUser = useCallback((user) => {
    setCurrentUser(user);
    setStoredUser(user);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    const { token, user } = res.data;

    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new ApiClientError(
        'This portal is for NSTP administrators only. Students, cadets, and officers should use the mobile app.',
        403,
        null
      );
    }

    setToken(token);
    setStoredUser(user);
    setCurrentUser(user);
    return user;
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdminCwts = currentUser?.role === 'admin_cwts';
  const isAdminRotc = currentUser?.role === 'admin_rotc';
  const isSystemMaintenanceAdmin = currentUser?.role === 'system_maintenance_admin';

  // The program a page should actually query/filter by: program-scoped
  // admins are always locked to their own program; super_admin always sees
  // both (no filter).
  const effectiveProgram = useMemo(() => {
    if (!currentUser) return null;
    if (isAdminCwts) return 'CWTS';
    if (isAdminRotc) return 'ROTC';
    return null;
  }, [currentUser, isAdminCwts, isAdminRotc]);

  const value = useMemo(
    () => ({
      currentUser,
      initializing,
      login,
      logout,
      updateCurrentUser,
      isAuthenticated: Boolean(currentUser),
      isSuperAdmin,
      isAdminCwts,
      isAdminRotc,
      isSystemMaintenanceAdmin,
      effectiveProgram,
    }),
    [
      currentUser,
      initializing,
      login,
      logout,
      updateCurrentUser,
      isSuperAdmin,
      isAdminCwts,
      isAdminRotc,
      isSystemMaintenanceAdmin,
      effectiveProgram,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
