import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, UploadCloud, UserPlus, Search, Trash2, X, CheckCircle2, Pencil, Download, History, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { masterlistApi } from '../api/masterlist';
import { programsApi } from '../api/programs';

const CAMPUS_OPTIONS = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];
const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const TEMPLATE_HEADERS = ['Student ID', 'Full Name', 'Email', 'Program', 'Campus', 'Year Level'];
const PAGE_SIZE = 25;
const MAX_FILE_MB = 10;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_RX = /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/;

const cardStyle = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)' };
const thStyle = { padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 12px', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tdMuted = { ...tdStyle, color: 'var(--text-secondary)' };
const btnBase = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const btnPrimary = { ...btnBase, border: 'none', background: 'var(--maroon)', color: '#fff' };
const btnOutline = { ...btnBase, border: '1px solid var(--maroon)', background: '#fff', color: 'var(--maroon)' };
const btnSecondary = { ...btnBase, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)' };
const iconBtn = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'inline-flex' };
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' };
const errorBox = { background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' };

const COLUMNS = [
  { label: 'Student ID', width: '11%' },
  { label: 'Full Name', width: '17%' },
  { label: 'Email', width: '21%' },
  { label: 'Program', width: '24%' },
  { label: 'Campus', width: '13%' },
  { label: 'Year Level', width: '8%' },
  { label: '', width: '6%' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadTemplate() {
  // Leading BOM so Excel opens it as UTF-8.
  const blob = new Blob([`﻿${TEMPLATE_HEADERS.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'masterlist_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * System Maintenance → Masterlist. The official NSTP roster that trainee
 * self-registration is checked against (backend utils/masterlistMatch.js).
 * Uploading a file adds new students and updates existing ones by Student
 * ID; nobody is removed unless the admin deletes them here.
 */
export default function Masterlist() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'upload' | 'history' | { edit: row|null }
  const [confirm, setConfirm] = useState(null); // { type: 'remove', row } | { type: 'clear' }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetcher = useCallback(
    () => masterlistApi.list({ search, page, limit: PAGE_SIZE }),
    [search, page]
  );
  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const rows = data?.data || [];
  const total = data?.total ?? 0;
  const matched = data?.matched ?? 0;
  const pages = data?.pages ?? 1;
  const currentImport = data?.currentImport || null;

  const handleConfirm = async () => {
    setConfirmBusy(true);
    setActionError('');
    try {
      if (confirm.type === 'remove') await masterlistApi.remove(confirm.row._id);
      else await masterlistApi.clear();
      setConfirm(null);
      if (confirm.type === 'remove' && rows.length === 1 && page > 1) setPage(page - 1);
      else refetch();
    } catch (err) {
      setConfirm(null);
      setActionError(errorMessage(err, 'Unable to remove.'));
    } finally {
      setConfirmBusy(false);
    }
  };

  const firstShown = matched ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Masterlist" showBreadcrumb={true} />
      <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section style={{ ...cardStyle, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
            <ShieldCheck size={22} color="var(--maroon)" strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>NSTP Masterlist</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> students
                {currentImport && <> · Last upload: {currentImport.fileName}, {formatDate(currentImport.confirmedAt || currentImport.createdAt)}</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setModal('history')} style={btnSecondary}><History size={15} /> Import History</button>
            <button onClick={() => setModal({ edit: null })} style={btnOutline}><UserPlus size={15} /> Add Student</button>
            <button onClick={() => setModal('upload')} style={btnPrimary}><UploadCloud size={15} /> Upload Masterlist</button>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search Student ID or name" style={{ ...inputStyle, paddingLeft: '34px' }} />
            </div>
            {total > 0 && (
              <button onClick={() => setConfirm({ type: 'clear' })} style={{ ...btnBase, padding: '6px 10px', border: 'none', background: 'none', color: '#B91C1C', fontSize: '12.5px' }}>
                <Trash2 size={14} /> Clear list
              </button>
            )}
          </div>

          {actionError && <div style={errorBox}>{actionError}</div>}

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && rows.length === 0}
            emptyMessage={search ? 'No students match your search.' : 'The masterlist is empty. Upload a masterlist file to get started.'}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', tableLayout: 'fixed' }}>
                <colgroup>{COLUMNS.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {COLUMNS.map((c, i) => <th key={i} style={{ ...thStyle, textAlign: i === COLUMNS.length - 1 ? 'right' : 'left' }}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace' }}>{r.studentNumber}</td>
                      <td style={tdStyle} title={r.fullName}>
                        {r.fullName}
                        {r.inCurrentList === false && (
                          <span title="Left out by an earlier upload, so this student can't register. Edit and save to reactivate." style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, background: 'var(--orange-banner)', color: 'var(--orange-text)', border: '1px solid var(--orange-border)' }}>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td style={tdMuted} title={r.email}>{r.email}</td>
                      <td style={tdMuted} title={r.courseProgram}>{r.courseProgram}</td>
                      <td style={tdMuted} title={r.campus}>{r.campus}</td>
                      <td style={tdMuted}>{r.academicYear}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', padding: '6px 8px' }}>
                        <button onClick={() => setModal({ edit: r })} title="Edit" style={iconBtn}><Pencil size={15} /></button>
                        <button onClick={() => setConfirm({ type: 'remove', row: r })} title="Delete" style={iconBtn}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <span>Showing {firstShown}–{lastShown} of {matched}</span>
              {pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setPage(page - 1)} disabled={page <= 1} style={{ ...btnSecondary, padding: '6px 10px', opacity: page <= 1 ? 0.5 : 1 }}><ChevronLeft size={15} /></button>
                  <span>Page {page} of {pages}</span>
                  <button onClick={() => setPage(page + 1)} disabled={page >= pages} style={{ ...btnSecondary, padding: '6px 10px', opacity: page >= pages ? 0.5 : 1 }}><ChevronRight size={15} /></button>
                </div>
              )}
            </div>
          </AsyncSection>
        </section>
      </main>

      {modal === 'upload' && <UploadModal onClose={() => setModal(null)} onImported={refetch} />}
      {modal === 'history' && <HistoryModal onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && (
        <StudentModal
          student={modal.edit}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === 'clear' ? 'Clear the whole masterlist?' : 'Delete this student?'}
        message={confirm?.type === 'clear'
          ? `All ${total} students will be removed. Existing trainee accounts are not affected.`
          : confirm?.row && `${confirm.row.studentNumber} – ${confirm.row.fullName} will be removed from the masterlist.`}
        confirmLabel={confirm?.type === 'clear' ? 'Clear list' : 'Delete'}
        busy={confirmBusy}
        onConfirm={handleConfirm}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </div>
  );
}

function Modal({ title, width = 480, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', padding: '22px', width: `min(${width}px, 100%)`, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={iconBtn} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const EMPTY_FORM = { studentNumber: '', fullName: '', email: '', courseProgram: '', campus: '', academicYear: '' };

/** Add a student (student = null) or edit an existing one. */
function StudentModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState(() => (student
    ? { studentNumber: student.studentNumber, fullName: student.fullName, email: student.email, courseProgram: student.courseProgram, campus: student.campus, academicYear: student.academicYear }
    : EMPTY_FORM));
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

  // A value from an uploaded file may not match the dropdown lists exactly —
  // keep it selectable so editing doesn't silently blank it.
  const programNames = [...new Set(programs.map((p) => p.name))];
  if (form.courseProgram && !programNames.includes(form.courseProgram)) programNames.unshift(form.courseProgram);
  const campusOptions = form.campus && !CAMPUS_OPTIONS.includes(form.campus) ? [form.campus, ...CAMPUS_OPTIONS] : CAMPUS_OPTIONS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!STUDENT_ID_RX.test(form.studentNumber.trim())) return setError('Student ID may only contain letters, numbers and dashes.');
    if (!EMAIL_RX.test(form.email.trim())) return setError('Please enter a valid email address.');
    setError('');
    setSubmitting(true);
    try {
      if (student) await masterlistApi.update(student._id, form);
      else await masterlistApi.create(form);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save.'));
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' };
  const field = { marginBottom: '12px' };

  return (
    <Modal title={student ? 'Edit Student' : 'Add Student'} onClose={onClose}>
      {error && <div style={errorBox}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={field}>
          <label style={labelStyle}>Student ID</label>
          <input value={form.studentNumber} onChange={setField('studentNumber')} required style={inputStyle} placeholder="e.g. 26B0001" />
        </div>
        <div style={field}>
          <label style={labelStyle}>Full Name</label>
          <input value={form.fullName} onChange={setField('fullName')} required style={inputStyle} placeholder="e.g. Juan A. Dela Cruz" />
        </div>
        <div style={field}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={form.email} onChange={setField('email')} required style={inputStyle} placeholder="e.g. juan.delacruz@marsu.edu.ph" />
        </div>
        <div style={field}>
          <label style={labelStyle}>Program</label>
          <select value={form.courseProgram} onChange={setField('courseProgram')} required disabled={programsLoading} style={inputStyle}>
            <option value="">{programsLoading ? 'Loading...' : 'Select a program'}</option>
            {programNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div style={field}>
            <label style={labelStyle}>Campus</label>
            <select value={form.campus} onChange={setField('campus')} required style={inputStyle}>
              <option value="">Select a campus</option>
              {campusOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={labelStyle}>Year Level</label>
            <select value={form.academicYear} onChange={setField('academicYear')} required style={inputStyle}>
              <option value="">Select year</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Saving...' : student ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Upload Masterlist: choose file → server validates it and returns a short
 * preview (nothing saved yet) → Import → summary. Cancelling at the preview
 * step discards the staged upload.
 */
function UploadModal({ onClose, onImported }) {
  const [step, setStep] = useState('choose'); // choose | preview | done
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const importId = preview?.import?._id;
  const counts = preview?.import?.counts || {};

  const handleClose = async () => {
    if (busy) return;
    if (step === 'preview' && importId) {
      try { await masterlistApi.cancelImport(importId); } catch { /* already gone */ }
    }
    onClose();
  };

  const chooseFile = (f) => {
    setError('');
    if (!f) return setFile(null);
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext === 'xls') return setError('Old .xls files can\'t be read. Open it in Excel and save it as .xlsx or .csv.');
    if (!['xlsx', 'csv'].includes(ext)) return setError('Please choose an .xlsx or .csv file.');
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_FILE_MB} MB.`);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return setError('Please choose a file first.');
    setError('');
    setBusy(true);
    try {
      const res = await masterlistApi.previewImport(file);
      setPreview(res.data);
      setStep('preview');
    } catch (err) {
      setError(errorMessage(err, 'Unable to read that file.'));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await masterlistApi.confirmImport(importId);
      setResult(res.data);
      setStep('done');
      onImported();
    } catch (err) {
      setError(errorMessage(err, 'Unable to import the masterlist.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Upload Masterlist" width={step === 'preview' ? 860 : 520} onClose={handleClose}>
      {error && <div style={errorBox}>{error}</div>}

      {step === 'choose' && (
        <>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Upload a masterlist containing Student ID, Full Name, Email, Program, Campus, and Year Level.
          </p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '26px 16px', border: `1.5px dashed ${dragging ? 'var(--maroon)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', background: dragging ? 'var(--gold-light)' : '#FAFAFA', textAlign: 'center' }}
          >
            {file ? <FileSpreadsheet size={22} color="var(--maroon)" /> : <UploadCloud size={22} color="var(--text-secondary)" />}
            <span style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>{file ? file.name : 'Click or drop a file here'}</span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : '.xlsx or .csv, up to 10 MB'}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { chooseFile(e.target.files[0]); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button type="button" onClick={downloadTemplate} style={{ ...btnBase, padding: '6px 0', border: 'none', background: 'none', color: 'var(--maroon)' }}>
              <Download size={15} /> Download Template
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={handleClose} style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleUpload} disabled={busy || !file} style={{ ...btnPrimary, opacity: busy || !file ? 0.6 : 1 }}>
                {busy ? 'Checking...' : 'Upload Masterlist'}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'preview' && preview && (
        <>
          <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
            <strong>{counts.valid}</strong> students ready to import
            <span style={{ color: 'var(--text-secondary)' }}> ({counts.added} new, {counts.updated} updated{counts.unchanged ? `, ${counts.unchanged} unchanged` : ''})</span>
            {counts.invalid > 0 && <span style={{ color: '#B91C1C' }}> · {counts.invalid} row{counts.invalid > 1 ? 's' : ''} with errors will be skipped</span>}
          </p>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: '#F9FAFB' }}>
                  {TEMPLATE_HEADERS.map((h) => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((r) => (
                  <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{r.studentNumber}</td>
                    <td style={tdStyle}>{r.fullName}</td>
                    <td style={tdMuted}>{r.email}</td>
                    <td style={tdMuted}>{r.courseProgram}</td>
                    <td style={tdMuted}>{r.campus}</td>
                    <td style={tdMuted}>{r.academicYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {counts.valid > preview.previewRows.length && (
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>First {preview.previewRows.length} of {counts.valid} rows shown.</div>
          )}

          {preview.invalidRows.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#B91C1C', marginBottom: '6px' }}>Rows to fix</div>
              <ul style={{ margin: 0, padding: '8px 12px 8px 28px', maxHeight: '150px', overflowY: 'auto', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', fontSize: '12.5px', color: '#7F1D1D', lineHeight: 1.7 }}>
                {preview.invalidRows.map((r) => (
                  <li key={r.rowNumber}>Row {r.rowNumber}{r.studentNumber ? ` (${r.studentNumber})` : ''}: {r.reason}</li>
                ))}
              </ul>
              {preview.invalidTruncated && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>Only the first {preview.invalidRows.length} errors are listed.</div>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button type="button" onClick={handleClose} disabled={busy} style={btnSecondary}>Cancel</button>
            <button type="button" onClick={handleImport} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Importing...' : `Import ${counts.valid} Students`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#047857', marginBottom: '14px' }}>
            <CheckCircle2 size={18} /> Masterlist updated
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[['Students added', result.added, '#047857'], ['Students updated', result.updated, '#1D4ED8'], ['Rows skipped', result.skipped, '#B91C1C']].map(([label, value, color]) => (
              <div key={label} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#F9FAFB' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color }}>{value ?? 0}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button onClick={onClose} style={btnPrimary}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}

const STATUS_COLOR = { Completed: '#047857', Cancelled: '#6B7280', Failed: '#B91C1C', Pending: '#1D4ED8', Processing: '#1D4ED8' };

function HistoryModal({ onClose }) {
  const fetcher = useCallback(async () => (await masterlistApi.imports({ limit: 50 })).data || [], []);
  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const imports = data || [];

  return (
    <Modal title="Import History" width={760} onClose={onClose}>
      <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && imports.length === 0} emptyMessage="No uploads yet.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                {['File', 'Date', 'Added', 'Updated', 'Skipped', 'By', 'Status'].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => {
                const c = imp.counts || {};
                const applied = imp.status === 'Completed';
                return (
                  <tr key={imp._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: '200px' }} title={imp.fileName}>{imp.fileName}</td>
                    <td style={tdMuted}>{formatDate(imp.confirmedAt || imp.createdAt)}</td>
                    <td style={tdMuted}>{applied ? c.added ?? 0 : '—'}</td>
                    <td style={tdMuted}>{applied ? c.updated ?? 0 : '—'}</td>
                    <td style={tdMuted}>{applied ? c.invalid ?? 0 : '—'}</td>
                    <td style={tdMuted}>{imp.importedBy?.name || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: STATUS_COLOR[imp.status] }}>{imp.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncSection>
    </Modal>
  );
}
