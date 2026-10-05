import React, { useMemo } from 'react';
import { LineChart } from 'lucide-react';

/**
 * Line chart of this month's daily present-rate, fed straight from
 * GET /api/attendance/summary's `trend` array — a real, already-computed
 * aggregate that the backend has exposed since this project's first
 * attendance work but that no screen has ever rendered until now.
 */
export default function AttendanceTrendChart({ trend }) {
  const points = useMemo(() => (trend || []).map((t) => ({
    label: t.date ? t.date.slice(-2) : '',
    value: Math.round((t.value || 0) * 100),
  })), [trend]);

  if (points.length < 2) return null;

  const width = 640;
  const height = 200;
  const padding = { top: 26, right: 16, bottom: 26, left: 34 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xFor = (i) => padding.left + (i / (points.length - 1)) * chartW;
  const yFor = (v) => padding.top + chartH - (v / 100) * chartH;
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ');
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LineChart size={16} color="#059669" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Daily Present Rate — This Month</h4>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Percentage of scheduled attendance marked Present, Late, or Excused each day</p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '480px', height: 'auto' }}>
          {gridLines.map((v) => (
            <g key={v}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={padding.left - 8} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{v}%</text>
            </g>
          ))}
          <path d={linePath} fill="none" stroke="#059669" strokeWidth={2.5} />
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              <circle cx={xFor(i)} cy={yFor(p.value)} r={3} fill="#059669" stroke="#fff" strokeWidth={1.5} />
              {(i % Math.ceil(points.length / 10 || 1) === 0) && (
                <text x={xFor(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{p.label}</text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
