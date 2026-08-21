import React, { useCallback, useState } from 'react';
import { CalendarClock, Search, Plus, Pencil, Trash2, MapPin, Users2, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { activitiesApi } from '../api/activities';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  Upcoming: { bg: '#EFF6FF', color: '#2563EB' },
  Ongoing: { bg: '#ECFDF5', color: '#059669' },
  Completed: { bg: '#F3F4F6', color: '#374151' },
  Cancelled: { bg: '#FEF2F2', color: '#DC2626' },
};

export default function Activities() {
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (status !== 'All Status') params.status = status;
    if (effectiveProgram) params.program = effectiveProgram;
    const res = await activitiesApi.list(params);
    return res.data || [];
  }, [search, status, effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const activities = data || [];

  const handleDelete = async () => {
    setBusy(true);
    try {
      await activitiesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to delete activity.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Activities" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarClock size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Activities</h2>
            </div>
            <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={16} /> New Activity
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', font: '13px inherit', outline: 'none' }} />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ minWidth: '150px', padding: '10px 28px 10px 12px', border: '1px solid var(--border)', borderRadius: '7px', background: '#fff', font: '13px inherit', outline: 'none' }}>
              {['All Status', 'Upcoming', 'Ongoing', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && activities.length === 0} emptyMessage="No activities found.">
            <div style={{ display: 'grid', gap: '12px' }}>
              {activities.map((a) => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.Upcoming;
                const canManage = isSuperAdmin || a.program === effectiveProgram;
                return (
                  <div key={a._id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', boxShadow: 'var(--shadow)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{a.title}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{a.status}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{a.program}</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        {a.startTime ? ` · ${a.startTime}${a.endTime ? `–${a.endTime}` : ''}` : ''}
                      </p>
                      {a.location && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> {a.location}
                        </p>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users2 size={12} /> {a.participants || 0} participant(s)
                      </p>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button aria-label="Edit activity" onClick={() => setModal(a)} style={iconButton}><Pencil size={16} /></button>
                        <button aria-label="Delete activity" onClick={() => setDeleteTarget(a)} style={{ ...iconButton, color: '#DC2626' }}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AsyncSection>
        </section>
      </main>

      {modal && (
        <ActivityFormModal activity={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this activity?"
        message={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const iconButton = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' };

function ActivityFormModal({ activity, onClose, onSaved }) {
  const { isSuperAdmin, effectiveProgram } = useAuth();
  const isEdit = Boolean(activity);
  const dateVal = activity?.date ? new Date(activity.date).toISOString().slice(0, 10) : '';

  const [form, setForm] = useState({
    title: activity?.title || '',
    description: activity?.description || '',
    program: activity?.program || (effectiveProgram || 'CWTS'),
    date: dateVal,
    startTime: activity?.startTime || '',
    endTime: activity?.endTime || '',
    location: activity?.location || '',
    brigade: activity?.brigade || '',
    status: activity?.status || 'Upcoming',
    objectives: (activity?.objectives || []).join('\n'),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      setError('Title and date are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        brigade: form.brigade,
        status: form.status,
        objectives: form.objectives,
        ...(isSuperAdmin ? { program: form.program } : {}),
      };
      if (isEdit) await activitiesApi.update(activity._id, payload);
      else await activitiesApi.create(payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save activity.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{isEdit ? 'Edit Activity' : 'New Activity'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Title" span={2}><input value={form.title} onChange={e => update('title', e.target.value)} /></Field>
          <Field label="Description" span={2}><textarea value={form.description} onChange={e => update('description', e.target.value)} /></Field>
          {isSuperAdmin && (
            <Field label="Program"><select value={form.program} onChange={e => update('program', e.target.value)}><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
          )}
          <Field label="Status"><select value={form.status} onChange={e => update('status', e.target.value)}>{['Upcoming', 'Ongoing', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Date"><input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
          <Field label="Location"><input value={form.location} onChange={e => update('location', e.target.value)} /></Field>
          <Field label="Start Time"><input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} /></Field>
          <Field label="End Time"><input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} /></Field>
          <Field label="Brigade"><input value={form.brigade} onChange={e => update('brigade', e.target.value)} /></Field>
          <Field label="Objectives (one per line)" span={2}><textarea value={form.objectives} onChange={e => update('objectives', e.target.value)} placeholder={'e.g.\nBuild teamwork\nServe the community'} /></Field>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, span = 1, children }) {
  return (
    <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', gridColumn: `span ${span}` }}>
      {label}
      {React.cloneElement(children, {
        style: {
          width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px',
          fontFamily: 'inherit', fontSize: '13px', outline: 'none', color: 'var(--text-primary)',
          ...(children.type === 'textarea' ? { minHeight: '80px', resize: 'vertical' } : {}),
        },
      })}
    </label>
  );
}
