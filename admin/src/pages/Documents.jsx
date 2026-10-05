import React, { useCallback, useMemo, useState } from 'react';
import { FolderOpen, Search, FileDown, CheckCircle2, XCircle, X, ChevronDown, AlertCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { documentsApi } from '../api/documents';
import { useApi, errorMessage } from '../hooks/useApi';
import { resolveFileUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  Uploaded: { bg: '#EFF6FF', color: '#2563EB' },
  'Under Review': { bg: '#FFF7ED', color: '#D97706' },
  'Awaiting Approval': { bg: '#F3F4F6', color: '#6B7280' },
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
          border: '1px solid var(--border)', background: '#fff', fontSize: '13px',
          fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit',
          cursor: 'pointer', appearance: 'none', outline: 'none',
        }}
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
    </div>
  );
}

/** Groups the flat document list (one row per document) into one entry per
 * trainee, since a person needing 6 requirements is really one unit of work
 * for whoever's reviewing — not 6 unrelated rows. */
function groupByTrainee(docs) {
  const map = new Map();
  for (const d of docs) {
    const key = d.ownerId;
    if (!map.has(key)) {
      map.set(key, {
        ownerId: key,
        ownerName: d.ownerName || 'Unknown trainee',
        ownerIdNumber: d.ownerIdNumber || '',
        ownerProgram: d.ownerProgram || '',
        docs: [],
      });
    }
    map.get(key).docs.push(d);
  }
  return [...map.values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}

export default function Documents() {
  const { isSuperAdmin, currentUser } = useAuth();
  const [programFilter, setProgramFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [modalTrainee, setModalTrainee] = useState(null);

  const fetcher = useCallback(async () => {
    const params = {};
    if (isSuperAdmin && programFilter !== 'All') params.program = programFilter;
    const res = await documentsApi.listForReview(params);
    return res.data || [];
  }, [isSuperAdmin, programFilter]);

  const { data, loading, error, refetch, setData } = useApi(fetcher, [fetcher]);
  const docs = data || [];

  const trainees = useMemo(() => {
    let grouped = groupByTrainee(docs);
    if (needsReviewOnly) {
      grouped = grouped.filter((t) => t.docs.some((d) => d.status === 'Under Review'));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      grouped = grouped.filter(
        (t) => t.ownerName.toLowerCase().includes(q) || t.ownerIdNumber.toLowerCase().includes(q)
      );
    }
    return grouped;
  }, [docs, needsReviewOnly, search]);

  const totalNeedsReview = useMemo(() => docs.filter((d) => d.status === 'Under Review').length, [docs]);

  // Applies a review decision locally so every open view (the modal, the
  // table's badge counts) reflects it immediately, without a full refetch.
  // The API response doesn't populate reviewedBy with a name (only the list
  // endpoint does) — but the reviewer is always the person clicking the
  // button, so currentUser stands in for it here.
  const applyLocalReview = (docId, status) => {
    const patch = { status, reviewedBy: { name: currentUser?.name || 'You' }, reviewedAt: new Date().toISOString() };
    setData((cur) => (cur || []).map((d) => (d._id === docId ? { ...d, ...patch } : d)));
    setModalTrainee((cur) =>
      cur ? { ...cur, docs: cur.docs.map((d) => (d._id === docId ? { ...d, ...patch } : d)) } : cur
    );
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Documents" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={20} color="var(--text-primary)" />
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Trainee Document Requirements</h2>
            </div>
            {totalNeedsReview > 0 && (
              <button
                onClick={() => setNeedsReviewOnly((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px',
                  border: needsReviewOnly ? 'none' : '1px solid #FED7AA', background: needsReviewOnly ? '#D97706' : '#FFF7ED',
                  color: needsReviewOnly ? '#fff' : '#9A3412', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <AlertCircle size={13} /> {totalNeedsReview} need{totalNeedsReview === 1 ? 's' : ''} review
              </button>
            )}
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Every trainee's uploaded requirement documents, grouped one row per person — click a row to review their individual files.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: '320px', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or Student/Cadet ID..."
                style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
              />
            </div>
            {isSuperAdmin && (
              <CustomSelect
                value={programFilter}
                onChange={setProgramFilter}
                options={[
                  { value: 'All', label: 'All Programs' },
                  { value: 'CWTS', label: 'CWTS' },
                  { value: 'ROTC', label: 'ROTC' },
                ]}
              />
            )}
          </div>

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && trainees.length === 0}
            emptyMessage={search || needsReviewOnly ? 'No matching trainees.' : 'No document requirements on file yet.'}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {['Trainee', 'ID', 'Program', 'Uploaded', 'Needs Review', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trainees.map((t) => {
                    const uploadedCount = t.docs.filter((d) => d.isUploaded).length;
                    const needsReviewCount = t.docs.filter((d) => d.status === 'Under Review').length;
                    return (
                      <tr
                        key={t.ownerId}
                        onClick={() => setModalTrainee(t)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}>{t.ownerName}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{t.ownerIdNumber}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{t.ownerProgram}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{uploadedCount} / {t.docs.length}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {needsReviewCount > 0 ? (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: '#FFF7ED', color: '#D97706' }}>{needsReviewCount} pending</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModalTrainee(t); }}
                            style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            View
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

      {modalTrainee && (
        <TraineeDocumentsModal
          trainee={modalTrainee}
          canReview={!isSuperAdmin}
          onClose={() => setModalTrainee(null)}
          onReviewed={applyLocalReview}
        />
      )}
    </div>
  );
}

function TraineeDocumentsModal({ trainee, canReview, onClose, onReviewed }) {
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const handleReview = async (docId, status) => {
    setBusyId(docId);
    setActionError('');
    try {
      await documentsApi.review(docId, status);
      onReviewed(docId, status);
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to update document status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{trainee.ownerName}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{trainee.ownerIdNumber} · {trainee.ownerProgram}</p>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {actionError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '14px' }}>{actionError}</div>}

        <div style={{ display: 'grid', gap: '10px' }}>
          {trainee.docs.map((d) => {
            const sc = STATUS_COLORS[d.status] || STATUS_COLORS['Awaiting Approval'];
            const isDecided = d.status === 'Approved' || d.status === 'Rejected';
            return (
              <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '13px' }}>{d.title}</strong>
                  {d.fileUrl && (
                    <a href={resolveFileUrl(d.fileUrl)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11.5px', color: 'var(--maroon)', fontWeight: 600, textDecoration: 'none' }}>
                      <FileDown size={12} /> {d.fileName}
                    </a>
                  )}
                  {isDecided && d.reviewedBy && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {d.status === 'Approved' ? 'Approved' : 'Rejected'} by {d.reviewedBy.name}
                      {d.reviewedAt ? ` · ${new Date(d.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>{d.status}</span>
                {canReview && d.isUploaded && !isDecided && (
                  <>
                    <button disabled={busyId === d._id} onClick={() => handleReview(d._id, 'Approved')} aria-label="Approve" style={{ border: 0, background: 'none', color: '#059669', cursor: 'pointer' }}><CheckCircle2 size={18} /></button>
                    <button disabled={busyId === d._id} onClick={() => handleReview(d._id, 'Rejected')} aria-label="Reject" style={{ border: 0, background: 'none', color: '#DC2626', cursor: 'pointer' }}><XCircle size={18} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
