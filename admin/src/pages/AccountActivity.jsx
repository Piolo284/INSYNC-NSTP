import React, { useCallback, useState } from 'react';
import { History, Mail, Phone, ShieldCheck, ShieldOff, LogOut, MonitorX, ChevronDown } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi } from '../hooks/useApi';
import { accountActivityApi } from '../api/accountActivity';

const ACTION_CONFIG = {
  email_changed: { label: 'Email changed', icon: Mail, bg: '#DBEAFE', color: '#1D4ED8' },
  contact_number_changed: { label: 'Contact number changed', icon: Phone, bg: '#F3E8FF', color: '#7C3AED' },
  two_factor_enabled: { label: 'Two-factor enabled', icon: ShieldCheck, bg: '#ECFDF5', color: '#059669' },
  two_factor_disabled: { label: 'Two-factor disabled', icon: ShieldOff, bg: '#FEF3C7', color: '#B45309' },
  session_revoked: { label: 'Device logged out', icon: MonitorX, bg: '#FEE2E2', color: '#DC2626' },
  logout_all_devices: { label: 'Logged out all devices', icon: LogOut, bg: '#FEE2E2', color: '#DC2626' },
};

const ACTION_OPTIONS = ['All Actions', ...Object.keys(ACTION_CONFIG)];

function CustomSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', minWidth: '200px' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px',
          border: '1px solid var(--border)', background: '#fff', fontSize: '13px',
          fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit',
          cursor: 'pointer', appearance: 'none', outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt === 'All Actions' ? opt : ACTION_CONFIG[opt].label}</option>
        ))}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
    </div>
  );
}

/**
 * Read-only audit trail for the mobile app's self-service account-security
 * actions (change email, change contact number, two-factor toggle, device
 * logouts) — these are never admin-approved, so this page is visibility
 * only, not a review queue.
 */
export default function AccountActivity() {
  const [actionFilter, setActionFilter] = useState('All Actions');

  const fetcher = useCallback(async () => {
    const params = {};
    if (actionFilter !== 'All Actions') params.action = actionFilter;
    const res = await accountActivityApi.list(params);
    return res.data || [];
  }, [actionFilter]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const logs = data || [];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Account Activity" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Account Activity</h2>
            </div>
            <CustomSelect value={actionFilter} onChange={setActionFilter} options={ACTION_OPTIONS} />
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Self-service account-security actions across every account — email/contact number changes, two-factor toggles, and device logouts.
            These happen directly (confirmed by an emailed code), not through admin approval — this is a visibility log only.
          </p>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && logs.length === 0} emptyMessage="No account activity yet.">
            <div style={{ display: 'grid', gap: '10px' }}>
              {logs.map((log) => {
                const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.email_changed;
                const Icon = cfg.icon;
                const user = log.userId || {};
                return (
                  <div key={log._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={cfg.color} strokeWidth={2.2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13.5px' }}>{cfg.label}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {user.name || 'Unknown user'} {user.studentId ? `(${user.studentId})` : ''} — {user.role}
                        </span>
                      </div>
                      {log.detail && <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{log.detail}</p>}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}
