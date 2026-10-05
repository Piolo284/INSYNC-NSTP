import React from 'react';
import { BarChart3 } from 'lucide-react';

const PALETTE = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

/**
 * A plain SVG bar chart of `{ label, value }` pairs — used to give the
 * Reports page's already-real summary tiles (enrollment/attendance/grades
 * breakdowns) an actual chart, not just numbers. Hand-rolled the same way
 * EnrollmentTrendChart.jsx already is, so no new charting dependency is
 * introduced. Unlike that chart, every value shown here comes straight from
 * the caller's own already-fetched data — nothing here is estimated.
 */
export default function SummaryBarChart({ data, title, subtitle }) {
  const bars = (data || []).filter((d) => Number.isFinite(d.value));
  if (!bars.length) return null;

  const width = 560;
  const height = 200;
  const padding = { top: 20, right: 16, bottom: 34, left: 16 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const barW = chartW / bars.length;
  const gap = Math.min(28, barW * 0.3);

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', marginBottom: '20px' }}>
      {(title || subtitle) && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={16} color="#4338CA" />
          </div>
          <div>
            {title && <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h4>}
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{subtitle}</p>}
          </div>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '360px', height: 'auto' }}>
          {bars.map((b, i) => {
            const x = padding.left + i * barW + gap / 2;
            const w = barW - gap;
            const h = max ? (b.value / max) * chartH : 0;
            const y = padding.top + chartH - h;
            const color = PALETTE[i % PALETTE.length];
            return (
              <g key={b.label}>
                <rect x={x} y={y} width={w} height={h} rx={4} fill={color} />
                <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-primary)">{b.value}</text>
                <text x={x + w / 2} y={height - 12} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">{b.label}</text>
              </g>
            );
          })}
          <line x1={padding.left} x2={width - padding.right} y1={padding.top + chartH} y2={padding.top + chartH} stroke="var(--border)" strokeWidth={1} />
        </svg>
      </div>
    </section>
  );
}
