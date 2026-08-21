import React, { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import TopBar from '../components/TopBar';

const grades = [
  { id: '1', name: 'Piolo Privado', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', grade: '95', rating: 'Outstanding' },
  { id: '2', name: 'Lorenz Mira', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', grade: '95', rating: 'Outstanding' },
];

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ position: 'relative', display: 'block' }}>
      <span style={{ position: 'absolute', left: '-9999px' }}>{label}</span>
      <select value={value} onChange={onChange} aria-label={label} style={{
        appearance: 'none', width: '100%', minWidth: '160px', padding: '12px 38px 12px 16px',
        border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)',
        color: 'var(--text-primary)', font: '600 13px inherit', cursor: 'pointer', outline: 'none'
      }}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '12px', pointerEvents: 'none' }} />
    </label>
  );
}

export default function Grades() {
  const [program, setProgram] = useState('CWTS');
  const [activity, setActivity] = useState('Select Activity');

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Grades" />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <SelectField label="Program" value={program} onChange={e => setProgram(e.target.value)} options={['All', 'CWTS', 'ROTC']} />
            <SelectField label="Activity" value={activity} onChange={e => setActivity(e.target.value)} options={['Select Activity', 'Midterm Assessment', 'Final Assessment']} />
          </div>
          {grades.map(student => (
            <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <FileText size={20} color="var(--maroon-dark)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{student.name}</p>
                <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.course} - {student.year}</p>
                <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.studentId}</p>
              </div>
              <div style={{ textAlign: 'right', minWidth: '90px' }}>
                <strong style={{ display: 'block', fontSize: '18px', color: '#3C9B50' }}>{student.grade}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{student.rating}</span>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
