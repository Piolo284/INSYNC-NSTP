import React, { useState } from 'react';
import { ArrowLeft, Award, Check, Download, FileImage, Send, User, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';

const initialRequests = [
  { id: '1', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
  { id: '2', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
  { id: '3', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
  { id: '4', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
  { id: '5', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
  { id: '6', name: 'Jojo Malangis', studentId: '23BI1431', course: 'BSI/T', year: '2nd Year', program: 'ROTC', requested: 'July 10, 2026', dateRequested: 'July 30, 2026', status: 'Pending', temporaryCertificateSent: false },
];

export default function Certificate() {
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState('Pending');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const updateStatus = (status) => {
    setRequests(current => current.map(request => request.id === selectedRequest.id ? { ...request, status } : request));
    setSelectedRequest(null);
    setActiveTab('Approved');
  };

  const sendTemporaryCertificate = () => {
    setRequests(current => current.map(request => request.id === selectedRequest.id ? { ...request, temporaryCertificateSent: true } : request));
    setSelectedRequest(current => ({ ...current, temporaryCertificateSent: true }));
  };

  if (selectedRequest) {
    return <RequestDetails request={selectedRequest} onBack={() => setSelectedRequest(null)} onUpdate={updateStatus} onSendTemporary={sendTemporaryCertificate} />;
  }

  const visibleRequests = requests.filter(request => request.status === activeTab);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Certificate Request" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', minHeight: '560px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border)' }}>
            {['Pending', 'Approved', 'Rejected'].map(tab => <TabButton key={tab} label={tab} isActive={activeTab === tab} onClick={() => setActiveTab(tab)} />)}
          </div>
          <div style={{ padding: '12px 24px' }}>
            {visibleRequests.length > 0 ? visibleRequests.map(request => <RequestCard key={request.id} request={request} onClick={() => setSelectedRequest(request)} />) : <div style={{ textAlign: 'center', padding: '120px 20px', color: 'var(--text-secondary)' }}><Award size={32} /><p style={{ margin: '12px 0 0', fontSize: '14px' }}>No processed certificate requests.</p></div>}
          </div>
          {activeTab === 'Pending' && visibleRequests.length > 0 && <button style={{ display: 'block', width: 'min(420px, calc(100% - 48px))', margin: '8px auto 28px', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}>View All Request</button>}
        </section>
      </main>
    </div>
  );
}

function RequestCard({ request, onClick }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '12px 20px', marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--card-bg)', boxShadow: 'var(--shadow)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
    <div style={{ width: '42px', height: '30px', borderRadius: '50%', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><User size={18} color="var(--maroon-dark)" /></div>
    <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{request.name}</p><p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{request.program}</p><p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Requested: {request.requested}</p></div>
    <span style={{ padding: '5px 28px', background: request.status === 'Approved' ? '#EAF7EC' : request.status === 'Rejected' ? '#FDECEC' : '#FFF1DD', color: request.status === 'Approved' ? '#2E7D32' : request.status === 'Rejected' ? '#B42318' : 'var(--maroon)', fontSize: '11px', fontWeight: 700 }}>{request.status}</span>
  </button>;
}

function RequestDetails({ request, onBack, onUpdate, onSendTemporary }) {
  return <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
    <TopBar title="Certificate Request Details" showBreadcrumb={true} />
    <main style={{ padding: '24px' }}>
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '560px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to Requests</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px' }}><div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'var(--sidebar-bg)', display: 'grid', placeItems: 'center' }}><User size={28} color="#fff" /></div><div><h2 style={{ margin: 0, fontSize: '16px' }}>{request.name}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{request.course} - {request.year}</p><p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Student ID: {request.studentId}</p></div></div>
        <h3 style={{ fontSize: '14px', margin: '0 0 14px' }}>Request Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '13px', marginBottom: '28px' }}><Info label="Request Type" value="Certificate of Completion" /><Info label="Purpose" value="For all purposes" /><Info label="Component" value={request.program} /><Info label="Date Requested" value={request.dateRequested} /><Info label="Additional Notes" value="None" /></div>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px' }}>Attachments</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow)', marginBottom: '18px' }}><FileImage size={24} color="var(--maroon)" /><div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '13px' }}>ID Picture.jpg</strong><span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>128KB</span></div><button aria-label="Download attachment" style={{ border: 0, background: 'none', color: 'var(--maroon)', cursor: 'pointer' }}><Download size={20} /></button></div>
        {request.status === 'Approved' && <div style={{ padding: '14px 16px', border: '1px solid #E8C5C5', borderRadius: '8px', background: '#FFF8F8', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}><Send size={16} color="var(--maroon)" /><strong style={{ fontSize: '13px', color: 'var(--maroon)' }}>Temporary Certificate</strong></div>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>Send a temporary certificate the student can use when claiming the original certificate from the registrar.</p>
          <button onClick={onSendTemporary} disabled={request.temporaryCertificateSent} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 16px', border: '1px solid var(--maroon)', borderRadius: '7px', background: request.temporaryCertificateSent ? '#F3E5E5' : 'var(--maroon)', color: request.temporaryCertificateSent ? 'var(--maroon)' : '#fff', font: '600 12px inherit', cursor: request.temporaryCertificateSent ? 'default' : 'pointer' }}>{request.temporaryCertificateSent ? 'Temporary Certificate Sent' : 'Send Temporary Certificate'}</button>
        </div>}
        {request.status === 'Pending' && <div style={{ display: 'flex', gap: '24px', justifyContent: 'space-between' }}><button onClick={() => onUpdate('Rejected')} style={{ flex: 1, padding: '13px', border: '1px solid var(--maroon)', borderRadius: '8px', background: '#fff', color: 'var(--maroon)', font: '600 14px inherit', cursor: 'pointer' }}><X size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Reject</button><button onClick={() => onUpdate('Approved')} style={{ flex: 1, padding: '13px', border: 0, borderRadius: '8px', background: 'var(--maroon)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}><Check size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Approve</button></div>}
      </section>
    </main>
  </div>;
}

function Info({ label, value }) { return <div><span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '3px' }}>{label}</span><strong>{value}</strong></div>; }
