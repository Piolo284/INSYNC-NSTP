import React, { useCallback, useEffect, useState } from 'react';
import { Award, FileDown, CheckCircle2, CheckCheck, XCircle, ChevronDown, X, Wand2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { certificateRequestsApi } from '../api/certificateRequests';
import { certificateTemplatesApi } from '../api/certificateTemplates';
import { composeCertificateForRequest, canvasToPngFile } from '../utils/certificateGenerator';
import { resolveFileUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

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

export default function Certificate() {
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [reviewTarget, setReviewTarget] = useState(null); // { request, decision: 'Approved'|'Rejected' }
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  const fetcher = useCallback(async () => {
    const params = {};
    if (statusFilter !== 'All Status') params.status = statusFilter;
    if (effectiveProgram) params.program = effectiveProgram;
    const res = await certificateRequestsApi.list(params);
    return res.data || [];
  }, [statusFilter, effectiveProgram]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const requests = data || [];
  const pendingRequests = requests.filter((r) => r.status === 'Pending');

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Certificate Request" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Certificate Requests</h2>
              {isSuperAdmin && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{effectiveProgram || 'All Programs'}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {pendingRequests.length > 0 && (
                <button
                  onClick={() => setConfirmApproveAll(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <CheckCheck size={15} /> Approve All ({pendingRequests.length})
                </button>
              )}
              <CustomSelect value={statusFilter} onChange={setStatusFilter} options={['All Status', 'Pending', 'Approved', 'Rejected']} />
            </div>
          </div>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && requests.length === 0}
            emptyMessage="No certificate requests found."
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              {requests.map((r) => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.Pending;
                const student = r.studentId || {};
                return (
                  <div key={r._id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', boxShadow: 'var(--shadow)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px' }}>{r.type}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{r.status}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{r.program}</span>
                        {r.eligibility && (
                          <span
                            title={r.eligibility.eligible ? 'Meets the standard grade/attendance eligibility check.' : r.eligibility.reasons.join(' ')}
                            style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                              background: r.eligibility.eligible ? '#ECFDF5' : '#FFF7ED',
                              color: r.eligibility.eligible ? '#059669' : '#D97706',
                            }}
                          >
                            {r.eligibility.eligible ? 'Eligible' : 'Needs review'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {student.name || 'Trainee'} · {student.studentId || '—'} · {student.email || '—'}
                      </p>
                      {r.purpose && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Purpose: {r.purpose}</p>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Requested {new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {r.reviewNote && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Note: {r.reviewNote}</p>
                      )}
                      {r.certificateUrl && (
                        <a href={resolveFileUrl(r.certificateUrl)} target="_blank" rel="noreferrer" style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--maroon)', fontWeight: 600, textDecoration: 'none' }}>
                          <FileDown size={13} /> {r.certificateName || 'Issued certificate'}
                        </a>
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

      {confirmApproveAll && (
        <ApproveAllModal
          requests={pendingRequests}
          onClose={() => setConfirmApproveAll(false)}
          onDone={() => { setConfirmApproveAll(false); refetch(); }}
        />
      )}
    </div>
  );
}

function ApproveAllModal({ requests, onClose, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const programs = [...new Set(requests.map((r) => r.program))];

  const handleConfirm = async () => {
    setError('');
    setSubmitting(true);
    setProgress(0);
    try {
      const templates = {};
      await Promise.all(programs.map(async (p) => {
        try {
          const res = await certificateTemplatesApi.get(p);
          templates[p] = res.data && res.data.imageUrl && res.data.fields?.length ? res.data : null;
        } catch {
          templates[p] = null;
        }
      }));

      let failed = 0;
      for (const r of requests) {
        try {
          const template = templates[r.program];
          let file;
          if (template) {
            const canvas = await composeCertificateForRequest(r, template);
            file = await canvasToPngFile(canvas, `${r.type.replace(/[^a-z0-9]+/gi, '-')}-${r.studentId?.studentId || r._id}.png`);
          }
          await certificateRequestsApi.review(r._id, { status: 'Approved', file });
        } catch {
          failed += 1;
        } finally {
          setProgress((p) => p + 1);
        }
      }
      if (failed > 0) {
        setError(`${failed} of ${requests.length} request(s) could not be approved. The rest were approved — you can retry the failed ones individually.`);
        setSubmitting(false);
        return;
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Unable to approve these requests.'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={submitting ? undefined : onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(440px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Approve all pending requests?</h3>
          {!submitting && (
            <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
          )}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          This will approve <strong>{requests.length}</strong> pending certificate {requests.length === 1 ? 'request' : 'requests'}. A certificate will be generated automatically for any program with a template set up — the rest are approved with no file attached. No review note will be added. This can't be undone in bulk.
        </p>
        {submitting && (
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Processing {progress} of {requests.length}...</p>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginTop: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button type="button" disabled={submitting} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>Cancel</button>
          <button type="button" disabled={submitting} onClick={handleConfirm} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Approving...' : `Approve ${requests.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ request, decision, onClose, onDone }) {
  const isApprove = decision === 'Approved';
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 'loading' | 'none' | 'ready' — whether this program has a usable
  // template (an image with at least one field placed).
  const [templateState, setTemplateState] = useState(isApprove ? 'loading' : 'none');
  const [template, setTemplate] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!isApprove) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await certificateTemplatesApi.get(request.program);
        if (cancelled) return;
        const t = res.data;
        if (t && t.imageUrl && t.fields?.length) {
          setTemplate(t);
          setTemplateState('ready');
        } else {
          setTemplateState('none');
        }
      } catch {
        if (!cancelled) setTemplateState('none');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (templateState !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        setPreviewError('');
        const canvas = await composeCertificateForRequest(request, template);
        if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        if (!cancelled) setPreviewError(errorMessage(err, 'Could not build a preview.'));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let fileToSend;
      if (isApprove && templateState === 'ready') {
        const canvas = await composeCertificateForRequest(request, template);
        fileToSend = await canvasToPngFile(canvas, `${request.type.replace(/[^a-z0-9]+/gi, '-')}-${request.studentId?.studentId || request._id}.png`);
      }
      await certificateRequestsApi.review(request._id, { status: decision, reviewNote, file: fileToSend });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save the decision.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
            {isApprove ? 'Approve' : 'Reject'} "{request.type}"
          </h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        {isApprove && request.eligibility && !request.eligibility.eligible && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '16px' }}>
            <strong>Eligibility check:</strong> {request.eligibility.reasons.join(' ')} This doesn't block approval — it's just a heads-up before you decide.
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {isApprove && templateState === 'loading' && (
            <div style={{ padding: '40px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
              Checking for a {request.program} certificate template...
            </div>
          )}
          {isApprove && templateState === 'ready' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#059669', marginBottom: '8px' }}>
                <Wand2 size={14} /> Auto-generated from the {request.program} certificate template
              </div>
              {previewError ? (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px' }}>{previewError}</div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Certificate preview" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '8px' }}>Building preview...</div>
              )}
            </div>
          )}
          {isApprove && templateState === 'none' && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '16px' }}>
              No certificate template has been set up for {request.program} yet — approving will not attach a certificate. Set one up in <strong>Certificate Templates</strong> so approvals generate one automatically.
            </div>
          )}
          <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isApprove ? 'Note (optional)' : 'Reason for rejection'}
            <textarea
              required={!isApprove}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={isApprove ? 'e.g. Ready for pickup at the NSTP office.' : 'Let the trainee know why this was rejected.'}
              style={{ width: '100%', minHeight: '80px', resize: 'vertical', border: '1px solid var(--border)', borderRadius: '7px', padding: '10px 12px', fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting || templateState === 'loading'} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: isApprove ? '#059669' : '#DC2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (submitting || templateState === 'loading') ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isApprove ? 'Approve' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
