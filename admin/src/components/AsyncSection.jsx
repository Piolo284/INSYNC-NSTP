import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

/**
 * Shared loading / error / empty wrapper for data-fetching pages. Pass the
 * result of useApi() plus an `isEmpty` check; renders children only once
 * data has actually arrived.
 */
export default function AsyncSection({
  loading,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage = 'No records found.',
  children,
  minHeight = '200px',
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, gap: '10px', color: 'var(--text-secondary)' }}>
        <Loader2 size={26} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Loading...</span>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, gap: '10px', color: '#DC2626', textAlign: 'center', padding: '20px' }}>
        <AlertCircle size={26} />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ marginTop: '4px', padding: '8px 18px', borderRadius: '8px', border: '1px solid #DC2626', background: '#fff', color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, gap: '10px', color: 'var(--text-secondary)' }}>
        <Inbox size={26} />
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{emptyMessage}</span>
      </div>
    );
  }

  return children;
}
