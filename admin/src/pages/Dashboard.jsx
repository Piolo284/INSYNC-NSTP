import React from 'react';
import { Users, User, Code, Megaphone, Award, ChevronRight, Clock } from 'lucide-react';
import TopBar from '../components/TopBar';
import StatCard from '../components/StatCard';
import ActivityItem from '../components/ActivityItem';

const mockActivities = [
  { _id: '1', type: 'enroll', title: 'New student enrolled', description: 'Juan Dela Cruz was enrolled in ROTC - Regular.', timestamp: new Date().setHours(10, 25, 0, 0) },
  { _id: '2', type: 'certificate', title: 'Certificate requested', description: 'Maria Santos requested a certificate.', timestamp: new Date().setHours(9, 48, 0, 0) },
  { _id: '3', type: 'alert', title: 'Absence alert', description: '3 students reached 3 absences.', timestamp: new Date().setHours(9, 15, 0, 0) },
  { _id: '4', type: 'announcement', title: 'New announcement posted', description: 'Schedule for CWTS Activity this October.', timestamp: new Date().setHours(8, 40, 0, 0) },
  { _id: '5', type: 'report', title: 'Report generated', description: 'ROTC Enrolled Students Report was generated.', timestamp: new Date(Date.now() - 86400000).setHours(16, 30, 0, 0) },
];

export default function Dashboard() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Dashboard" />
      <main style={{ padding: '24px' }}>
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 20px', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Today's Overview
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
            <StatCard title="Total Students" value="1,248" subtitle="+ 12 this week" icon={Users} type="students" />
            <StatCard title="Active Officers" value="24" subtitle="+ 2 this week" icon={User} type="officers" />
            <StatCard title="Active Instructors" value="18" subtitle="No changes" icon={Code} type="instructors" />
            <StatCard title="Announcement" value="31" subtitle="+ 2 this week" icon={Megaphone} type="announcements" />
            <StatCard title="Certificates" value="43" subtitle="67% Submitted" icon={Award} type="certificates" />
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
          <Clock size={15} /><span>Last updated: July 16, 2026 11:54 AM</span>
        </div>

        <section style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '24px 28px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              Recent Activity
            </h2>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', padding: '6px 10px', borderRadius: '8px', transition: 'background 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              View All Activity <ChevronRight size={16} />
            </button>
          </div>
          <div>
            {mockActivities.map((activity) => (
              <ActivityItem key={activity._id} activity={activity} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
