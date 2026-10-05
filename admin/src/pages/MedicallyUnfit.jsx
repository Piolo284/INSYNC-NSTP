import React, { useCallback, useState } from 'react';
import { HeartHandshake, User, Search } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi } from '../hooks/useApi';
import { officersApi } from '../api/officers';
import { cadetsApi } from '../api/cadets';
import { useAuth } from '../context/AuthContext';

/**
 * The Inclusive Learning Section (formerly "Special Class") track exists
 * for ROTC only: cadets who registered as PWD or with a Medical Condition
 * (SPECIAL_CLASS_CATEGORIES on the backend) are exempt from field
 * training/drills and placed on their own alternative track, handled by one
 * dedicated officer. CWTS has no physically-demanding requirement this
 * track was designed to exempt someone from, so it has no equivalent here —
 * see utils/specialClass.js on the backend, which enforces this same
 * ROTC-only rule regardless of what this page does.
 */
export default function MedicallyUnfit() {
  const { effectiveProgram } = useAuth();
  const [search, setSearch] = useState('');

  // A CWTS-scoped admin has no reason to land here (the sidebar link is
  // hidden for them too — see Sidebar.jsx), but guard anyway rather than
  // letting them hit a confusing 404 from the ROTC-only endpoints below.
  const notApplicable = effectiveProgram === 'CWTS';

  const fetcher = useCallback(async () => {
    if (notApplicable) return { officer: null, roster: [] };
    const [officerRes, rosterRes] = await Promise.all([
      officersApi.specialClassOfficer({ program: 'ROTC' }),
      cadetsApi.specialClassRoster(),
    ]);
    return { officer: officerRes?.data || null, roster: rosterRes?.data || [] };
  }, [notApplicable]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const officer = data?.officer || null;
  const roster = data?.roster || [];
  const filteredRoster = roster.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.fullName || '').toLowerCase().includes(q) || (r.cadetId || '').toLowerCase().includes(q);
  });

  if (notApplicable) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
        <TopBar title="Inclusive Learning Section" showBreadcrumb={true} />
        <main style={{ padding: '24px' }}>
          <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            The Inclusive Learning Section only exists for ROTC — CWTS has no equivalent track.
          </section>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Inclusive Learning Section" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
            <HeartHandshake size={22} color="var(--text-primary)" strokeWidth={2.2} style={{ marginTop: '2px' }} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>ROTC Inclusive Learning Section</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '62ch' }}>
                Cadets who registered as PWD or with a Medical Condition — exempt from field training/drills and placed on their own alternative track, with their own app interface and one dedicated officer.
              </p>
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Assigned Officer</h3>
          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && !officer} emptyMessage="No officer assigned yet. Assign one from Officer Management (ROTC officers only).">
            {officer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--sidebar-bg)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <User size={22} color="#fff" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{officer.fullName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {officer.officerId} · {officer.email}{officer.contactNumber ? ` · ${officer.contactNumber}` : ''}
                  </p>
                </div>
              </div>
            )}
          </AsyncSection>
        </section>

        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '20px 24px', minHeight: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Roster ({roster.length})
            </h3>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or ID..."
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
          </div>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && filteredRoster.length === 0}
            emptyMessage={roster.length === 0 ? 'No ROTC cadet is in the Inclusive Learning Section yet.' : 'No matching entries.'}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {['Cadet ID', 'Full Name', 'Company', 'Category', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{r.cadetId}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>{r.fullName}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.company || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: '#F4E2E2', color: 'var(--maroon)' }}>{r.specialCategory}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#059669', fontWeight: 700 }}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}
