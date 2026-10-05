import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Pencil, Trash2, UserCog, Power, X, Shield } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { officersApi } from '../api/officers';
import { brigadesApi } from '../api/programs';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { useAuth } from '../context/AuthContext';

// Officer title choices, scoped by program — CWTS's brigade-level lead is
// titled differently from ROTC's platoon-level lead, but both share the same
// Attendance Officer title. Mirrors backend/config/constants.js OFFICER_POSITIONS.
const OFFICER_POSITIONS = {
  CWTS: ['Brigade Commander', 'Attendance Officer'],
  ROTC: ['Platoon Leader', 'Attendance Officer'],
};

export default function OfficerManagement() {
  const { effectiveProgram, isSuperAdmin, isAdminRotc } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [modal, setModal] = useState(null); // 'create' | officer
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [specialClassBusyId, setSpecialClassBusyId] = useState(null);

  const fetcher = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter !== 'All Status') params.status = statusFilter;
    if (effectiveProgram) params.program = effectiveProgram;
    const res = await officersApi.list(params);
    return res;
  }, [search, statusFilter, effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const officers = data?.data || [];
  const stats = data?.stats || { total: 0, active: 0, inactive: 0 };

  const handleDeactivateToggle = async () => {
    setBusyAction(true);
    try {
      const nextStatus = deactivateTarget.status === 'Active' ? 'Inactive' : 'Active';
      await officersApi.update(deactivateTarget._id, { status: nextStatus });
      setDeactivateTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to update officer status.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleSpecialClass = async (officer) => {
    const next = !officer.isSpecialClassOfficer;
    if (next && !window.confirm(
      `Set ${officer.fullName} as the ROTC Inclusive Learning Section officer? This will replace whoever currently holds it.`
    )) return;
    setSpecialClassBusyId(officer._id);
    try {
      await officersApi.assignSpecialClass(officer._id, next);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to update the Inclusive Learning Section assignment.'));
    } finally {
      setSpecialClassBusyId(null);
    }
  };

  const handleDelete = async () => {
    setBusyAction(true);
    try {
      await officersApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to delete officer.'));
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Officer Management" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCog size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Officers</h2>
            </div>
            <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={16} /> Add Officer
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
            <Stat label="Total Officers" value={stats.total} />
            <Stat label="Active" value={stats.active} />
            <Stat label="Inactive" value={stats.inactive} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search officer by name, email, or ID..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', font: '13px inherit', outline: 'none' }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: '140px', padding: '10px 28px 10px 12px', border: '1px solid var(--border)', borderRadius: '7px', background: '#fff', font: '13px inherit', outline: 'none' }}>
              {['All Status', 'Active', 'Inactive'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && officers.length === 0} emptyMessage="No officers found.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Officer ID', 'Name', 'Program', 'Brigade', 'Position', 'Email', 'Contact', 'Status', 'Inclusive Learning', 'Actions'].map(label => (
                      <th key={label} style={{ textAlign: 'left', padding: '12px 8px', fontSize: '11px', color: 'var(--text-primary)' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officers.map((officer, index) => (
                    <tr key={officer._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={cell}>{index + 1}</td>
                      <td style={cell}>{officer.officerId}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>{officer.fullName}</td>
                      <td style={cell}>{officer.program}</td>
                      <td style={cell}>{officer.brigade || '—'}</td>
                      <td style={cell}>{officer.position}</td>
                      <td style={cell}>{officer.email}</td>
                      <td style={cell}>{officer.contactNumber || '—'}</td>
                      <td style={{ ...cell, color: officer.status === 'Active' ? '#2E7D32' : 'var(--red-status)', fontWeight: 700 }}>{officer.status}</td>
                      <td style={cell}>
                        {officer.program !== 'ROTC' ? (
                          // Inclusive Learning Section only exists for ROTC — see backend utils/specialClass.js.
                          '—'
                        ) : (isSuperAdmin || isAdminRotc) ? (
                          <button
                            onClick={() => handleToggleSpecialClass(officer)}
                            disabled={specialClassBusyId === officer._id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px',
                              border: officer.isSpecialClassOfficer ? '1px solid var(--maroon)' : '1px solid var(--border)',
                              background: officer.isSpecialClassOfficer ? 'var(--maroon)' : 'transparent',
                              color: officer.isSpecialClassOfficer ? '#fff' : 'var(--text-secondary)',
                              fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              opacity: specialClassBusyId === officer._id ? 0.6 : 1,
                            }}
                          >
                            <Shield size={12} /> {officer.isSpecialClassOfficer ? 'Assigned' : 'Assign'}
                          </button>
                        ) : officer.isSpecialClassOfficer ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'var(--maroon)', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                            <Shield size={12} /> Assigned
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button aria-label="Edit officer" onClick={() => setModal(officer)} style={iconButton}><Pencil size={15} /></button>
                        <button aria-label={officer.status === 'Active' ? 'Deactivate officer' : 'Activate officer'} onClick={() => setDeactivateTarget(officer)} style={iconButton}><Power size={15} /></button>
                        {isSuperAdmin && (
                          <button aria-label="Delete officer" onClick={() => setDeleteTarget(officer)} style={{ ...iconButton, color: '#DC2626' }}><Trash2 size={15} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </section>
      </main>

      {modal && (
        <OfficerFormModal
          officer={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title={deactivateTarget?.status === 'Active' ? 'Deactivate this officer?' : 'Activate this officer?'}
        message={`${deactivateTarget?.fullName} will be marked ${deactivateTarget?.status === 'Active' ? 'Inactive' : 'Active'}.`}
        confirmLabel={deactivateTarget?.status === 'Active' ? 'Deactivate' : 'Activate'}
        danger={deactivateTarget?.status === 'Active'}
        busy={busyAction}
        onConfirm={handleDeactivateToggle}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Are you sure you want to delete this officer?"
        message="This cannot be undone."
        confirmLabel="Delete"
        busy={busyAction}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const cell = { padding: '12px 8px', fontSize: '12px', color: 'var(--text-primary)' };
const iconButton = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' };

function Stat({ label, value }) {
  return (
    <div style={{ padding: '16px 12px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</p>
      <strong style={{ fontSize: '22px' }}>{value}</strong>
    </div>
  );
}

function OfficerFormModal({ officer, onClose, onSaved }) {
  const { isSuperAdmin, effectiveProgram } = useAuth();
  const isEdit = Boolean(officer);

  const [form, setForm] = useState({
    name: officer?.fullName || '',
    email: officer?.email || '',
    position: officer?.position || '',
    brigadeId: officer?.brigadeId || '',
    contactNumber: officer?.contactNumber || '',
    // A program-scoped admin (admin_cwts/admin_rotc) is always locked to
    // their own program — only super_admin needs the visible selector below.
    program: officer?.program || effectiveProgram || 'CWTS',
    status: officer?.status || 'Active',
    studentUserId: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [brigades, setBrigades] = useState([]);
  const [brigadesLoading, setBrigadesLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const traineeLabel = form.program === 'ROTC' ? 'Cadet' : 'Student';
  const positionOptions = OFFICER_POSITIONS[form.program] || [];

  // Only brigades belonging to this officer's own NSTP program are valid —
  // reload whenever the selected program changes (super_admin creating one).
  useEffect(() => {
    let cancelled = false;
    setBrigadesLoading(true);
    brigadesApi
      .list({ nstpProgram: form.program, status: 'Active' })
      .then((res) => { if (!cancelled) setBrigades(res?.data || []); })
      .catch(() => { if (!cancelled) setBrigades([]); })
      .finally(() => { if (!cancelled) setBrigadesLoading(false); });
    return () => { cancelled = true; };
  }, [form.program]);

  // New officers are promoted from an existing trainee — once a brigade is
  // picked, load every student/cadet assigned to it (any status) so the
  // admin can choose who to promote.
  useEffect(() => {
    if (isEdit || !form.brigadeId) { setCandidates([]); return; }
    let cancelled = false;
    setCandidatesLoading(true);
    const api = form.program === 'ROTC' ? cadetsApi : studentsApi;
    api
      .list({ brigadeId: form.brigadeId })
      .then((res) => { if (!cancelled) setCandidates(res?.data || []); })
      .catch(() => { if (!cancelled) setCandidates([]); })
      .finally(() => { if (!cancelled) setCandidatesLoading(false); });
    return () => { cancelled = true; };
  }, [isEdit, form.brigadeId, form.program]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleBrigadeChange = (brigadeId) => {
    setForm((f) => ({ ...f, brigadeId, studentUserId: '', name: '', email: '' }));
  };

  const handleCandidateChange = (userId) => {
    const chosen = candidates.find((c) => c.userId === userId);
    setForm((f) => ({
      ...f,
      studentUserId: userId,
      name: chosen?.fullName || '',
      email: chosen?.email || '',
    }));
  };

  const validate = () => {
    if (isEdit) {
      if (!form.name.trim()) return 'Name is required.';
      if (!form.email.trim()) return 'Email is required.';
      // Only enforce the MARSU domain when the email is actually being
      // changed — an existing officer's email from before this rule existed
      // must stay editable for every other field without being forced to
      // also fix their email in the same save.
      const emailChanged = form.email.trim().toLowerCase() !== (officer?.email || '').toLowerCase();
      if (emailChanged && !/^[^\s@]+@marsu\.edu\.ph$/i.test(form.email)) {
        return 'Enter an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).';
      }
      if (!positionOptions.includes(form.position)) return 'Select a valid position.';
      return '';
    }
    if (isSuperAdmin && !form.program) return 'Program is required.';
    if (!form.brigadeId) return 'Select a brigade first.';
    if (!form.studentUserId) return `Select a ${traineeLabel.toLowerCase()} to promote.`;
    if (!positionOptions.includes(form.position)) return 'Select a valid position.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      if (isEdit) {
        await officersApi.update(officer._id, {
          fullName: form.name,
          email: form.email,
          position: form.position,
          brigadeId: form.brigadeId || null,
          contactNumber: form.contactNumber,
          status: form.status,
          name: form.name,
        });
      } else {
        await officersApi.promote({
          studentUserId: form.studentUserId,
          position: form.position,
          brigadeId: form.brigadeId,
          ...(isSuperAdmin ? { program: form.program } : {}),
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save officer.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{isEdit ? 'Edit Officer' : 'Add Officer'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {!isEdit && (
          <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Officers are promoted from an existing trainee. Pick a brigade, then choose which {traineeLabel.toLowerCase()} to promote — they keep their existing login.
          </p>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {!isEdit && isSuperAdmin && (
            <Field label="Program" span={2}>
              <select
                value={form.program}
                onChange={e => setForm(f => ({ ...f, program: e.target.value, position: '' }))}
              >
                <option value="CWTS">CWTS</option>
                <option value="ROTC">ROTC</option>
              </select>
            </Field>
          )}
          {!isEdit && (
            <>
              <Field label="Brigade" span={2}>
                <select value={form.brigadeId} onChange={e => handleBrigadeChange(e.target.value)} disabled={brigadesLoading}>
                  <option value="">{brigadesLoading ? 'Loading brigades...' : 'Select a brigade'}</option>
                  {brigades.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label={traineeLabel} span={2}>
                <select
                  value={form.studentUserId}
                  onChange={e => handleCandidateChange(e.target.value)}
                  disabled={!form.brigadeId || candidatesLoading}
                >
                  <option value="">
                    {!form.brigadeId
                      ? 'Select a brigade first'
                      : candidatesLoading
                        ? 'Loading...'
                        : candidates.length === 0
                          ? `No ${traineeLabel.toLowerCase()}s in this brigade`
                          : `Select a ${traineeLabel.toLowerCase()}`}
                  </option>
                  {candidates.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.fullName} ({c.studentId || c.cadetId}) — {c.status}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {(isEdit || form.studentUserId) && (
            <>
              <Field label="Full Name"><input value={form.name} onChange={e => update('name', e.target.value)} disabled={!isEdit} /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={e => update('email', e.target.value)} disabled={!isEdit} /></Field>
            </>
          )}
          <Field label="Position" span={isEdit ? 1 : 2}>
            <select value={form.position} onChange={e => update('position', e.target.value)}>
              <option value="">Select a position</option>
              {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          {isEdit && (
            <>
              <Field label="Contact Number"><input value={form.contactNumber} onChange={e => update('contactNumber', e.target.value)} /></Field>
              <Field label="Brigade">
                <select value={form.brigadeId} onChange={e => update('brigadeId', e.target.value)} disabled={brigadesLoading}>
                  <option value="">{brigadesLoading ? 'Loading brigades...' : 'No brigade assigned'}</option>
                  {brigades.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Status"><select value={form.status} onChange={e => update('status', e.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field>
            </>
          )}
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Promote to Officer'}
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
      {React.cloneElement(children, { style: { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'inherit', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' } })}
    </label>
  );
}
