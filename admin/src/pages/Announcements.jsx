import React, { useCallback, useState } from 'react';
import { CalendarDays, ChevronDown, Megaphone, Plus, Users, Pin, Trash2, Pencil, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';
import AsyncSection from '../components/AsyncSection';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi, errorMessage } from '../hooks/useApi';
import { announcementsApi } from '../api/announcements';
import { resolveFileUrl } from '../api/client';
import { announcementTemplatesApi } from '../api/announcementTemplates';
import { composeAnnouncementImage, canvasToPngFile } from '../utils/announcementGenerator';
import { useAuth } from '../context/AuthContext';

const ICONS = { CWTS: Users, ROTC: CalendarDays, All: Megaphone };
const STATUS_OPTIONS = ['Published', 'Draft', 'Archived'];
const CAMPUS_OPTIONS = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];

export default function Announcements() {
  const { isSuperAdmin, currentUser } = useAuth();
  const [programTab, setProgramTab] = useState('All');
  const [status, setStatus] = useState('Published');
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal] = useState(null); // 'create' | announcement object for edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetcher = useCallback(async () => {
    const params = { status, limit: 100 };
    if (isSuperAdmin && programTab !== 'All') params.program = programTab;
    const res = await announcementsApi.list(params);
    return res.data || [];
  }, [isSuperAdmin, programTab, status]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const visible = data || [];

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await announcementsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      window.alert(errorMessage(err, 'Unable to delete announcement.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Announcements" />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', minHeight: '560px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px', padding: '0 16px' }}>
            {isSuperAdmin ? (
              <div style={{ display: 'flex' }}>
                {['All', 'CWTS', 'ROTC'].map(tab => <TabButton key={tab} label={tab} isActive={programTab === tab} onClick={() => setProgramTab(tab)} />)}
              </div>
            ) : <div />}
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 30px 8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ padding: '12px 24px', flex: 1 }}>
            <AsyncSection
              loading={loading}
              error={error}
              onRetry={refetch}
              isEmpty={!loading && !error && visible.length === 0}
              emptyMessage="No announcements found."
              minHeight="240px"
            >
              {visible.map(item => {
                const Icon = ICONS[item.program] || Megaphone;
                const expanded = expandedId === item._id;
                const canManage = isSuperAdmin || item.program === currentUser?.program;
                return (
                  <article key={item._id} style={{ padding: '16px 20px', marginBottom: '12px', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                      <Icon size={24} color="var(--maroon)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.isPinned && <Pin size={12} color="var(--maroon)" />}
                          <h3 style={{ margin: 0, fontSize: '14px' }}>{item.title}</h3>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#F3F4F6', color: 'var(--text-secondary)' }}>{item.program} · {item.targetAudience}</span>
                          {item.campus && item.campus !== 'All' && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB' }}>{item.campus}</span>
                          )}
                          {item.expiresAt && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#FFF7ED', color: '#D97706' }}>
                              Expires {new Date(item.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '11px' }}>Posted: {new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      {canManage && (
                        <>
                          <button aria-label="Edit" onClick={() => setModal(item)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Pencil size={15} /></button>
                          <button aria-label="Delete" onClick={() => setDeleteTarget(item)} style={{ border: 0, background: 'none', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={15} /></button>
                        </>
                      )}
                      <button aria-label={expanded ? 'Collapse' : `Expand ${item.title}`} onClick={() => setExpandedId(expanded ? null : item._id)} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    {expanded && (
                      <div style={{ margin: '14px 0 0', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                        {item.imageUrl && (
                          <img
                            src={resolveFileUrl(item.imageUrl)}
                            alt="Announcement poster"
                            style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border)' }}
                          />
                        )}
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.content}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </AsyncSection>
          </div>
          <button onClick={() => setModal('create')} style={{ alignSelf: 'center', width: 'min(420px, calc(100% - 48px))', margin: '20px 24px 28px', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}><Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />New Announcement</button>
        </section>
      </main>

      {modal && (
        <AnnouncementModal
          announcement={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this announcement?"
        message={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/**
 * Auto-composes a poster image from this program's AnnouncementTemplate (if
 * one is configured) using the announcement's own field values — mirrors
 * Certificate.jsx's ReviewModal doing the same for certificate requests.
 * Never throws: posting an announcement must never fail just because poster
 * generation hit a snag (no template configured, image failed to load,
 * etc.) — it just silently falls back to no image, same as before this
 * feature existed.
 */
async function tryGeneratePoster(program, announcementFields, currentUserName) {
  if (program !== 'CWTS' && program !== 'ROTC') return undefined;
  try {
    const res = await announcementTemplatesApi.get(program);
    const template = res.data;
    if (!template || !template.imageUrl || !template.fields?.length) return undefined;
    const canvas = await composeAnnouncementImage(announcementFields, template, currentUserName);
    return await canvasToPngFile(canvas, `${announcementFields.title.replace(/[^a-z0-9]+/gi, '-')}-poster.png`);
  } catch {
    return undefined;
  }
}

function AnnouncementModal({ announcement, onClose, onSaved }) {
  const { isSuperAdmin, currentUser } = useAuth();
  const isEdit = Boolean(announcement);
  const ownProgram = currentUser?.program;

  const [form, setForm] = useState({
    title: announcement?.title || '',
    content: announcement?.content || '',
    program: announcement?.program || (isSuperAdmin ? 'All' : ownProgram),
    targetAudience: announcement?.targetAudience || 'All',
    campus: announcement?.campus || 'All',
    // <input type="date"> needs YYYY-MM-DD; the API gives back a full ISO
    // timestamp, so trim it down.
    expiresAt: announcement?.expiresAt ? announcement.expiresAt.slice(0, 10) : '',
    date: announcement?.date ? announcement.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    time: announcement?.time || '',
    location: announcement?.location || '',
    isPinned: announcement?.isPinned || false,
    status: announcement?.status || 'Published',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const audienceOptions = ['All'];
  if (form.program !== 'ROTC') audienceOptions.push('Students');
  if (form.program !== 'CWTS') audienceOptions.push('Cadets');
  audienceOptions.push('Officers');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and message are both required.');
      return;
    }
    if (form.expiresAt && new Date(form.expiresAt) <= new Date()) {
      setError('Expiry date must be in the future.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        targetAudience: form.targetAudience,
        campus: form.campus,
        expiresAt: form.expiresAt || '',
        date: form.date,
        time: form.time,
        location: form.location,
        isPinned: form.isPinned,
        status: form.status,
        ...(isSuperAdmin ? { program: form.program } : {}),
      };

      const effectiveProgram = isSuperAdmin ? form.program : ownProgram;
      const file = await tryGeneratePoster(effectiveProgram, payload, currentUser?.name);

      if (isEdit) await announcementsApi.update(announcement._id, payload, file);
      else await announcementsApi.create(payload, file);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save announcement.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{isEdit ? 'Edit Announcement' : 'New Announcement'}</h3>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <Field label="Title"><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Enter announcement title" /></Field>
          {isSuperAdmin && (
            <Field label="Program"><select value={form.program} onChange={e => update('program', e.target.value)}><option value="All">All (CWTS + ROTC)</option><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
          )}
          <Field label="Target Audience"><select value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)}>{audienceOptions.map(a => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label="Campus">
            <select value={form.campus} onChange={e => update('campus', e.target.value)}>
              <option value="All">All Campuses</option>
              {CAMPUS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Message"><textarea value={form.content} onChange={e => update('content', e.target.value)} placeholder="Type your message here..." /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Date"><input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
            <Field label="Time (optional)"><input type="time" value={form.time} onChange={e => update('time', e.target.value)} /></Field>
          </div>
          <Field label="Location (optional)"><input value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. MARSU Gymnasium" /></Field>
          <Field label="Expires On (optional)">
            <input type="date" value={form.expiresAt} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={e => update('expiresAt', e.target.value)} />
          </Field>
          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>Leave blank for an announcement that never expires. Once the date passes, it's automatically removed from the system.</p>
          <Field label="Status"><select value={form.status} onChange={e => update('status', e.target.value)}><option value="Published">Published</option><option value="Draft">Draft</option><option value="Archived">Archived</option></select></Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <input type="checkbox" checked={form.isPinned} onChange={e => update('isPinned', e.target.checked)} /> Pin this announcement
          </label>
          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            If an Announcement Template is set up for this program, a poster image is generated automatically from
            the fields above — no manual attachment needed.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700 }}>{label}{React.cloneElement(children, { style: { width: '100%', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-primary)', font: '13px inherit', outline: 'none', ...(children.props.style || {}), ...(children.type === 'textarea' ? { minHeight: '112px', resize: 'vertical' } : {}) } })}</label>;
}
