import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, GraduationCap, FileText,
  Megaphone, FolderOpen, BarChart3, Award, LogOut, ChevronRight,
  Eye
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/monitor-students', label: 'Monitor Students', icon: Eye },
  { path: '/officers', label: 'Officers', icon: UserCog },
  { path: '/instructors', label: 'Instructors', icon: GraduationCap },
  { path: '/grades', label: 'Grades', icon: FileText },
  { path: '/announcements', label: 'Announcements', icon: Megaphone },
  { path: '/documents', label: 'Documents', icon: FolderOpen },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/certificate', label: 'Certificate Request', icon: Award },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside style={{
      width: '260px', backgroundColor: 'var(--sidebar-bg)', height: '100vh',
      position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column',
      color: '#fff', zIndex: 100, overflowY: 'auto'
    }}>
      <div style={{ padding: '24px 20px 20px' }}>
        {/* ===== LOGO SECTION ===== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Option A: Image Logo */}
          <img
            src="images/marsulogo.png"
            alt="MARSU Logo"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />

          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px', margin: 0, lineHeight: 1.2 }}>
              MARSU â NSTP
            </h1>
            <p style={{ fontSize: '10px', color: 'var(--gold-light)', margin: '2px 0 0', letterSpacing: '0.8px', opacity: 0.9 }}>
              Excellence â¢ Service â¢ Leadership
            </p>
          </div>
        </div>

        {/* ===== USER PROFILE SECTION ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginTop: '28px',
          padding: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Users size={18} color="#fff" />
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            {/* Palitan mo ito kung gusto mong baguhin yung pangalan at role */}
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>
              NSTP Director
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 14px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.path} to={item.path} style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
              marginBottom: '4px', borderRadius: '10px', textDecoration: 'none',
              color: isActive ? 'var(--gold-light)' : 'rgba(255,255,255,0.75)',
              backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
              fontSize: '14px', fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
            }}>{Icon && <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />}
              <span>{item.label}</span>
              {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ padding: '16px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => navigate('/')} style={{
          display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
          padding: '12px 16px', background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 500,
          cursor: 'pointer', borderRadius: '10px', transition: 'all 0.2s ease',
          fontFamily: 'inherit'
        }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}>
          <LogOut size={20} /><span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
