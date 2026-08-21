import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Reusable confirmation modal for destructive actions. Controlled component:
 * render it always, gate visibility with `open`.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '28px',
          width: 'min(420px, 100%)', boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            background: danger ? '#FEF2F2' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color={danger ? '#DC2626' : 'var(--orange-text)'} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
            {message && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {message}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)',
              background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: danger ? '#DC2626' : 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
