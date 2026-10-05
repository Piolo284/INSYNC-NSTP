import React, { useCallback, useState } from 'react';
import { BookOpen, Search, Plus, Pencil, Trash2, FileDown, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { modulesApi } from '../api/modules';
import { resolveFileUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  Open: { bg: '#ECFDF5', color: '#059669' },
  'In Progress': { bg: '#EFF6FF', color: '#2563EB' },
  Completed: { bg: '#F3F4F6', color: '#374151' },
  Archived: { bg: '#FEF2F2', color: '#DC2626' },
};

export default function Modules() {
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
    const res = await modulesApi.list(params);
    return res.data || [];
  }, [search, status, effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const modules = data || [];

  const handleDelete = async () => {
    setBusy(true);
    try {
      await modulesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to delete module.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Modules" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Modules</h2>
            </div>
            <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={16} /> New Module
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search modules..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', font: '13px inherit', outline: 'none' }} />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ minWidth: '150px', padding: '10px 28px 10px 12px', border: '1px solid var(--border)', borderRadius: '7px', background: '#fff', font: '13px inherit', outline: 'none' }}>
              {['All Status', 'Open', 'In Progress', 'Completed', 'Archived'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && modules.length === 0} emptyMessage="No modules found.">
            <div style={{ display: 'grid', gap: '12px' }}>
              {modules.map((m) => {
                const sc = STATUS_COLORS[m.status] || STATUS_COLORS.Open;
                const canManage = isSuperAdmin || m.program === effectiveProgram;
                return (
                  <div key={m._id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', boxShadow: 'var(--shadow)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{m.title}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{m.status}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{m.program}</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Deadline: {m.deadline ? new Date(m.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'None'} · {m.totalPoints} pts
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {m.submittedCount || 0}/{m.totalTrainees || 0} submitted ({m.percentage || 0}%) · {m.gradedCount || 0} graded
                      </p>
                      {m.fileUrl && (
                        <a href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer" style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--maroon)', fontWeight: 600, textDecoration: 'none' }}>
                          <FileDown size={13} /> {m.fileName || 'Attached file'}
                        </a>
                      )}
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button aria-label="Edit module" onClick={() => setModal(m)} style={iconButton}><Pencil size={16} /></button>
                        <button aria-label="Delete module" onClick={() => setDeleteTarget(m)} style={{ ...iconButton, color: '#DC2626' }}><Trash2 size={16} /></button>
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
        <ModuleFormModal module={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch(); }} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this module?"
        message={`"${deleteTarget?.title}" and all of its submissions will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const iconButton = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' };

function ModuleFormModal({ module, onClose, onSaved }) {
  const { isSuperAdmin, effectiveProgram } = useAuth();
  const isEdit = Boolean(module);
  const deadlineVal = module?.deadline ? new Date(module.deadline).toISOString().slice(0, 10) : '';

  const [form, setForm] = useState({
    title: module?.title || '',
    description: module?.description || '',
    program: module?.program || (effectiveProgram || 'CWTS'),
    moduleCode: module?.moduleCode || '',
    section: module?.section || '',
    deadline: deadlineVal,
    totalPoints: module?.totalPoints || 100,
    status: module?.status || 'Open',
    instructions: (module?.instructions || []).join('\n'),
    file: null,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        moduleCode: form.moduleCode,
        section: form.section,
        deadline: form.deadline || '',
        totalPoints: form.totalPoints,
        status: form.status,
        instructions: form.instructions,
        ...(isSuperAdmin ? { program: form.program } : {}),
        ...(form.file ? { file: form.file } : {}),
      };
      if (isEdit) await modulesApi.update(module._id, payload);
      else await modulesApi.create(payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save module.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{isEdit ? 'Edit Module' : 'New Module'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Title" span={2}><input value={form.title} onChange={e => update('title', e.target.value)} /></Field>
          <Field label="Description" span={2}><textarea value={form.description} onChange={e => update('description', e.target.value)} /></Field>
          {isSuperAdmin && (
            <Field label="Program"><select value={form.program} onChange={e => update('program', e.target.value)}><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
          )}
          <Field label="Status"><select value={form.status} onChange={e => update('status', e.target.value)}>{['Open', 'In Progress', 'Completed', 'Archived'].map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Module Code"><input value={form.moduleCode} onChange={e => update('moduleCode', e.target.value)} placeholder="e.g. CWTS - A" /></Field>
          <Field label="Section"><input value={form.section} onChange={e => update('section', e.target.value)} /></Field>
          <Field label="Deadline"><input type="date" value={form.deadline} onChange={e => update('deadline', e.target.value)} /></Field>
          <Field label="Total Points"><input type="number" min="0" value={form.totalPoints} onChange={e => update('totalPoints', e.target.value)} /></Field>
          <Field label="Instructions (one per line)" span={2}><textarea value={form.instructions} onChange={e => update('instructions', e.target.value)} /></Field>
          <Field label="Attach File" span={2}><input type="file" onChange={e => update('file', e.target.files[0] || null)} /></Field>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Module'}
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
          ...(children.type === 'textarea' ? { minHeight: '70px', resize: 'vertical' } : {}),
        },
      })}
    </label>
  );
}
