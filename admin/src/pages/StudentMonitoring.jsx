import React, { useCallback, useState } from 'react';
import { ArrowLeft, AlertTriangle, Send, User, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';

function defaultAdvisoryMessage(student) {
  return `Hi ${student.name},\n\nOur records show that you have ${student.absents} absences in ${student.program} activities. Please be reminded that excessive absences may affect your participation and evaluation.\n\nKindly attend the next activities and coordinate with your officer if you have concerns.\n\nThank you`;
}

function normalizeDropout(record, program) {
  const isCadet = program === 'ROTC';
  return {
    key: record._id,
    name: record.fullName,
    idNumber: isCadet ? record.cadetId : record.studentId,
    program,
    course: record.course || '—',
    yearLevel: record.yearLevel || '—',
    section: isCadet ? (record.company || '—') : (record.section || '—'),
    updatedAt: record.updatedAt,
  };
}

const TABS = [
  { id: 'at-risk', label: 'Warning' },
  { id: 'dropouts', label: 'Dropouts' },
];

export default function StudentMonitoring() {
  const [activeTab, setActiveTab] = useState('at-risk');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [confirmBulkNotify, setConfirmBulkNotify] = useState(false);
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
  const checkedStudents = atRiskRows.filter((s) => checkedIds.has(s.userId));
  const allChecked = atRiskRows.length > 0 && checkedIds.size === atRiskRows.length;

  const toggleChecked = (userId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set(atRiskRows.map((s) => s.userId)));
  };

  const dropoutFetcher = useCallback(async () => {
    const wantsStudents = effectiveProgram !== 'ROTC';
    const wantsCadets = effectiveProgram !== 'CWTS';

    const [studentRes, cadetRes] = await Promise.all([
      wantsStudents ? studentsApi.list({ status: 'Dropped' }) : Promise.resolve({ data: [] }),
      wantsCadets ? cadetsApi.list({ status: 'Dropped' }) : Promise.resolve({ data: [] }),
    ]);

    return [
      ...(studentRes.data || []).map((r) => normalizeDropout(r, 'CWTS')),
      ...(cadetRes.data || []).map((r) => normalizeDropout(r, 'ROTC')),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveProgram]);

  const {
    data: dropoutData,
    loading: dropoutLoading,
    error: dropoutError,
    refetch: refetchDropouts,
  } = useApi(dropoutFetcher, [dropoutFetcher]);
  const dropoutRows = dropoutData || [];

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
                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap'
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: 'var(--orange-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <AlertTriangle size={18} color="#fff" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--orange-text)', margin: '0 0 3px' }}>
                    These trainees have 3 or more absences.
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--orange-text)', margin: 0, opacity: 0.85, fontWeight: 500 }}>
                    Send a notification to advise them.
                  </p>
                </div>
                {atRiskRows.length > 0 && (
                  <button
                    onClick={() => setConfirmBulkNotify(true)}
                    disabled={checkedIds.size === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '8px',
                      border: 'none', background: 'var(--orange-text)', color: '#fff', fontSize: '13px', fontWeight: 700,
                      cursor: checkedIds.size === 0 ? 'default' : 'pointer', fontFamily: 'inherit', opacity: checkedIds.size === 0 ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <Send size={14} /> Notify Selected ({checkedIds.size})
                  </button>
                )}
              </div>

              {atRiskRows.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  Select All
                </label>
              )}

              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                isEmpty={!loading && !error && atRiskRows.length === 0}
                emptyMessage="No trainees currently flagged for warning."
              >
                {atRiskRows.map((student) => (
                  <div key={student.userId} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '12px',
                    boxShadow: 'var(--shadow)', border: '1px solid var(--border)',
                  }}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(student.userId)}
                      onChange={() => toggleChecked(student.userId)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                    />
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

          {activeTab === 'dropouts' && (
            <AsyncSection
              loading={dropoutLoading}
              error={dropoutError}
              onRetry={refetchDropouts}
              isEmpty={!dropoutLoading && !dropoutError && dropoutRows.length === 0}
              emptyMessage="No trainees are currently marked as dropped."
            >
              {dropoutRows.map((trainee) => (
                <div key={trainee.key} style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                  background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '12px',
                  boxShadow: 'var(--shadow)', border: '1px solid var(--border)',
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--border)' }}>
                    <User size={22} color="#9CA3AF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{trainee.name}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 2px', fontWeight: 500 }}>
                      {trainee.idNumber} · {trainee.program} · {trainee.course} / {trainee.yearLevel} · {trainee.section}
                    </p>
                    {trainee.updatedAt && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Status updated {new Date(trainee.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '5px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                    background: '#FEF2F2', color: '#DC2626',
                  }}>Dropped</span>
                </div>
              ))}
            </AsyncSection>
          )}
        </div>
      </main>

      {confirmBulkNotify && (
        <BulkNotifyModal
          students={checkedStudents}
          onClose={() => setConfirmBulkNotify(false)}
          onDone={() => { setConfirmBulkNotify(false); setCheckedIds(new Set()); }}
        />
      )}
    </div>
  );
}

function BulkNotifyModal({ students, onClose, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');
    setSubmitting(true);
    setProgress(0);
    let failed = 0;
    for (const student of students) {
      try {
        await notificationsApi.create({
          recipientId: student.userId,
          title: 'Attendance Advisory',
          message: defaultAdvisoryMessage(student),
          type: 'attendance',
        });
      } catch {
        failed += 1;
      } finally {
        setProgress((p) => p + 1);
      }
    }
    if (failed > 0) {
      setError(`${failed} of ${students.length} notification(s) could not be sent. The rest were sent.`);
      setSubmitting(false);
      return;
    }
    onDone();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={submitting ? undefined : onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(440px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Notify {students.length} selected trainee{students.length === 1 ? '' : 's'}?</h3>
          {!submitting && (
            <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
          )}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Each selected trainee will get an attendance advisory notification personalized with their own name and absence count.
        </p>
        {submitting && (
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Sending {progress} of {students.length}...</p>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginTop: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button type="button" disabled={submitting} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>Cancel</button>
          <button type="button" disabled={submitting} onClick={handleConfirm} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--orange-text)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
            <Send size={15} /> {submitting ? 'Sending...' : `Notify ${students.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationForm({ student, onBack }) {
  const [message, setMessage] = useState(defaultAdvisoryMessage(student));
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
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to Warning</button>
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
