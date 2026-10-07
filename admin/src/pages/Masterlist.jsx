import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, UploadCloud, UserPlus, Search, Trash2, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { masterlistApi } from '../api/masterlist';
import { programsApi } from '../api/programs';

const CAMPUS_OPTIONS = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];
const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function Masterlist() {
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const fetcher = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    const res = await masterlistApi.list(params);
    return { rows: res.data || [], total: res.total ?? res.count ?? 0 };
  }, [search]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const rows = data?.rows || [];
  const total = data?.total ?? 0;

  const handleRemove = async (row) => {
    if (!window.confirm(`Remove ${row.studentNumber} from the NSTP masterlist?`)) return;
    try {
      await masterlistApi.remove(row._id);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to remove that entry.'));
    }
  };

  const handleClear = async () => {
    if (!window.confirm(`This removes all ${total} entries from the NSTP masterlist. Trainees will not be able to register for CWTS or ROTC until a new list is uploaded. Continue?`)) return;
    try {
      await masterlistApi.clear();
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to clear the list.'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Masterlist" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <ShieldCheck size={22} color="var(--text-primary)" strokeWidth={2.2} style={{ marginTop: '2px' }} />
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>NSTP Masterlist</h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: '1.5px solid var(--maroon)', background: '#fff', color: 'var(--maroon)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <UserPlus size={16} /> Add Student
              </button>
              <button onClick={() => setUploadOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <UploadCloud size={16} /> Upload File
              </button>
              {total > 0 && (
                <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1.5px solid #DC2626', background: 'transparent', color: '#DC2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Trash2 size={15} /> Clear list
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
            <StatPill label="Entries on file" value={total} />
          </div>
        </section>

        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '20px 24px', minHeight: '420px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: '320px', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Student Number or name..."
                style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
          </div>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && rows.length === 0}
            emptyMessage={search ? 'No matching entries.' : 'No enrollment records uploaded yet. Upload a file to get started.'}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {['Student Number', 'Full Name', 'Email', 'Program', 'Campus', 'Year', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{r.studentNumber}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>{r.fullName}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.email || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.courseProgram}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.campus || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.academicYear || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleRemove(r)} title="Remove" style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={15} />
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

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); refetch(); }}
        />
      )}

      {addOpen && (
        <AddStudentModal
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={{ padding: '10px 16px', borderRadius: '10px', background: '#F9FAFB', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--maroon)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const EMPTY_FORM = { studentNumber: '', fullName: '', email: '', courseProgram: '', campus: '', academicYear: '' };

function AddStudentModal({ onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    programsApi
      .list({ status: 'Active' })
      .then((res) => { if (!cancelled) setPrograms(res?.data || []); })
      .catch(() => { if (!cancelled) setPrograms([]); })
      .finally(() => { if (!cancelled) setProgramsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await masterlistApi.create(form);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Unable to add that student.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(480px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Add Student to Masterlist</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Student Number</label>
            <input value={form.studentNumber} onChange={setField('studentNumber')} required style={inputStyle} placeholder="e.g. 24NS051" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Full Name</label>
            <input value={form.fullName} onChange={setField('fullName')} required style={inputStyle} placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={setField('email')} required style={inputStyle} placeholder="e.g. juandelacruz@marsu.edu.ph" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Program</label>
            <select value={form.courseProgram} onChange={setField('courseProgram')} required disabled={programsLoading} style={inputStyle}>
              <option value="">{programsLoading ? 'Loading programs...' : 'Select a program'}</option>
              {programs.map((p) => <option key={p._id} value={p.name}>{p.campus ? `${p.name} - ${p.campus}` : p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Campus</label>
            <select value={form.campus} onChange={setField('campus')} required style={inputStyle}>
              <option value="">Select a campus</option>
              {CAMPUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Year</label>
            <select value={form.academicYear} onChange={setField('academicYear')} required style={inputStyle}>
              <option value="">Select year</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV or Excel file first.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await masterlistApi.upload(file, mode);
      setResult(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload that file.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(520px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Upload NSTP Masterlist</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {result ? (
          <div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{result.processed} row(s) processed — <strong>{result.saved} saved</strong>, {result.skipped} skipped (missing Student Number, Full Name, Email, Program, Campus, or Year). The list now has <strong>{result.total}</strong> total {result.total === 1 ? 'entry' : 'entries'}.</p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={onDone} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              CSV or Excel (.xlsx) with a header row — columns "Student Number", "Full Name", "Email", "Program", "Campus", and "Year" are all required per row; a row missing even one of them is skipped entirely. Column order/case doesn't matter.
            </p>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{error}</div>}

            <label
              onClick={() => inputRef.current?.click()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                padding: '28px 16px', border: '1.5px dashed var(--border)', borderRadius: '10px',
                cursor: 'pointer', background: '#FAFAFA', marginBottom: '16px',
              }}
            >
              <UploadCloud size={22} color="var(--text-secondary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {file ? file.name : 'Click to choose a CSV or Excel file'}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files[0] || null)}
                style={{ display: 'none' }}
              />
            </label>

            <fieldset style={{ border: 0, padding: 0, margin: '0 0 6px' }}>
              <legend style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px', padding: 0 }}>If a Student Number already exists</legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                Update it, keep everything else on the list (merge)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                Replace the entire list with just this file
              </label>
            </fieldset>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
