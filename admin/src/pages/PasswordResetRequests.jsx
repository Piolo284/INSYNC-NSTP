import React, { useCallback, useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, ChevronDown, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { passwordResetApi } from '../api/passwordReset';

const STATUS_COLORS = {
  Pending: { bg: '#FFF7ED', color: '#D97706' },
  Approved: { bg: '#ECFDF5', color: '#059669' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626' },
};

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

export default function PasswordResetRequests() {
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [reviewTarget, setReviewTarget] = useState(null); // { request, decision: 'Approved'|'Rejected' }

  const fetcher = useCallback(async () => {
    const params = {};
    if (statusFilter !== 'All Status') params.status = statusFilter;
    const res = await passwordResetApi.list(params);
    return res.data || [];
  }, [statusFilter]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const requests = data || [];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Password Reset Requests" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <KeyRound size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Password Reset Requests</h2>
            </div>
            <CustomSelect value={statusFilter} onChange={setStatusFilter} options={['All Status', 'Pending', 'Approved', 'Rejected']} />
          </div>

          <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Verify the trainee's identity yourself (student ID, contact info, or in person) before approving. Approving generates a one-time reset code and emails it to the address on file — it is never shown here once delivered.
          </p>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && requests.length === 0}
            emptyMessage="No password reset requests found."
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              {requests.map((r) => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.Pending;
                const user = r.userId || {};
                return (
                  <div key={r._id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', boxShadow: 'var(--shadow)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{user.name || 'Unknown user'}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{r.status}</span>
                        {user.role && (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{user.role}</span>
                        )}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {user.studentId || '—'} · {r.email}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-primary)' }}>Reason: {r.reason}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Requested {new Date(r.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {r.status !== 'Pending' && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {r.status} by {r.reviewedBy?.name || 'system'}{r.reviewNote ? ` — ${r.reviewNote}` : ''}
                        </p>
                      )}
                    </div>
                    {r.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setReviewTarget({ request: r, decision: 'Approved' })} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #059669', background: 'transparent', color: '#059669', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <CheckCircle2 size={15} /> Approve
                        </button>
                        <button onClick={() => setReviewTarget({ request: r, decision: 'Rejected' })} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #DC2626', background: 'transparent', color: '#DC2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <XCircle size={15} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AsyncSection>
        </section>
      </main>

      {reviewTarget && (
        <ReviewModal
          request={reviewTarget.request}
          decision={reviewTarget.decision}
          onClose={() => setReviewTarget(null)}
          onDone={() => { setReviewTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

function ReviewModal({ request, decision, onClose, onDone }) {
  const isApprove = decision === 'Approved';
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = isApprove
        ? await passwordResetApi.approve(request._id, reviewNote)
        : await passwordResetApi.reject(request._id, reviewNote);
      if (isApprove) {
        setResult(res.message);
      } else {
        onDone();
      }
    } catch (err) {
      setError(errorMessage(err, 'Unable to save the decision.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={result ? onDone : onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(460px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
            {isApprove ? 'Approve' : 'Reject'} request from {request.userId?.name || 'this user'}
          </h3>
          <button onClick={result ? onDone : onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {result ? (
          <div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{result}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={onDone} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Requested reason: "{request.reason}"
              {isApprove
                ? ' — approving emails a one-time reset code to ' + request.email + '.'
                : ''}
            </p>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{error}</div>}

            <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isApprove ? 'Verification note (optional)' : 'Reason for rejection'}
              <textarea
                required={!isApprove}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={isApprove ? 'e.g. Verified via Student ID and phone call.' : 'Let the student know why this was rejected.'}
                style={{ width: '100%', minHeight: '80px', resize: 'vertical', border: '1px solid var(--border)', borderRadius: '7px', padding: '10px 12px', fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: isApprove ? '#059669' : '#DC2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Saving...' : isApprove ? 'Approve & Send Code' : 'Reject'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
