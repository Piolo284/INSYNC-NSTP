import React, { useState } from 'react';
import { FolderOpen, Search, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import NotConnectedBanner from '../components/NotConnectedBanner';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { documentsApi } from '../api/documents';
import { errorMessage } from '../hooks/useApi';
import { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

const FILE_HOST = BASE_URL.replace(/\/api\/?$/, '');

const STATUS_COLORS = {
  Uploaded: { bg: '#EFF6FF', color: '#2563EB' },
  'Under Review': { bg: '#FFF7ED', color: '#D97706' },
  'Awaiting Approval': { bg: '#FFF7ED', color: '#D97706' },
  Approved: { bg: '#ECFDF5', color: '#059669' },
  Rejected: { bg: '#FEF2F2', color: '#DC2626' },
  Missing: { bg: '#F3F4F6', color: '#6B7280' },
};

export default function Documents() {
  const { effectiveProgram } = useAuth();
  const [query, setQuery] = useState('');
  const [trainee, setTrainee] = useState(null);
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setTrainee(null);
    setDocs(null);
    try {
      let profile = null;
      if (effectiveProgram !== 'ROTC') {
        try {
          const res = await studentsApi.get(query.trim());
          profile = { ...res.data, kind: 'student' };
        } catch {
          // fall through to cadet lookup
        }
      }
      if (!profile && effectiveProgram !== 'CWTS') {
        try {
          const res = await cadetsApi.get(query.trim());
          profile = { ...res.data, kind: 'cadet' };
        } catch {
          // not found either
        }
      }
      if (!profile) {
        setError('No student or cadet found with that ID.');
        setLoading(false);
        return;
      }
      setTrainee(profile);
      const userId = profile.userId?._id || profile.userId;
      const docsRes = await documentsApi.listForUser(userId);
      setDocs(docsRes.data || []);
    } catch (err) {
      setError(errorMessage(err, 'Unable to look up trainee documents.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (docId, status) => {
    setBusyId(docId);
    try {
      await documentsApi.review(docId, status);
      setDocs((cur) => cur.map((d) => (d._id === docId ? { ...d, status } : d)));
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to update document status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Documents" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <FolderOpen size={20} color="var(--text-primary)" />
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Trainee Document Requirements</h2>
          </div>

          <NotConnectedBanner text="There is no global document list endpoint — look up one trainee at a time by their Student/Cadet ID to review their uploaded requirements." />

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px', maxWidth: '480px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter Student ID or Cadet ID..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px', maxWidth: '480px' }}>{error}</div>}

          {trainee && (
            <div style={{ marginBottom: '18px' }}>
              <strong style={{ fontSize: '14px' }}>{trainee.fullName}</strong>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{trainee.studentId || trainee.cadetId} · {trainee.program}</span>
            </div>
          )}

          {docs && (
            docs.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No document requirements on file for this trainee.</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {docs.map((d) => {
                  const sc = STATUS_COLORS[d.status] || STATUS_COLORS.Missing;
                  return (
                    <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '13px' }}>{d.title}</strong>
                        {d.fileUrl && (
                          <a href={`${FILE_HOST}${d.fileUrl}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11.5px', color: 'var(--maroon)', fontWeight: 600, textDecoration: 'none' }}>
                            <FileDown size={12} /> {d.fileName}
                          </a>
                        )}
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: sc.bg, color: sc.color }}>{d.status}</span>
                      {d.isUploaded && d.status !== 'Approved' && d.status !== 'Rejected' && (
                        <>
                          <button disabled={busyId === d._id} onClick={() => handleReview(d._id, 'Approved')} aria-label="Approve" style={{ border: 0, background: 'none', color: '#059669', cursor: 'pointer' }}><CheckCircle2 size={18} /></button>
                          <button disabled={busyId === d._id} onClick={() => handleReview(d._id, 'Rejected')} aria-label="Reject" style={{ border: 0, background: 'none', color: '#DC2626', cursor: 'pointer' }}><XCircle size={18} /></button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
}
