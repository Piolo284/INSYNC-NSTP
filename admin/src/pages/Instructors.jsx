import React, { useMemo, useState } from 'react';
import { ArrowLeft, Eye, MoreVertical, Pencil, Search, User, UserCheck, UserX, Users } from 'lucide-react';
import TopBar from '../components/TopBar';

const initialInstructors = [
  { id: 'INST-2026-0001', name: 'Piolo M. Privado', program: 'ROTC', campus: 'Boac Campus', email: 'privado.piolo@marsu.edu.ph', contact: '09876543210', status: 'Active' },
  { id: 'INST-2026-0002', name: 'Maria L. Santos', program: 'CWTS', campus: 'Boac Campus', email: 'maria.santos@marsu.edu.ph', contact: '09123456789', status: 'Active' },
  { id: 'INST-2026-0003', name: 'Lorenz A. Mira', program: 'ROTC', campus: 'Boac Campus', email: 'lorenz.mira@marsu.edu.ph', contact: '09987654321', status: 'Active' },
];

export default function Instructors() {
  const [instructors, setInstructors] = useState(initialInstructors);
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('All Status');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => instructors.filter(instructor => {
    const query = search.toLowerCase();
    return (!query || `${instructor.name} ${instructor.id} ${instructor.email}`.toLowerCase().includes(query)) && (program === 'All Programs' || instructor.program === program) && (status === 'All Status' || instructor.status === status);
  }), [instructors, search, program, status]);

  if (selected) return <InstructorDetails instructor={selected} onBack={() => setSelected(null)} onToggle={() => { setInstructors(current => current.map(item => item.id === selected.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item)); setSelected(current => ({ ...current, status: current.status === 'Active' ? 'Inactive' : 'Active' })); }} />;

  const activeCount = instructors.filter(item => item.status === 'Active').length;
  const inactiveCount = instructors.length - activeCount;

  return <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
    <TopBar title="Instructors" showBreadcrumb={true} />
    <main style={{ padding: '24px' }}>
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '22px 24px', minHeight: '560px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' }}><Stat icon={Users} label="Total Instructors" value={instructors.length} note="Across all programs" /><Stat icon={UserCheck} label="Active Instructors" value={activeCount} note="100% of total" /><Stat icon={UserX} label="Inactive Instructors" value={inactiveCount} note="0% of total" /><Stat icon={Users} label="Program Covered" value="2" note="ROTC, CWTS" /></div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}><div style={{ position: 'relative', flex: 1 }}><Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search instructor by name, email, or ID..." style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: '7px', font: '13px inherit', outline: 'none' }} /></div><Select value={program} onChange={setProgram} options={['All Programs', 'ROTC', 'CWTS']} /><Select value={status} onChange={setStatus} options={['All Status', 'Active', 'Inactive']} /></div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}><thead><tr style={{ borderBottom: '2px solid var(--border)' }}>{['#', 'Instructor ID', 'Instructor Name', 'Program', 'Campus', 'Email', 'Contact Number', 'Status', 'Actions'].map(label => <th key={label} style={{ textAlign: 'left', padding: '12px 8px', fontSize: '11px', color: 'var(--text-primary)' }}>{label}</th>)}</tr></thead><tbody>{filtered.map((instructor, index) => <tr key={instructor.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={cell}>{index + 1}</td><td style={cell}>{instructor.id}</td><td style={{ ...cell, fontWeight: 600 }}>{instructor.name}</td><td style={cell}>{instructor.program}</td><td style={cell}>{instructor.campus}</td><td style={cell}>{instructor.email}</td><td style={cell}>{instructor.contact}</td><td style={{ ...cell, color: instructor.status === 'Active' ? '#2E7D32' : 'var(--red-status)', fontWeight: 700 }}>{instructor.status}</td><td style={{ ...cell, whiteSpace: 'nowrap' }}><button aria-label="View instructor" onClick={() => setSelected(instructor)} style={iconButton}><Eye size={15} /></button><button aria-label="Edit instructor" onClick={() => setSelected(instructor)} style={iconButton}><Pencil size={15} /></button><button aria-label="More instructor actions" style={iconButton}><MoreVertical size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <p style={{ textAlign: 'center', padding: '42px', color: 'var(--text-secondary)', fontSize: '13px' }}>No instructors match the current filters.</p>}</div>
      </section>
    </main>
  </div>;
}

function Select({ value, onChange, options }) { return <select value={value} onChange={event => onChange(event.target.value)} style={{ minWidth: '130px', padding: '10px 28px 10px 12px', border: '1px solid var(--border)', borderRadius: '7px', background: '#fff', font: '13px inherit', outline: 'none' }}>{options.map(option => <option key={option}>{option}</option>)}</select>; }
function Stat({ icon: Icon, label, value, note }) { return <div style={{ padding: '14px 12px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow)', textAlign: 'center' }}><Icon size={18} color="var(--maroon)" /><p style={{ margin: '6px 0 3px', fontSize: '12px', fontWeight: 700 }}>{label}</p><strong style={{ fontSize: '20px' }}>{value}</strong><small style={{ display: 'block', marginTop: '3px', color: 'var(--text-secondary)', fontSize: '10px' }}>{note}</small></div>; }
const cell = { padding: '12px 8px', fontSize: '10px', color: 'var(--text-primary)' };
const iconButton = { border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px' };

function InstructorDetails({ instructor, onBack, onToggle }) {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Instructors Details" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '560px' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '7px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to Instructors</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'var(--sidebar-bg)', display: 'grid', placeItems: 'center' }}><User size={29} color="#fff" /></div>
              <div><h2 style={{ margin: 0, fontSize: '17px' }}>{instructor.name}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{instructor.program} - Instructor</p><p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{instructor.id}</p></div>
            </div>
            <button onClick={onToggle} style={{ padding: '9px 14px', border: '1px solid var(--maroon)', borderRadius: '7px', background: '#fff', color: 'var(--maroon)', font: '600 12px inherit', cursor: 'pointer' }}>{instructor.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <InfoCard title="Personal Information" rows={[['Fullname', instructor.name], ['Program', instructor.program], ['Campus', instructor.campus]]} />
            <InfoCard title="Contact Information" rows={[['Email Address', instructor.email], ['Contact Number', instructor.contact], ['Status', instructor.status]]} />
          </div>
          <InfoCard title="Recent Activities" rows={[['Login', 'Instructor logged in to the system'], ['Update Profile', 'Updated contact information'], ['Assigned to Classes', `${instructor.program} training assignment`]]} />
        </section>
      </main>
    </div>
  );
}
function InfoCard({ title, rows }) { return <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--shadow)' }}><h3 style={{ margin: '0 0 12px', color: 'var(--maroon)', fontSize: '13px' }}>{title}</h3>{rows.map(([label, value]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', marginBottom: '8px', fontSize: '12px' }}><span style={{ color: 'var(--text-secondary)' }}>{label}</span><strong>{value}</strong></div>)}</div>; }
