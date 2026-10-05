import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings, Palette, ShieldCheck, KeyRound, Layers, History, LogOut, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveFileUrl } from '../api/client';

/**
 * Separate nav for system_maintenance_admin — deliberately carries none of
 * Sidebar.jsx's NSTP-data links (Students, Grades, Announcements, etc.), not
 * merely hidden ones, since this role must never see them exist. Masterlist,
 * password reset request review, Programs & Brigades management, and the
 * account-security audit log all live here exclusively — super_admin has
 * none of them.
 */
const navItems = [
  { path: '/master-enrollment', label: 'Masterlist', icon: ShieldCheck },
  { path: '/password-reset-requests', label: 'Password Resets', icon: KeyRound },
  { path: '/programs', label: 'Programs & Brigades', icon: Layers },
  { path: '/account-activity', label: 'Account Activity', icon: History },
  { path: '/system-settings', label: 'System Settings', icon: Settings },
  { path: '/certificate-templates', label: 'Certificate Templates', icon: Palette },
  { path: '/announcement-templates', label: 'Announcement Templates', icon: Megaphone },
];

export default function MaintenanceSidebar() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = (currentUser?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  return (
    <aside style={{
      width: '260px', backgroundColor: 'var(--sidebar-bg)', height: '100vh',
      position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column',
      color: '#fff', zIndex: 100, overflowY: 'auto'
    }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/images/marsulogo.png"
            alt="MARSU Logo"
            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px', margin: 0, lineHeight: 1.2 }}>
              iNSync
            </h1>
            <p style={{ fontSize: '10px', color: 'var(--gold-light)', margin: '2px 0 0', letterSpacing: '0.8px', opacity: 0.9 }}>
              System Maintenance
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginTop: '28px',
          padding: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden'
          }}>
            {currentUser?.profileImage ? (
              <img src={resolveFileUrl(currentUser.profileImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{initials || '?'}</span>
            )}
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name || 'Admin'}
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>
              System Maintenance Administrator
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 14px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                marginBottom: '4px', borderRadius: '10px', textDecoration: 'none',
                color: isActive ? 'var(--gold-light)' : 'rgba(255,255,255,0.75)',
                backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                fontSize: '14px', fontWeight: isActive ? 600 : 500,
                borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
              })}
            >
              {Icon && <Icon size={20} strokeWidth={1.8} />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
            marginBottom: '4px', borderRadius: '10px', textDecoration: 'none',
            color: isActive ? 'var(--gold-light)' : 'rgba(255,255,255,0.75)',
            backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
            fontSize: '14px', fontWeight: isActive ? 600 : 500,
            borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
          })}
        >
          <Settings size={20} strokeWidth={1.8} />
          <span>Profile</span>
        </NavLink>
      </nav>

      <div style={{ padding: '16px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
          padding: '12px 16px', background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 500,
          cursor: 'pointer', borderRadius: '10px', fontFamily: 'inherit'
        }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}>
          <LogOut size={20} /><span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
