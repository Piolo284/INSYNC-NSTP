import React from 'react';
import { BarChart3, Users, GraduationCap, HeartHandshake, UserCog, Megaphone, ClipboardCheck, Award } from 'lucide-react';

const ROW_CONFIG = {
  total: { icon: Users, bg: '#DCFCE7', color: '#16A34A', badge: 'Active', badgeBg: '#DCFCE7', badgeColor: '#16A34A' },
  cadets: { icon: GraduationCap, bg: '#DBEAFE', color: '#2563EB', badge: 'Active', badgeBg: '#DCFCE7', badgeColor: '#16A34A' },
  students: { icon: HeartHandshake, bg: '#F3E8FF', color: '#9333EA', badge: 'Active', badgeBg: '#DCFCE7', badgeColor: '#16A34A' },
  officers: { icon: UserCog, bg: '#FEF3C7', color: '#B45309', badge: 'Active', badgeBg: '#DCFCE7', badgeColor: '#16A34A' },
  announcements: { icon: Megaphone, bg: '#FEE2E2', color: '#DC2626', badge: 'Recent', badgeBg: '#FEE2E2', badgeColor: '#DC2626' },
  attendance: { icon: ClipboardCheck, bg: '#CCFBF1', color: '#0D9488', badge: 'Ongoing', badgeBg: '#DCFCE7', badgeColor: '#16A34A' },
  certificates: { icon: Award, bg: '#FCE7F3', color: '#DB2777', badge: 'Pending', badgeBg: '#FEF3C7', badgeColor: '#B45309' },
};

/**
 * The super_admin (NSTP-HEAD) dashboard's left-column overview — every
 * headline count in one glanceable list instead of a row of cards.
 * `rows` is [{ type, label, value }], `type` picks the icon/color/badge.
 */
export default function DataStatusPanel({ rows }) {
  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BarChart3 size={18} color="#4338CA" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Data Status</h3>
          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>Current System Data</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {rows.map((row) => {
          const cfg = ROW_CONFIG[row.type] || ROW_CONFIG.total;
          const Icon = cfg.icon;
          return (
            <div key={row.type} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '12px', background: 'var(--bg)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={cfg.color} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{row.value}</p>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor, whiteSpace: 'nowrap' }}>
                {cfg.badge}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
