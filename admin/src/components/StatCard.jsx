import React from 'react';

const configs = {
  students: { bg: '#FEF3C7', color: '#B45309' },
  officers: { bg: '#FEF3C7', color: '#B45309' },
  instructors: { bg: '#F3E8FF', color: '#7C3AED' },
  announcements: { bg: '#FEF3C7', color: '#B45309' },
  certificates: { bg: '#FEF3C7', color: '#B45309' },
};

export default function StatCard({ title, value, subtitle, icon: Icon, type = 'students' }) {
  const cfg = configs[type] || configs.students;

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '22px 20px',
      boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'flex-start', gap: '16px',
      minWidth: '170px', flex: 1, border: '1px solid var(--border)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default'
    }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
      <div style={{
        width: '50px', height: '50px', borderRadius: '14px', background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={24} color={cfg.color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px', fontWeight: 500 }}>{title}</p>
        <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>{subtitle}</p>
      </div>
    </div>
  );
}
