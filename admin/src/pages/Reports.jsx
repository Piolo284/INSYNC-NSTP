import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, FileBarChart, FileText, GraduationCap, Users } from 'lucide-react';
import TopBar from '../components/TopBar';

const reportOptions = [
  { id: 'enrollment', title: 'Enrollment Summary', description: 'Summary of all enrolled students', icon: Users, color: '#9B1C43' },
  { id: 'attendance', title: 'Attendance Summary', description: 'Summary of attendance records', icon: ClipboardList, color: '#9B1C43' },
  { id: 'grades', title: 'Grades Summary', description: 'Summary of grading results', icon: GraduationCap, color: '#9B1C43' },
  { id: 'certificates', title: 'Certificate Request Report', description: 'Summary of certificate request', icon: FileBarChart, color: '#9B1C43' },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState(null);

  if (selectedReport) {
    return <ReportPreview report={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Reports" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            {reportOptions.map(report => <ReportRow key={report.id} report={report} onClick={() => setSelectedReport(report)} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function ReportRow({ report, onClick }) {
  const Icon = report.icon;
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '22px', width: '100%', minHeight: '64px', padding: '12px 24px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', boxShadow: 'var(--shadow)', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', transition: 'box-shadow .2s, border-color .2s' }} onMouseEnter={event => { event.currentTarget.style.borderColor = 'var(--maroon)'; event.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={event => { event.currentTarget.style.borderColor = 'var(--border)'; event.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
    <Icon size={26} color={report.color} strokeWidth={1.8} />
    <span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>{report.title}</strong><small style={{ display: 'block', marginTop: '2px', color: 'var(--text-secondary)', fontSize: '12px' }}>{report.description}</small></span>
    <ChevronRight size={22} color="var(--text-primary)" />
  </button>;
}

function ReportPreview({ report, onBack }) {
  const Icon = report.icon;
  return <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
    <TopBar title={report.title} showBreadcrumb={true} />
    <main style={{ padding: '24px' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '7px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '18px' }}><ArrowLeft size={16} /> Back to Reports</button>
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '22px' }}><Icon size={25} color="var(--maroon)" /><div><h2 style={{ margin: 0, fontSize: '18px' }}>{report.title}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Generated August 19, 2026</p></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}><Summary label="Total Records" value="1,248" /><Summary label="CWTS" value="624" /><Summary label="ROTC" value="624" /></div>
        <div style={{ padding: '18px', background: 'var(--bg)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>Report preview is ready. Use the report data to review the current {report.title.toLowerCase()}.</div>
        <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'min(300px, 100%)', margin: '28px auto 0', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--maroon)', color: '#fff', font: '600 13px inherit', cursor: 'pointer' }}><FileText size={16} /> Export Report</button>
      </section>
    </main>
  </div>;
}

function Summary({ label, value }) { return <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}><span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span><strong style={{ display: 'block', marginTop: '5px', fontSize: '24px' }}>{value}</strong></div>; }
