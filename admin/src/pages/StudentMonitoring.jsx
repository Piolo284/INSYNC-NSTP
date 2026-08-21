import React, { useCallback, useState } from 'react';
import { ArrowLeft, AlertTriangle, Send, User } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';
import AsyncSection from '../components/AsyncSection';
import NotConnectedBanner from '../components/NotConnectedBanner';
import { useApi, errorMessage } from '../hooks/useApi';
import { studentsApi } from '../api/students';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'at-risk', label: 'At Risk' },
  { id: 'dropouts', label: 'Dropouts' },
  { id: 'transfers', label: 'Transfers' },
];

export default function StudentMonitoring() {
  const [activeTab, setActiveTab] = useState('at-risk');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const { effectiveProgram } = useAuth();

  const fetcher = useCallback(async () => {
    if (effectiveProgram === 'CWTS' || effectiveProgram === 'ROTC') {
      const res = await studentsApi.atRisk({ program: effectiveProgram });
      return res.data.map((r) => ({ ...r, program: effectiveProgram }));
    }
    // super_admin viewing "All": at-risk endpoint is per-program, so combine.
    const [cwts, rotc] = await Promise.all([
      studentsApi.atRisk({ program: 'CWTS' }),
      studentsApi.atRisk({ program: 'ROTC' }),
    ]);
    return [
      ...cwts.data.map((r) => ({ ...r, program: 'CWTS' })),
      ...rotc.data.map((r) => ({ ...r, program: 'ROTC' })),
    ];
  }, [effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const atRiskRows = data || [];

  if (selectedStudent) {
    return <NotificationForm student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Student Monitoring" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <div style={{
          background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '18px 24px',
          marginBottom: '20px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center',
          gap: '12px', border: '1px solid var(--border)'
        }}>
          {TABS.map((tab) => (
            <TabButton key={tab.id} label={tab.label} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>

        <div style={{
          background: 'var(--card-bg)', borderRadius: '0 0 var(--radius) var(--radius)',
          padding: '24px', boxShadow: 'var(--shadow)', minHeight: '400px',
          border: '1px solid var(--border)', borderTop: 'none'
        }}>
          {activeTab === 'at-risk' && (
            <>
              <div style={{
                background: 'var(--orange-banner)', border: '1px solid var(--orange-border)',
                borderRadius: 'var(--radius-sm)', padding: '16px 20px', marginBottom: '24px',
                display: 'flex', alignItems: 'center', gap: '14px'
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: 'var(--orange-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <AlertTriangle size={18} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--orange-text)', margin: '0 0 3px' }}>
                    These trainees have 3 or more absences.
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--orange-text)', margin: 0, opacity: 0.85, fontWeight: 500 }}>
                    Send a notification to advise them.
                  </p>
                </div>
              </div>

              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                isEmpty={!loading && !error && atRiskRows.length === 0}
                emptyMessage="No trainees currently at risk."
              >
                {atRiskRows.map((student) => (
                  <div key={student.userId} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '12px',
                    boxShadow: 'var(--shadow)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--border)' }}>
                      <User size={22} color="#9CA3AF" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{student.name}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 500 }}>{student.studentId} · {student.program}</p>
                      <p style={{ fontSize: '13px', color: '#DC2626', margin: '2px 0 0', fontWeight: 700 }}>
                        Absences: {student.absents} / {student.totalSessions}
                      </p>
                    </div>
                    <button onClick={() => setSelectedStudent(student)} style={{
                      padding: '8px 28px', borderRadius: '8px', border: '1.5px solid var(--maroon)',
                      background: 'transparent', color: 'var(--maroon)', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', minWidth: '90px',
                    }}>
                      Notify
                    </button>
                  </div>
                ))}
              </AsyncSection>
            </>
          )}

          {(activeTab === 'dropouts' || activeTab === 'transfers') && (
            <>
              <NotConnectedBanner text={`Tracking of ${activeTab} is not yet connected to a backend data source. The system does not currently store a dropout/transfer record for trainees.`} />
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>No data available.</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NotificationForm({ student, onBack }) {
  const [message, setMessage] = useState(
    `Hi ${student.name},\n\nOur records show that you have ${student.absents} absences in ${student.program} activities. Please be reminded that excessive absences may affect your participation and evaluation.\n\nKindly attend the next activities and coordinate with your officer if you have concerns.\n\nThank you`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      await notificationsApi.create({
        recipientId: student.userId,
        title: 'Attendance Advisory',
        message,
        type: 'attendance',
      });
      setSent(true);
      setTimeout(onBack, 1200);
    } catch (err) {
      setError(errorMessage(err, 'Unable to send notification.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Notify Trainee" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '560px' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to At Risk</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--sidebar-bg)', display: 'grid', placeItems: 'center' }}><User size={26} color="#fff" /></div>
            <div><h2 style={{ margin: 0, fontSize: '16px' }}>{student.name}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.studentId} | {student.program}</p><p style={{ margin: '2px 0 0', color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>Absences: {student.absents}</p></div>
          </div>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
          <label htmlFor="notification-message" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Notification Message (sent as an in-app notification)</label>
          <textarea id="notification-message" value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%', minHeight: '170px', resize: 'vertical', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', color: 'var(--text-primary)', font: '13px/1.6 inherit', outline: 'none' }} />
          <button onClick={handleSend} disabled={sending || sent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'min(420px, 100%)', margin: '28px auto 0', padding: '13px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            <Send size={16} /> {sent ? 'Sent!' : sending ? 'Sending...' : 'Send Notification'}
          </button>
        </section>
      </main>
    </div>
  );
}
