import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, Send, User } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';
import StudentListItem from '../components/StudentListItem';

const TABS = [
  { id: 'dropouts', label: 'Dropouts' },
  { id: 'at-risk', label: 'At Risk' },
  { id: 'transfers', label: 'Transfers' },
];

const mockDropouts = [
  { id: '1', name: 'Jojo Malangis', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', program: 'ROTC', status: 'dropped out', absences: 0 },
  { id: '2', name: 'Piolo Privado', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', program: 'ROTC', status: 'dropped out', absences: 0 },
];

const mockAtRisk = [
  { id: '3', name: 'Jojo Malangis', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', program: 'ROTC', status: 'at risk', absences: 3 },
  { id: '4', name: 'Piolo Privado', studentId: '23BI1471', course: 'BSI/T', year: '2nd Year', program: 'CWTS', status: 'at risk', absences: 3 },
  { id: '5', name: 'Lorenz Mira', studentId: '23BI1472', course: 'BSI/T', year: '2nd Year', program: 'CWTS', status: 'at risk', absences: 3 },
  { id: '6', name: 'Emmanuel Noche', studentId: '23BI1473', course: 'BSI/T', year: '2nd Year', program: 'CWTS', status: 'at risk', absences: 3 },
];

const mockTransfers = [];

export default function StudentMonitoring() {
  const [activeTab, setActiveTab] = useState('dropouts');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const getTabData = () => {
    switch (activeTab) {
      case 'dropouts': return mockDropouts;
      case 'at-risk': return mockAtRisk;
      case 'transfers': return mockTransfers;
      default: return [];
    }
  };

  const data = getTabData();

  if (selectedStudent) {
    return <NotificationForm student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Student Monitoring" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <div style={{
          background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '18px 24px',
          marginBottom: '20px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center',
          gap: '12px', border: '1px solid var(--border)'
        }}>
          {TABS.map((tab) => (
            <TabButton key={tab.id} label={tab.label} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>

        <div style={{
          background: 'var(--card-bg)', borderRadius: '0 0 var(--radius) var(--radius)',
          padding: '24px', boxShadow: 'var(--shadow)', minHeight: '400px',
          border: '1px solid var(--border)', borderTop: 'none'
        }}>
          {activeTab === 'at-risk' && (
            <div style={{
              background: 'var(--orange-banner)', border: '1px solid var(--orange-border)',
              borderRadius: 'var(--radius-sm)', padding: '16px 20px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: 'var(--orange-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <AlertTriangle size={18} color="#fff" strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--orange-text)', margin: '0 0 3px' }}>
                  These students have 3 or more absences.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--orange-text)', margin: 0, opacity: 0.85, fontWeight: 500 }}>
                  Send a notifications to advise them.
                </p>
              </div>
            </div>
          )}

          {data.length > 0 ? (
              data.map((student) => (
              <StudentListItem key={student.id} student={student} showNotify={activeTab === 'at-risk'} onNotify={() => setSelectedStudent(student)} />
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '15px', fontWeight: 500 }}>No students found in this category.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NotificationForm({ student, onBack }) {
  const [message, setMessage] = useState(
    `Hi ${student.name},\n\nOur records show that you have ${student.absences} absences in ${student.program} activities. Please be reminded that excessive absences may affect your participation and evaluation.\n\nKindly attend the next activities and coordinate with your instructor if you have concerns.\n\nThank you`
  );
  const [channel, setChannel] = useState('In-app Notification');

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Notify Student" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '560px' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to At Risk</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--sidebar-bg)', display: 'grid', placeItems: 'center' }}><User size={26} color="#fff" /></div>
            <div><h2 style={{ margin: 0, fontSize: '16px' }}>{student.name}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.course} - {student.year} | {student.program}</p><p style={{ margin: '2px 0 0', color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>Absences: {student.absences}</p></div>
          </div>
          <label htmlFor="notification-message" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Notification Message</label>
          <textarea id="notification-message" value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%', minHeight: '170px', resize: 'vertical', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', color: 'var(--text-primary)', font: '13px/1.6 inherit', outline: 'none' }} />
          <fieldset style={{ border: 0, padding: 0, margin: '18px 0 28px' }}><legend style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Send via</legend>{['In-app Notification', 'Email'].map(option => <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '9px', cursor: 'pointer' }}><input type="radio" name="channel" value={option} checked={channel === option} onChange={e => setChannel(e.target.value)} />{option}</label>)}</fieldset>
          <button onClick={() => { window.alert(`Notification sent to ${student.name} via ${channel}.`); onBack(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'min(420px, 100%)', margin: '0 auto', padding: '13px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}><Send size={16} /> Send Notification</button>
        </section>
      </main>
    </div>
  );
}
