import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, Megaphone, Plus, Upload, Users } from 'lucide-react';
import TopBar from '../components/TopBar';
import TabButton from '../components/TabButton';

const initialAnnouncements = [
  { id: '1', title: 'Tree Planting Activity', date: 'July 15, 2026 | 7:00 AM', posted: 'August 14, 2026', category: 'CWTS', icon: Users },
  { id: '2', title: 'General Assembly', date: 'July 8, 2026 | 8:00 AM', posted: 'July 7, 2026', category: 'All', icon: Megaphone },
  { id: '3', title: 'ROTC Drill Schedule', date: 'July 30, 2026 | 7:30 AM', posted: 'July 29, 2026', category: 'ROTC', icon: CalendarDays },
];

export default function Announcements() {
  const [activeTab, setActiveTab] = useState('All');
  const [isCreating, setIsCreating] = useState(false);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [form, setForm] = useState({ title: '', audience: '', message: '', file: null });
  const visible = activeTab === 'All' ? announcements : announcements.filter(item => item.category === activeTab);

  const updateForm = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const postAnnouncement = () => {
    setAnnouncements(current => [{
      id: String(Date.now()), title: form.title, date: 'Just now', posted: 'August 19, 2026',
      category: form.audience, icon: Megaphone
    }, ...current]);
    setActiveTab('All');
    setIsCreating(false);
    setForm({ title: '', audience: '', message: '', file: null });
  };

  if (isCreating) {
    return <AnnouncementForm form={form} updateForm={updateForm} onBack={() => setIsCreating(false)} onSubmit={postAnnouncement} />;
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Announcements" />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', minHeight: '560px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', borderBottom: '1px solid var(--border)' }}>
            {['All', 'CWTS', 'ROTC'].map(tab => <TabButton key={tab} label={tab} isActive={activeTab === tab} onClick={() => setActiveTab(tab)} />)}
          </div>
          <div style={{ padding: '12px 24px', flex: 1 }}>
            {visible.map(item => {
              const Icon = item.icon;
              return <article key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '16px 20px', marginBottom: '12px', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow)' }}>
                <Icon size={24} color="var(--maroon)" />
                <div style={{ flex: 1 }}><h3 style={{ margin: 0, fontSize: '14px' }}>{item.title}</h3><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '11px' }}>{item.date}</p><p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '11px' }}>Posted: {item.posted}</p></div>
                <button aria-label={`Expand ${item.title}`} style={{ border: 0, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><ChevronDown size={16} /></button>
              </article>;
            })}
          </div>
          <button onClick={() => setIsCreating(true)} style={{ alignSelf: 'center', width: 'min(420px, calc(100% - 48px))', margin: '20px 24px 28px', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}><Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />New Announcement</button>
        </section>
      </main>
    </div>
  );
}

function AnnouncementForm({ form, updateForm, onBack, onSubmit }) {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Announcement" showBreadcrumb={true} />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '560px' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}><ArrowLeft size={16} /> Back to Announcements</button>
          <form onSubmit={e => { e.preventDefault(); onSubmit(); }} style={{ display: 'grid', gap: '18px' }}>
            <Field label="Title"><input required value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Enter Announcement title" /></Field>
            <Field label="Audience"><select required value={form.audience} onChange={e => updateForm('audience', e.target.value)}><option value="">Select Audience</option><option value="All">All</option><option value="CWTS">CWTS</option><option value="ROTC">ROTC</option></select></Field>
            <Field label="Message"><textarea required value={form.message} onChange={e => updateForm('message', e.target.value)} placeholder="Type your message here...." /></Field>
            <label style={{ fontSize: '13px', fontWeight: 700 }}>Attach File (Optional)<span style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontWeight: 400 }}><span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--maroon)', cursor: 'pointer' }}><Upload size={16} /> Choose file<input type="file" onChange={e => updateForm('file', e.target.files[0] || null)} style={{ display: 'none' }} /></span><span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{form.file ? form.file.name : 'No file chosen'}</span></span></label>
            <button type="submit" style={{ width: 'min(440px, 100%)', margin: '4px auto 0', padding: '13px', border: 0, borderRadius: '8px', background: 'var(--sidebar-bg)', color: '#fff', font: '600 14px inherit', cursor: 'pointer' }}>Post Announcement</button>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700 }}>{label}{React.cloneElement(children, { style: { width: '100%', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-primary)', font: '13px inherit', outline: 'none', ...(children.props.style || {}), ...(children.type === 'textarea' ? { minHeight: '112px', resize: 'vertical' } : {}) } })}</label>;
}
