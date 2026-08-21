import React from 'react';
import { Info } from 'lucide-react';

/**
 * Honest placeholder for screens that have no corresponding backend concept
 * yet (no DB collection / endpoint). Used instead of faking data.
 */
export default function NotConnectedBanner({ text = 'This feature is not yet connected to a backend data source.' }) {
  return (
    <div style={{
      background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)',
      padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <Info size={18} color="#2563EB" style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', fontWeight: 500, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}
