import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Bell, Home, Check, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../api/notifications';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TopBar({ title = 'Dashboard', showBreadcrumb = false }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.listMine({ limit: 10 });
      setItems(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Silent — the bell just stays quiet if this fails.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleToggle = () => {
    setOpen((v) => !v);
    if (!open) loadNotifications();
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setItems((cur) => cur.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((cur) => cur.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <header style={{
      height: '72px', background: 'var(--card-bg)', borderRadius: 'var(--radius)',
      margin: '20px 24px 0', padding: '0 28px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {showBreadcrumb ? (
          <>
            <Home size={16} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>Dashboard</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{title}</span>
          </>
        ) : (
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Home size={20} color="var(--maroon-dark)" strokeWidth={2.5} />{title}
          </h2>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
          <Calendar size={18} strokeWidth={1.8} />
          <span>{dateStr}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{timeStr}</span>
        </div>

        <div style={{ position: 'relative' }} ref={ref}>
          <button onClick={handleToggle} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
            borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Bell size={22} color="var(--text-secondary)" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '4px', right: '4px', minWidth: '15px', height: '15px', padding: '0 3px',
                background: 'var(--red-status)', borderRadius: '9px', border: '2px solid #fff',
                fontSize: '9px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: '48px', width: '340px', maxHeight: '420px',
              background: '#fff', borderRadius: '14px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
              overflow: 'hidden', zIndex: 200, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '14px' }}>Notifications</strong>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 0, background: 'none', color: 'var(--maroon)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loading && items.length === 0 && (
                  <p style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>Loading...</p>
                )}
                {!loading && items.length === 0 && (
                  <p style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No notifications yet.</p>
                )}
                {items.map((n) => (
                  <div key={n._id} style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border)',
                    background: n.isRead ? '#fff' : '#FFF8F0', display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</p>
                      {n.message && <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</p>}
                      <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: 'var(--text-secondary)' }}>{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button onClick={() => handleMarkRead(n._id)} aria-label="Mark as read" style={{ border: 0, background: 'none', color: 'var(--maroon)', cursor: 'pointer', flexShrink: 0, padding: '2px' }}>
                        <Check size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
