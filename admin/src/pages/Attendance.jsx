import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardCheck, Plus, Search, X, QrCode, Ban, Trash2, Users } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { attendanceApi } from '../api/attendance';
import { activitiesApi } from '../api/activities';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'sessions', label: 'QR Sessions' },
  { id: 'manual', label: 'Manual Attendance' },
  { id: 'history', label: 'History' },
];

const STATUS_COLORS = {
  Present: { bg: '#ECFDF5', color: '#059669' },
  Late: { bg: '#FFF7ED', color: '#D97706' },
  Absent: { bg: '#FEF2F2', color: '#DC2626' },
  Excused: { bg: '#EFF6FF', color: '#2563EB' },
};

export default function AttendancePage() {
  const [tab, setTab] = useState('sessions');
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Attendance" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '10px 20px', marginBottom: '20px', boxShadow: 'var(--shadow)', display: 'flex', gap: '8px', border: '1px solid var(--border)' }}>
          {TABS.map((t) => <TabButton key={t.id} label={t.label} isActive={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'manual' && <ManualTab />}
        {tab === 'history' && <HistoryTab />}
      </main>
    </div>
  );
}

// ============================================================
// QR SESSIONS
// ============================================================

function SessionsTab() {
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [monitorSession, setMonitorSession] = useState(null);

  const fetcher = useCallback(async () => {
    const params = {};
    if (effectiveProgram) params.program = effectiveProgram;
    const res = await attendanceApi.listSessions(params);
    return res.data || [];
  }, [effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const sessions = data || [];

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '480px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QrCode size={20} color="var(--text-primary)" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Attendance Sessions</h2>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={16} /> Create QR Session
        </button>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && sessions.length === 0} emptyMessage="No attendance sessions yet.">
        <div style={{ display: 'grid', gap: '12px' }}>
          {sessions.map((s) => (
            <div key={s._id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '14px' }}>{s.title || `${s.program} Attendance`}</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: s.status === 'Active' ? '#ECFDF5' : '#F3F4F6', color: s.status === 'Active' ? '#059669' : '#6B7280' }}>{s.status}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{s.program}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(s.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {s.startTime}–{s.endTime}
                  {s.activityId?.title ? ` · ${s.activityId.title}` : ''}
                </p>
              </div>
              <button onClick={() => setMonitorSession(s)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1.5px solid var(--maroon)', background: 'transparent', color: 'var(--maroon)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {s.status === 'Active' ? 'View QR / Monitor' : 'View Records'}
              </button>
            </div>
          ))}
        </div>
      </AsyncSection>

      {showCreate && (
        <CreateSessionModal
          isSuperAdmin={isSuperAdmin}
          effectiveProgram={effectiveProgram}
          onClose={() => setShowCreate(false)}
          onCreated={(session) => { setShowCreate(false); refetch(); setMonitorSession(session); }}
        />
      )}

      {monitorSession && (
        <MonitorModal session={monitorSession} onClose={() => { setMonitorSession(null); refetch(); }} />
      )}
    </section>
  );
}

function CreateSessionModal({ isSuperAdmin, effectiveProgram, onClose, onCreated }) {
  const [program, setProgram] = useState(effectiveProgram || 'CWTS');
  const [activityId, setActivityId] = useState('');
  const [activities, setActivities] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    activitiesApi.list({ program }).then((res) => setActivities(res.data || [])).catch(() => setActivities([]));
  }, [program]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      setError('Date, start time, and end time are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await attendanceApi.createSession({
        activityId: activityId || undefined,
        date,
        startTime,
        endTime,
        title,
        ...(isSuperAdmin ? { program } : {}),
      });
      onCreated(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Unable to create session.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Create QR Attendance Session</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={errBox}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          {isSuperAdmin && (
            <Field label="Program"><select value={program} onChange={e => { setProgram(e.target.value); setActivityId(''); }}><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
          )}
          <Field label="Linked Activity (optional)">
            <select value={activityId} onChange={e => setActivityId(e.target.value)}>
              <option value="">No linked activity</option>
              {activities.map(a => <option key={a._id} value={a._id}>{a.title}</option>)}
            </select>
          </Field>
          <Field label="Session Title (optional)"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${program} Attendance`} /></Field>
          <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Start Time"><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></Field>
            <Field label="End Time"><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...saveBtn, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Creating...' : 'Create & Generate QR'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MonitorModal({ session, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [currentSession, setCurrentSession] = useState(session);

  const load = useCallback(async () => {
    try {
      const res = await attendanceApi.list({ sessionId: currentSession._id, limit: 200 });
      setRecords(res.data || []);
    } catch {
      // ignore transient poll errors
    } finally {
      setLoading(false);
    }
  }, [currentSession._id]);

  useEffect(() => {
    load();
    if (currentSession.status !== 'Active') return undefined;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load, currentSession.status]);

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await attendanceApi.closeSession(currentSession._id);
      setCurrentSession(res.data);
      setConfirmClose(false);
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to close session.'));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, width: 'min(640px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{currentSession.title || `${currentSession.program} Attendance`}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {currentSession.status === 'Active' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <QRCodeSVG value={currentSession.sessionCode} size={168} includeMargin />
              <code style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', textAlign: 'center', maxWidth: '168px' }}>{currentSession.sessionCode}</code>
            </div>
          )}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {new Date(currentSession.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {currentSession.startTime}–{currentSession.endTime}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700 }}>Status: {currentSession.status}</p>
            <p style={{ margin: '0 0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {records.length} recorded</p>
            {currentSession.status === 'Active' && (
              <button onClick={() => setConfirmClose(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: '1px solid #DC2626', background: '#fff', color: '#DC2626', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Ban size={14} /> Close Session
              </button>
            )}
          </div>
        </div>

        <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px' }}>Live Attendance</h4>
        <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
          {loading && records.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)' }}>Loading...</p>
          ) : records.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)' }}>No scans yet.</p>
          ) : (
            records.map((r) => {
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.Present;
              return (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{r.studentId?.name || 'Unknown'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>{r.studentId?.studentId} · {r.time}</p>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{r.status}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose}
        title="Close this attendance session?"
        message="Trainees will no longer be able to scan this QR code to record attendance."
        confirmLabel="Close Session"
        busy={closing}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  );
}

// ============================================================
// MANUAL ATTENDANCE
// ============================================================

function ManualTab() {
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [program, setProgram] = useState(effectiveProgram && effectiveProgram !== 'All' ? effectiveProgram : 'CWTS');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Present');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const api = program === 'ROTC' ? cadetsApi : studentsApi;
        const res = await api.list({ search });
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, program]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) { setError('Select a trainee first.'); return; }
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await attendanceApi.create({
        studentId: selected.userId?._id || selected.userId,
        status,
        date,
        remarks,
        ...(isSuperAdmin ? { program } : {}),
      });
      setSuccess(`Attendance recorded for ${selected.fullName}.`);
      setSelected(null);
      setSearch('');
      setResults([]);
    } catch (err) {
      setError(errorMessage(err, 'Unable to record attendance.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '480px', maxWidth: '600px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 20px' }}>Manual Attendance Entry</h2>

      {error && <div style={errBox}>{error}</div>}
      {success && <div style={{ ...errBox, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857' }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
        {isSuperAdmin && (
          <Field label="Program"><select value={program} onChange={e => { setProgram(e.target.value); setSelected(null); setResults([]); }}><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
        )}
        <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
          Search Trainee
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} placeholder="Search by name or ID..." style={{ width: '100%', padding: '10px 12px 10px 32px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
          </div>
        </label>

        {!selected && search && (
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {searching ? (
              <p style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Searching...</p>
            ) : results.length === 0 ? (
              <p style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>No matches.</p>
            ) : (
              results.map((r) => (
                <button type="button" key={r._id} onClick={() => setSelected(r)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontFamily: 'inherit' }}>
                  <strong style={{ fontSize: '12.5px' }}>{r.fullName}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>{r.studentId || r.cadetId}</span>
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: '8px', fontSize: '12.5px' }}>
            Selected: <strong>{selected.fullName}</strong> ({selected.studentId || selected.cadetId})
          </div>
        )}

        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Status"><select value={status} onChange={e => setStatus(e.target.value)}>{['Present', 'Late', 'Absent', 'Excused'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Remarks (optional)"><input value={remarks} onChange={e => setRemarks(e.target.value)} /></Field>

        <button type="submit" disabled={submitting} style={{ ...saveBtn, justifySelf: 'start', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Saving...' : 'Record Attendance'}
        </button>
      </form>
    </section>
  );
}

// ============================================================
// HISTORY
// ============================================================

function HistoryTab() {
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('All Status');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(async () => {
    const params = {};
    if (date) params.date = date;
    if (status !== 'All Status') params.status = status;
    if (search) params.search = search;
    if (effectiveProgram) params.program = effectiveProgram;
    const res = await attendanceApi.list(params);
    return res.data || [];
  }, [date, status, search, effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const records = data || [];

  const handleDelete = async () => {
    setBusy(true);
    try {
      await attendanceApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to delete record.'));
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (record, newStatus) => {
    try {
      await attendanceApi.update(record._id, { status: newStatus });
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to update status.'));
    }
  };

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <ClipboardCheck size={20} color="var(--text-primary)" />
        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Attendance History</h2>
        {isSuperAdmin && !effectiveProgram && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>(showing all programs)</span>}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trainee..." style={{ flex: 1, minWidth: '180px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }}>
          {['All Status', 'Present', 'Late', 'Absent', 'Excused'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && records.length === 0} emptyMessage="No attendance records found.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Trainee', 'Date', 'Time', 'Program', 'Method', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.Present;
                return (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600 }}>{r.studentId?.name || 'Unknown'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>{r.studentId?.studentId}</div>
                    </td>
                    <td style={cell}>{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={cell}>{r.time || '—'}</td>
                    <td style={cell}>{r.program}</td>
                    <td style={cell}>{r.attendanceMethod}</td>
                    <td style={cell}>
                      <select value={r.status} onChange={(e) => handleStatusChange(r, e.target.value)} style={{ fontSize: '10.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '10px', background: sc.bg, color: sc.color, border: 'none', outline: 'none', cursor: 'pointer' }}>
                        {['Present', 'Late', 'Absent', 'Excused'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={cell}>
                      <button aria-label="Delete record" onClick={() => setDeleteTarget(r)} style={{ border: 0, background: 'none', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncSection>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this attendance record?"
        message="This cannot be undone."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

const cell = { padding: '10px 8px', fontSize: '12px', color: 'var(--text-primary)' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' };
const modalStyle = { background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' };
const errBox = { background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' };
const cancelBtn = { padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const saveBtn = { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
      {label}
      {React.cloneElement(children, { style: { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'inherit', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' } })}
    </label>
  );
}
