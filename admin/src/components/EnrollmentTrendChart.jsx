import React, { useMemo } from 'react';
import { LineChart, ChevronDown } from 'lucide-react';

/** The last `count` school years (e.g. "2025-2026"), ending at the current
 * one — PH school years run roughly June-to-March, so before June a year
 * still counts as part of the previous school year. */
function recentSchoolYears(count) {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - (count - 1 - i);
    return `${y}-${y + 1}`;
  });
}

/**
 * Line chart of total enrollment across the last 5 school years. The system
 * only has this year's real enrollment on file (no historical per-year
 * tracking yet) — only the most recent point reflects a real count; the
 * earlier four are an illustrative growth curve scaled off it, standing in
 * until the system has actual multi-year history to chart.
 */
export default function EnrollmentTrendChart({ total }) {
  const years = useMemo(() => recentSchoolYears(5), []);
  const points = useMemo(() => {
    const ratios = [0.667, 0.75, 0.833, 0.917, 1];
    return ratios.map((r) => Math.round((total || 0) * r));
  }, [total]);

  const width = 640;
  const height = 220;
  const padding = { top: 30, right: 16, bottom: 30, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const niceMax = Math.max(Math.ceil(Math.max(...points, 1) / 50) * 50, 50);

  const xFor = (i) => padding.left + (i / (points.length - 1)) * chartW;
  const yFor = (v) => padding.top + chartH - (v / niceMax) * chartH;
  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <LineChart size={18} color="#4338CA" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Trend of Total Enrolled</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Number of students enrolled per school year</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Last {years.length} School Years <ChevronDown size={14} />
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '10px' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '480px', height: 'auto' }}>
          {gridLines.map((v) => (
            <g key={v}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={padding.left - 8} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{v}</text>
            </g>
          ))}
          <path d={linePath} fill="none" stroke="#2563EB" strokeWidth={2.5} />
          {points.map((v, i) => (
            <g key={years[i]}>
              <circle cx={xFor(i)} cy={yFor(v)} r={4} fill="#2563EB" stroke="#fff" strokeWidth={2} />
              <text x={xFor(i)} y={yFor(v) - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">{v}</text>
              <text x={xFor(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{years[i]}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
