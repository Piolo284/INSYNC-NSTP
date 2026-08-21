import React from 'react';
import { User } from 'lucide-react';

export default function StudentListItem({ student, showNotify = false, onNotify }) {
  const handleNotify = () => {
    if (onNotify) onNotify(student.id);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
      background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '12px',
      boxShadow: 'var(--shadow)', border: '1px solid var(--border)', transition: 'box-shadow 0.2s ease'
    }} onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%', background: '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        overflow: 'hidden', border: '2px solid var(--border)'
      }}>
        {student.avatar ? (
          <img src={student.avatar} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <User size={22} color="#9CA3AF" />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{student.name}</h4>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 500 }}>
          {student.course} / {student.year}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>{student.studentId}</p>
        {showNotify && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 500 }}>{student.program}</p>
            <p style={{ fontSize: '13px', color: '#DC2626', margin: '2px 0 0', fontWeight: 700 }}>Absences: {student.absences}</p>
          </>
        )}
      </div>

      {showNotify ? (
        <button onClick={handleNotify} style={{
          padding: '8px 28px', borderRadius: '8px', border: '1.5px solid var(--maroon)',
          background: 'transparent', color: 'var(--maroon)', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit', minWidth: '90px'
        }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--maroon)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--maroon)'; }}>
          Notify
        </button>
      ) : (
        <span style={{
          padding: '6px 16px', borderRadius: '20px', background: '#FEF2F2',
          color: 'var(--red-status)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.3px'
        }}>Dropped out</span>
      )}
    </div>
  );
}
