import React, { useCallback, useState } from 'react';
import { FileCheck2, Search, FileDown, User, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { submissionsApi } from '../api/submissions';
import { BASE_URL } from '../api/client';

const FILE_HOST = BASE_URL.replace(/\/api\/?$/, '');

const STATUS_COLORS = {
  Submitted: { bg: '#EFF6FF', color: '#2563EB' },
  Graded: { bg: '#ECFDF5', color: '#059669' },
};

export default function Submissions() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [gradeTarget, setGradeTarget] = useState(null);

  const fetcher = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (status !== 'All Status') params.status = status;
    const res = await submissionsApi.list(params);
    return res.data || [];
  }, [search, status]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const submissions = data || [];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Submissions" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <FileCheck2 size={22} color="var(--text-primary)" strokeWidth={2.2} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Submissions</h2>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by trainee name, ID, or module title..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', font: '13px inherit', outline: 'none' }} />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ minWidth: '150px', padding: '10px 28px 10px 12px', border: '1px solid var(--border)', borderRadius: '7px', background: '#fff', font: '13px inherit', outline: 'none' }}>
              {['All Status', 'Submitted', 'Graded'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && submissions.length === 0} emptyMessage="No submissions found.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Trainee', 'Module / Activity', 'Submitted', 'File', 'Status', 'Score', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 8px', fontSize: '11px', color: 'var(--text-primary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const sc = STATUS_COLORS[s.status] || STATUS_COLORS.Submitted;
                    return (
                      <tr key={s._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={cell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={14} color="var(--text-secondary)" />
                            <div>
                              <div style={{ fontWeight: 600 }}>{s.studentId?.name || 'Unknown'}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>{s.studentId?.studentId}</div>
                            </div>
                          </div>
                        </td>
                        <td style={cell}>{s.moduleId?.title || s.activityId?.title || '—'}</td>
                        <td style={cell}>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td style={cell}>
                          {s.fileUrl ? (
                            <a href={`${FILE_HOST}${s.fileUrl}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--maroon)', fontWeight: 600, textDecoration: 'none' }}>
                              <FileDown size={13} /> File
                            </a>
                          ) : '—'}
                        </td>
                        <td style={cell}><span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{s.status}</span></td>
                        <td style={cell}>{s.status === 'Graded' ? `${s.score}/${s.totalPoints}` : '—'}</td>
                        <td style={cell}>
                          <button onClick={() => setGradeTarget(s)} style={{ padding: '6px 14px', borderRadius: '7px', border: '1.5px solid var(--maroon)', background: 'transparent', color: 'var(--maroon)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {s.status === 'Graded' ? 'Review' : 'Grade'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </section>
      </main>

      {gradeTarget && (
        <GradeModal submission={gradeTarget} onClose={() => setGradeTarget(null)} onSaved={() => { setGradeTarget(null); refetch(); }} />
      )}
    </div>
  );
}

const cell = { padding: '12px 8px', fontSize: '12.5px', color: 'var(--text-primary)', verticalAlign: 'top' };

function GradeModal({ submission, onClose, onSaved }) {
  const totalPoints = submission.totalPoints || submission.moduleId?.totalPoints || 100;
  const [score, setScore] = useState(submission.score ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numScore = Number(score);
    if (score === '' || Number.isNaN(numScore) || numScore < 0 || numScore > totalPoints) {
      setError(`Score must be a number between 0 and ${totalPoints}.`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submissionsApi.grade(submission._id, { score: numScore, totalPoints, feedback });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save grade.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Grade Submission</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: '18px', padding: '14px', background: 'var(--bg)', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{submission.studentId?.name}</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{submission.moduleId?.title || submission.activityId?.title}</p>
          {submission.comment && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-primary)', fontStyle: 'italic' }}>"{submission.comment}"</p>}
          {submission.fileUrl && (
            <a href={`${FILE_HOST}${submission.fileUrl}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12px', color: 'var(--maroon)', fontWeight: 700, textDecoration: 'none' }}>
              <FileDown size={13} /> View submitted file
            </a>
          )}
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
            Score (out of {totalPoints})
            <input type="number" min="0" max={totalPoints} value={score} onChange={e => setScore(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
            Feedback
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} style={{ minHeight: '90px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : 'Submit Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
