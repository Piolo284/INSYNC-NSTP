import React from 'react';
import { UserPlus, FileCheck, Bell, Megaphone, BarChart3, CalendarDays } from 'lucide-react';

const configMap = {
  enroll: { Icon: UserPlus, bg: '#ECFDF5', color: '#059669' },
  certificate: { Icon: FileCheck, bg: '#FEF3C7', color: '#D97706' },
  alert: { Icon: Bell, bg: '#FEE2E2', color: '#DC2626' },
  announcement: { Icon: Megaphone, bg: '#EFF6FF', color: '#2563EB' },
  activity: { Icon: CalendarDays, bg: '#F3E8FF', color: '#7C3AED' },
  report: { Icon: BarChart3, bg: '#F3E8FF', color: '#7C3AED' },
};

export default function ActivityItem({ activity }) {
  const cfg = configMap[activity.type] || configMap.report;
  const Icon = cfg.Icon;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffHrs < 48) return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%', background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px'
      }}>
        <Icon size={20} color={cfg.color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 5px', color: 'var(--text-primary)' }}>{activity.title}</h4>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{activity.description}</p>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', marginTop: '2px' }}>
        {formatTime(activity.timestamp)}
      </span>
    </div>
  );
}
