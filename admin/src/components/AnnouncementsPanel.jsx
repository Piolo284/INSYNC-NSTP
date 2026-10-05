import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ChevronRight, Calendar } from 'lucide-react';

// Cycled per card — no per-announcement image exists, so a solid color
// banner with the megaphone mark stands in for one.
const BANNER_COLORS = ['#1E293B', '#B08968', '#0F766E'];

/** A real tag derived from fields that actually exist — never a fabricated
 * label. "New" for anything posted in the last 48h, "Important" for a
 * pinned announcement, otherwise the program it targets. */
function tagFor(a) {
  const ageMs = Date.now() - new Date(a.createdAt).getTime();
  if (ageMs < 48 * 3600 * 1000) return { label: 'New', bg: '#FEE2E2', color: '#DC2626' };
  if (a.isPinned) return { label: 'Important', bg: '#FEF3C7', color: '#B45309' };
  return { label: a.program, bg: '#F3F4F6', color: 'var(--text-secondary)' };
}

export default function AnnouncementsPanel({ announcements }) {
  const navigate = useNavigate();

  return (
    <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Megaphone size={18} color="#DC2626" />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Announcements</h3>
        </div>
        <button
          onClick={() => navigate('/announcements')}
          style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          View All <ChevronRight size={14} />
        </button>
      </div>

      {announcements.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>No announcements yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {announcements.map((a, i) => {
            const tag = tagFor(a);
            return (
              <div key={a._id} style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ position: 'relative', height: '64px', background: BANNER_COLORS[i % BANNER_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={26} color="rgba(255,255,255,0.85)" />
                  <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: tag.bg, color: tag.color }}>
                    {tag.label}
                  </span>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</h4>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.content}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <Calendar size={12} />
                    {new Date(a.date || a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
