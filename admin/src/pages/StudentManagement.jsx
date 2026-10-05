import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Upload, Plus, ChevronDown, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { programsApi } from '../api/programs';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['All Status', 'Active', 'Dropped'];
const CAMPUS_OPTIONS = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];
// Torrijos and Gasan don't offer ROTC — only CWTS is available there.
const ROTC_RESTRICTED_CAMPUSES = ['MARSU - Torrijos', 'MARSU - Gasan'];

function CustomSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', minWidth: '150px' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px',
          border: '1px solid var(--border)', background: '#fff', fontSize: '14px',
          fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit',
          cursor: 'pointer', appearance: 'none', outline: 'none',
        }}
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
    </div>
  );
}

function normalizeStudent(s) {
  return {
    key: `student-${s._id}`,
    _id: s._id,
    userId: s.userId?._id || s.userId,
    kind: 'student',
    name: s.fullName,
    id: s.studentId,
    program: 'CWTS',
    course: s.course || '—',
    yearLevel: s.yearLevel || '—',
    section: s.section || '—',
    campus: s.campus || '—',
    brigade: s.brigade || '—',
    email: s.email,
    contactNumber: s.contactNumber || '',
    status: s.status,
    raw: s,
  };
}

function normalizeCadet(c) {
  return {
    key: `cadet-${c._id}`,
    _id: c._id,
    userId: c.userId?._id || c.userId,
    kind: 'cadet',
    name: c.fullName,
    id: c.cadetId,
    program: 'ROTC',
    course: c.course || '—',
    yearLevel: c.yearLevel || '—',
    section: c.section || '—',
    campus: c.campus || '—',
    brigade: c.brigade || '—',
    company: c.company || '—',
    email: c.email,
    contactNumber: c.contactNumber || '',
    status: c.status,
    raw: c,
  };
}

export default function StudentManagement() {
  const navigate = useNavigate();
  const { effectiveProgram, isSuperAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [programFilter, setProgramFilter] = useState('All Program');
  const [courseFilter, setCourseFilter] = useState('All Course');
  const [campusFilter, setCampusFilter] = useState('All Campus');
  const [modal, setModal] = useState(null); // { kind: 'student'|'cadet', mode: 'create'|'edit', record? }

  const fetcher = useCallback(async () => {
    const wantsStudents = effectiveProgram !== 'ROTC';
    const wantsCadets = effectiveProgram !== 'CWTS';

    const [studentRes, cadetRes] = await Promise.all([
      wantsStudents ? studentsApi.list({ search: searchQuery || undefined, status: statusFilter === 'All Status' ? undefined : statusFilter }) : Promise.resolve({ data: [], stats: { total: 0, active: 0, inactive: 0 } }),
      wantsCadets ? cadetsApi.list({ search: searchQuery || undefined, status: statusFilter === 'All Status' ? undefined : statusFilter }) : Promise.resolve({ data: [], stats: { total: 0, active: 0, inactive: 0 } }),
    ]);

    const rows = [
      ...(studentRes.data || []).map(normalizeStudent),
      ...(cadetRes.data || []).map(normalizeCadet),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return {
      rows,
      studentStats: studentRes.stats,
      cadetStats: cadetRes.stats,
    };
  }, [effectiveProgram, searchQuery, statusFilter]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);

  const filteredRows = useMemo(
    () => (data?.rows || []).filter((r) =>
      (programFilter === 'All Program' || r.program === programFilter) &&
      (courseFilter === 'All Course' || r.course === courseFilter) &&
      (campusFilter === 'All Campus' || r.campus === campusFilter)
    ),
    [data, programFilter, courseFilter, campusFilter]
  );

  // Populated from whatever's actually loaded, so the dropdown never offers
  // a course that has no trainees to show for it.
  const courseOptions = useMemo(() => {
    const courses = new Set((data?.rows || []).map((r) => r.course).filter((c) => c && c !== '—'));
    return ['All Course', ...Array.from(courses).sort()];
  }, [data]);

  const totalEnrolled = (data?.studentStats?.total || 0) + (data?.cadetStats?.total || 0);
  const activeCount = (data?.studentStats?.active || 0) + (data?.cadetStats?.active || 0);
  const droppedCount = totalEnrolled - activeCount;

  // Only a program-scoped admin adds trainees into their own program — a
  // super_admin can view every trainee here but not create new accounts.
  const showAddStudent = !isSuperAdmin && effectiveProgram !== 'ROTC';
  const showAddCadet = !isSuperAdmin && effectiveProgram !== 'CWTS';

  const pageTitle = effectiveProgram === 'ROTC' ? 'Cadet Management' : effectiveProgram === 'CWTS' ? 'Student Management' : 'Trainee Management';

  // Program is redundant here when this page is already scoped to a single
  // program (an ROTC admin only ever sees ROTC rows); show each cadet's
  // company instead of Section, which CWTS students don't have.
  const isRotcOnly = effectiveProgram === 'ROTC';
  const columns = isRotcOnly
    ? ['No.', 'Name', 'ID', 'Course / Year', 'Campus', 'Company', 'Status']
    : ['No.', 'Name', 'ID', 'Program', 'Course / Year', 'Campus', 'Brigade', 'Status'];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title={pageTitle} showBreadcrumb={true} />

      <main style={{ padding: '24px' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Trainee List</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/export-data')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '1.5px solid var(--maroon)', background: '#fff', color: 'var(--maroon)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--maroon)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--maroon)'; }}
              >
                <Upload size={16} /> Export Data
              </button>
              {showAddStudent && (
                <button onClick={() => setModal({ kind: 'student', mode: 'create' })} style={addBtnStyle}>
                  <Plus size={16} /> Add Student
                </button>
              )}
              {showAddCadet && (
                <button onClick={() => setModal({ kind: 'cadet', mode: 'create' })} style={addBtnStyle}>
                  <Plus size={16} /> Add Cadet
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search by name, ID, or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 14px 10px 42px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', color: 'var(--text-primary)' }}
              />
            </div>
            {isSuperAdmin && (
              <CustomSelect value={programFilter} onChange={setProgramFilter} options={['All Program', 'CWTS', 'ROTC']} />
            )}
            <CustomSelect value={courseFilter} onChange={setCourseFilter} options={courseOptions} />
            <CustomSelect value={campusFilter} onChange={setCampusFilter} options={['All Campus', ...CAMPUS_OPTIONS]} />
            <CustomSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <SummaryCard title="Total Enrolled" value={totalEnrolled} color="var(--text-primary)" />
            <SummaryCard title="Active" value={activeCount} color="#059669" />
            <SummaryCard title="Dropped" value={droppedCount} color="var(--red-status)" />
          </div>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && filteredRows.length === 0}
            emptyMessage="No trainees found."
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {columns.map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={cellStyle}>{idx + 1}</td>
                      <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                      <td style={cellStyle}>{row.id}</td>
                      {!isRotcOnly && <td style={cellStyle}>{row.program}</td>}
                      <td style={cellStyle}>{row.course} / {row.yearLevel}</td>
                      <td style={cellStyle}>{row.campus}</td>
                      <td style={cellStyle}>{isRotcOnly ? row.company : row.brigade}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '5px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                          background: row.status === 'Active' ? '#ECFDF5' : '#FEF2F2',
                          color: row.status === 'Active' ? '#059669' : '#DC2626',
                        }}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </div>
      </main>

      {modal && (
        <TraineeFormModal
          kind={modal.kind}
          mode={modal.mode}
          record={modal.record}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

const addBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px',
  border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '14px', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const cellStyle = { padding: '14px 16px', fontSize: '14px', color: 'var(--text-secondary)' };

function SummaryCard({ title, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{title}</p>
      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color }}>{value.toLocaleString()}</h3>
    </div>
  );
}

function TraineeFormModal({ kind, mode, record, onClose, onSaved }) {
  const isCadet = kind === 'cadet';
  const isEdit = mode === 'edit';
  const raw = record?.raw;

  const [form, setForm] = useState({
    name: raw?.fullName || '',
    email: raw?.email || '',
    password: '',
    idNumber: raw ? (isCadet ? raw.cadetId : raw.studentId) : '',
    course: raw?.course || '',
    yearLevel: raw?.yearLevel || '',
    section: raw?.section || '',
    campus: raw?.campus || '',
    platoon: raw?.platoon || '',
    company: raw?.company || '',
    contactNumber: raw?.contactNumber || '',
    address: raw?.address || '',
    emergencyContact: raw?.emergencyContact || '',
    status: raw?.status || 'Active',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);

  // Course options + the brigade each maps to — brigade is never typed by
  // hand, it's shown read-only once a course is picked (see brigadeName below).
  useEffect(() => {
    let cancelled = false;
    setProgramsLoading(true);
    programsApi
      .list({ nstpProgram: isCadet ? 'ROTC' : 'CWTS', status: 'Active' })
      .then((res) => { if (!cancelled) setPrograms(res?.data || []); })
      .catch(() => { if (!cancelled) setPrograms([]); })
      .finally(() => { if (!cancelled) setProgramsLoading(false); });
    return () => { cancelled = true; };
  }, [isCadet]);

  const brigadeName = programs.find((p) => p.name === form.course)?.brigadeId?.name || raw?.brigade || '';

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.email.trim() || !/^[^\s@]+@marsu\.edu\.ph$/i.test(form.email)) return 'Enter an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).';
    if (!isEdit) {
      if (!form.idNumber.trim()) return `${isCadet ? 'Cadet' : 'Student'} ID is required.`;
      if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters long.';
    }
    if (isCadet && form.campus && ROTC_RESTRICTED_CAMPUSES.includes(form.campus)) {
      return `ROTC is not offered at ${form.campus}. Only CWTS is available at this campus.`;
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload = {
          fullName: form.name,
          email: form.email,
          course: form.course,
          yearLevel: form.yearLevel,
          section: form.section,
          campus: form.campus,
          contactNumber: form.contactNumber,
          address: form.address,
          emergencyContact: form.emergencyContact,
          status: form.status,
          ...(isCadet ? { platoon: form.platoon, company: form.company } : {}),
        };
        if (isCadet) await cadetsApi.update(record._id, payload);
        else await studentsApi.update(record._id, payload);
      } else {
        const payload = {
          name: form.name,
          email: form.email,
          password: form.password,
          course: form.course,
          yearLevel: form.yearLevel,
          section: form.section,
          campus: form.campus,
          contactNumber: form.contactNumber,
          address: form.address,
          emergencyContact: form.emergencyContact,
          ...(isCadet ? { cadetId: form.idNumber, platoon: form.platoon, company: form.company } : { studentId: form.idNumber }),
        };
        if (isCadet) await cadetsApi.create(payload);
        else await studentsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
            {isEdit ? `Edit ${isCadet ? 'Cadet' : 'Student'}` : `Add ${isCadet ? 'Cadet' : 'Student'}`}
          </h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Full Name" span={2}><input value={form.name} onChange={(e) => update('name', e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Field>
          <Field label={isCadet ? 'Cadet ID' : 'Student ID'}>
            <input value={form.idNumber} onChange={(e) => update('idNumber', e.target.value)} disabled={isEdit} />
          </Field>
          {!isEdit && (
            <Field label="Password"><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Min. 8 characters" /></Field>
          )}
          <Field label="Course">
            <select value={form.course} onChange={(e) => update('course', e.target.value)} disabled={programsLoading}>
              <option value="">{programsLoading ? 'Loading courses...' : 'Select a course'}</option>
              {programs.map((p) => <option key={p._id} value={p.name}>{p.name} ({p.code})</option>)}
            </select>
          </Field>
          <Field label="Year Level"><input value={form.yearLevel} onChange={(e) => update('yearLevel', e.target.value)} placeholder="e.g. 2nd Year" /></Field>
          <Field label="Section"><input value={form.section} onChange={(e) => update('section', e.target.value)} /></Field>
          <Field label="Campus">
            <select value={form.campus} onChange={(e) => update('campus', e.target.value)}>
              <option value="">Select a campus</option>
              {CAMPUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {isCadet && form.campus && ROTC_RESTRICTED_CAMPUSES.includes(form.campus) && (
            <div style={{ gridColumn: 'span 2', ...errorBoxStyle, marginBottom: 0 }}>
              ROTC is not offered at {form.campus}. Only CWTS is available at this campus.
            </div>
          )}
          <Field label="Contact Number"><input value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} /></Field>
          {isCadet ? (
            <>
              <Field label="Platoon"><input value={form.platoon} onChange={(e) => update('platoon', e.target.value)} /></Field>
              <Field label="Company"><input value={form.company} onChange={(e) => update('company', e.target.value)} /></Field>
            </>
          ) : null}
          <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Brigade
            <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
              {brigadeName || 'Determined automatically from course'}
            </div>
          </label>
          {isEdit && (
            <Field label="Status">
              <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Dropped">Dropped</option>
              </select>
            </Field>
          )}
          <Field label="Address" span={2}><input value={form.address} onChange={(e) => update('address', e.target.value)} /></Field>
          <Field label="Emergency Contact" span={2}><input value={form.emergencyContact} onChange={(e) => update('emergencyContact', e.target.value)} /></Field>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...saveBtnStyle, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
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
        style: { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'inherit', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' },
      })}
    </label>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' };
const modalStyle = { background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' };
const errorBoxStyle = { background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' };
const cancelBtnStyle = { padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const saveBtnStyle = { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
