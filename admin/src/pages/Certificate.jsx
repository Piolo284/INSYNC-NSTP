import React from 'react';
import { Award } from 'lucide-react';
import TopBar from '../components/TopBar';
import NotConnectedBanner from '../components/NotConnectedBanner';

export default function Certificate() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Certificate Request" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '24px', minHeight: '560px' }}>
          <NotConnectedBanner text="Certificate requests are not yet a backend concept in this system (there is no certificate-request collection or endpoint). This page is kept reachable for future use, but no live data is shown here." />
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
            <Award size={32} />
            <p style={{ margin: '12px 0 0', fontSize: '14px', fontWeight: 500 }}>No certificate requests available.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
