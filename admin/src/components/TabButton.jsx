import React from 'react';

export default function TabButton({ label, isActive, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '16px 32px', background: 'none', border: 'none',
      borderBottom: isActive ? '3px solid var(--maroon-dark)' : '3px solid transparent',
      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      fontSize: '14px', fontWeight: isActive ? 700 : 500, cursor: 'pointer',
      transition: 'all 0.2s ease', position: 'relative', fontFamily: 'inherit',
      letterSpacing: isActive ? '0.2px' : '0'
    }} onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}>
      {label}
    </button>
  );
}
