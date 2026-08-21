import React from 'react';
import { AlertCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import NotConnectedBanner from '../components/NotConnectedBanner';

export default function MedicallyUnfit() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Medically Unfit Trainees" showBreadcrumb={true} />

      <main style={{ padding: '24px' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '28px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
          <div style={{
            background: 'var(--orange-banner)', border: '1px solid var(--orange-border)',
            borderRadius: 'var(--radius-sm)', padding: '16px 20px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--orange-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--orange-text)', lineHeight: 1.5 }}>
              Medically unfit trainees would undergo Modular Distance Learning (MDL) instead of in-person training.
            </p>
          </div>

          <NotConnectedBanner text="Medical fitness status is not yet a field tracked by the backend (Student/Cadet records have no 'medically unfit' flag). This page is kept reachable for future use, but no live data is shown here." />

          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '14px', fontWeight: 500 }}>No medically unfit records available.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
