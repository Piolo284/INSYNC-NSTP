import React, { useCallback, useState } from 'react';
import { Plus, Pencil, Archive, RotateCcw, Layers, Info, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { programsApi, brigadesApi } from '../api/programs';
import { useAuth } from '../context/AuthContext';

const CAMPUS_OPTIONS = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];

/**
 * The centralized "College Program -> Brigade" configuration screen.
 * Program:Brigade is strictly 1:1, so this is one page/one form for both —
 * creating a program always creates its paired brigade in the same request,
 * closing off the possibility of a program existing without one (or vice
 * versa) that a separate CRUD screen for each would allow.
 */
export default function ProgramManagement() {
  const { effectiveProgram, isSuperAdmin, isSystemMaintenanceAdmin } = useAuth();
  // Both roles see every program across CWTS + ROTC, not just one program's
  // rows — admin_cwts/admin_rotc stay locked to effectiveProgram instead.
  const canManageAllPrograms = isSuperAdmin || isSystemMaintenanceAdmin;
  const [modal, setModal] = useState(null); // 'create' | program
  const [statsTarget, setStatsTarget] = useState(null); // program whose brigade stats to show
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busyAction, setBusyAction] = useState(false);

  const fetcher = useCallback(async () => {
    const params = {};
    if (effectiveProgram) params.nstpProgram = effectiveProgram;
    const res = await programsApi.list(params);
    return res;
  }, [effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const programs = data?.data || [];

  const handleArchiveToggle = async () => {
    setBusyAction(true);
    try {
      const nextStatus = archiveTarget.status === 'Active' ? 'Inactive' : 'Active';
      await programsApi.update(archiveTarget._id, { status: nextStatus });
      setArchiveTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to update program status.'));
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="College Programs & Brigades" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>College Programs</h2>
            </div>
            <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={16} /> Add Program
            </button>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Every college program maps to exactly one brigade — students are assigned to a brigade automatically based
            on the program they're enrolled in, never by hand.
          </p>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && programs.length === 0} emptyMessage="No college programs configured yet.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Program', 'Code', ...(canManageAllPrograms ? ['NSTP Program'] : []), 'Brigade', 'Campus', 'Status', 'Actions'].map((label) => (
                      <th key={label} style={{ textAlign: 'left', padding: '12px 8px', fontSize: '11px', color: 'var(--text-primary)' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {programs.map((program, index) => (
                    <tr key={program._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={cell}>{index + 1}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>{program.name}</td>
                      <td style={cell}>{program.code}</td>
                      {canManageAllPrograms && <td style={cell}>{program.nstpProgram}</td>}
                      <td style={cell}>
                        <button onClick={() => setStatsTarget(program)} style={{ ...pill, cursor: 'pointer', border: '1px solid var(--border)', background: '#fff' }}>
                          {program.brigadeId?.name || '—'} <Info size={12} style={{ verticalAlign: '-2px', marginLeft: '4px' }} />
                        </button>
                      </td>
                      <td style={cell}>{program.campus || <span style={{ color: 'var(--text-secondary)' }}>Not fixed</span>}</td>
                      <td style={{ ...cell, color: program.status === 'Active' ? '#2E7D32' : 'var(--red-status)', fontWeight: 700 }}>{program.status}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button aria-label="Edit program" onClick={() => setModal(program)} style={iconButton}><Pencil size={15} /></button>
                        <button
                          aria-label={program.status === 'Active' ? 'Archive program' : 'Reactivate program'}
                          onClick={() => setArchiveTarget(program)}
                          style={iconButton}
                        >
                          {program.status === 'Active' ? <Archive size={15} /> : <RotateCcw size={15} />}
                        </button>
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
        <ProgramFormModal
          program={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}

      {statsTarget && (
        <BrigadeStatsModal
          brigadeId={statsTarget.brigadeId?._id}
          onClose={() => setStatsTarget(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={archiveTarget?.status === 'Active' ? 'Archive this program?' : 'Reactivate this program?'}
        message={
          archiveTarget?.status === 'Active'
            ? `${archiveTarget?.name} and its brigade (${archiveTarget?.brigadeId?.name}) will stop accepting new student assignments. Existing students keep their current brigade.`
            : `${archiveTarget?.name} will accept new student assignments again.`
        }
        confirmLabel={archiveTarget?.status === 'Active' ? 'Archive' : 'Reactivate'}
        danger={archiveTarget?.status === 'Active'}
        busy={busyAction}
        onConfirm={handleArchiveToggle}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

const cell = { padding: '12px 8px', fontSize: '12px', color: 'var(--text-primary)' };
const iconButton = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' };
const pill = { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' };

function ProgramFormModal({ program, onClose, onSaved }) {
  const { effectiveProgram, isSuperAdmin, isSystemMaintenanceAdmin } = useAuth();
  const canManageAllPrograms = isSuperAdmin || isSystemMaintenanceAdmin;
  const isEdit = Boolean(program);

  const [form, setForm] = useState({
    name: program?.name || '',
    code: program?.code || '',
    nstpProgram: program?.nstpProgram || effectiveProgram || 'CWTS',
    brigadeName: program?.brigadeId?.name || '',
    campus: program?.campus || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    if (!form.name.trim()) return 'Program name is required.';
    if (!form.code.trim()) return 'Program code is required.';
    if (!form.brigadeName.trim()) return 'Brigade name is required.';
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
        await programsApi.update(program._id, {
          name: form.name,
          code: form.code,
          brigadeName: form.brigadeName,
          campus: form.campus || null,
        });
      } else {
        await programsApi.create({
          name: form.name,
          code: form.code,
          nstpProgram: form.nstpProgram,
          brigadeName: form.brigadeName,
          campus: form.campus || null,
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save program.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{isEdit ? 'Edit Program' : 'Add Program'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Program Name" span={2}><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. BS Information Technology" /></Field>
          <Field label="Program Code"><input value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="e.g. BSIT" /></Field>
          {!isEdit && canManageAllPrograms && (
            <Field label="NSTP Program">
              <select value={form.nstpProgram} onChange={(e) => update('nstpProgram', e.target.value)}>
                <option value="CWTS">CWTS</option>
                <option value="ROTC">ROTC</option>
              </select>
            </Field>
          )}
          <Field label="Brigade Name" span={2}><input value={form.brigadeName} onChange={(e) => update('brigadeName', e.target.value)} placeholder="e.g. Brigade Makakalikasan" /></Field>
          <Field label="Fixed Campus (optional)" span={2}>
            <select value={form.campus} onChange={(e) => update('campus', e.target.value)}>
              <option value="">Not fixed — trainee picks their own campus</option>
              {CAMPUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <p style={{ gridColumn: 'span 2', margin: '-8px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Set this when this program/college is only ever offered at one campus — a trainee's own campus is then auto-filled from it instead of being asked at registration.
          </p>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Read-only brigade drill-in: officer/student counts + officer roster. */
function BrigadeStatsModal({ brigadeId, onClose }) {
  const fetcher = useCallback(async () => {
    if (!brigadeId) return null;
    return brigadesApi.get(brigadeId);
  }, [brigadeId]);
  const { data, loading, error } = useApi(fetcher, [fetcher]);
  const brigade = data?.data?.brigade;
  const officerCount = data?.data?.officerCount ?? 0;
  const studentCount = data?.data?.studentCount ?? 0;
  const officers = data?.data?.officers || [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{brigade?.name || 'Brigade'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {loading && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading...</p>}
        {error && <p style={{ fontSize: '13px', color: 'var(--red-status)' }}>{error}</p>}
        {!loading && !error && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Officers</p>
                <strong style={{ fontSize: '20px' }}>{officerCount}</strong>
              </div>
              <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Students</p>
                <strong style={{ fontSize: '20px' }}>{studentCount}</strong>
              </div>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Assigned Officers</p>
            {officers.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>No officer is assigned to this brigade yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '8px' }}>
                {officers.map((o) => (
                  <li key={o._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>{o.fullName}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{o.position}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
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
