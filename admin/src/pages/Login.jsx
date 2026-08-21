import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../hooks/useApi';

export default function Login() {
  const { login, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!initializing && isAuthenticated) {
    const dest = location.state?.from?.pathname || '/';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, var(--maroon) 100%)', padding: '20px',
    }}>
      <div style={{
        width: 'min(940px, 100%)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Brand panel */}
        <div style={{
          background: 'var(--sidebar-bg)', color: '#fff', padding: '48px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px',
        }} className="login-brand-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/images/marsulogo.png"
              alt="MARSU Logo"
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>MARSU — NSTP</h1>
              <p style={{ fontSize: '11px', color: 'var(--gold-light)', margin: '2px 0 0', letterSpacing: '0.6px' }}>
                Excellence • Service • Leadership
              </p>
            </div>
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '18px 0 0', lineHeight: 1.3 }}>
            NSTP Management<br />Admin Portal
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>
            Manage CWTS and ROTC students, cadets, officers, attendance, grades, and announcements
            from a single dashboard.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>
            <ShieldCheck size={16} />
            <span>Restricted to authorized NSTP administrators.</span>
          </div>
        </div>

        {/* Form panel */}
        <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>Sign In</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 28px' }}>
            Enter your administrator credentials to continue.
          </p>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C',
              borderRadius: '10px', padding: '12px 16px', fontSize: '13px', fontWeight: 500,
              marginBottom: '18px', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
            <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Email Address
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@marsu.edu.ph"
                  style={{
                    width: '100%', padding: '13px 14px 13px 42px', borderRadius: '10px',
                    border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit',
                    outline: 'none', color: 'var(--text-primary)',
                  }}
                />
              </div>
            </label>

            <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Password
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%', padding: '13px 42px 13px 42px', borderRadius: '10px',
                    border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit',
                    outline: 'none', color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: '6px', padding: '14px', borderRadius: '10px', border: 'none',
                background: 'var(--sidebar-bg)', color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.75 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .login-brand-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
