import React from 'react';
import { Calendar, Bell, Home } from 'lucide-react';

export default function TopBar({ title = 'Dashboard', showBreadcrumb = false }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <header style={{
      height: '72px', background: 'var(--card-bg)', borderRadius: 'var(--radius)',
      margin: '20px 24px 0', padding: '0 28px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {showBreadcrumb ? (
          <>
            <Home size={16} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>Dashboard</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{title}</span>
          </>
        ) : (
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Home size={20} color="var(--maroon-dark)" strokeWidth={2.5} />{title}
          </h2>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
          <Calendar size={18} strokeWidth={1.8} />
          <span>{dateStr}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{timeStr}</span>
        </div>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
          borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Bell size={22} color="var(--text-secondary)" strokeWidth={1.8} />
          <span style={{
            position: 'absolute', top: '6px', right: '6px', width: '9px', height: '9px',
            background: 'var(--red-status)', borderRadius: '50%', border: '2px solid #fff'
          }} />
        </button>
      </div>
    </header>
  );
}
