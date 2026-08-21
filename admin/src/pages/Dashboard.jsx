import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCog, GraduationCap, Megaphone, ClipboardCheck, ChevronRight, Clock } from 'lucide-react';
import TopBar from '../components/TopBar';
import StatCard from '../components/StatCard';
import ActivityItem from '../components/ActivityItem';
import AsyncSection from '../components/AsyncSection';
import { useApi } from '../hooks/useApi';
import { dashboardApi } from '../api/dashboard';
import { announcementsApi } from '../api/announcements';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetcher = useCallback(async () => {
    const [summary, announcements] = await Promise.all([
      dashboardApi.admin(),
      announcementsApi.list({ limit: 5 }),
    ]);
    setLastUpdated(new Date());
    return { summary: summary.data, announcements: announcements.data };
  }, []);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);

  const feed = (data?.announcements || []).map((a) => ({
    _id: a._id,
    type: 'announcement',
    title: a.title,
    description: a.content?.length > 110 ? `${a.content.slice(0, 110)}...` : a.content,
    timestamp: a.createdAt,
  }));

  const s = data?.summary;
  const showStudents = currentUser?.role !== 'admin_rotc';
  const showCadets = currentUser?.role !== 'admin_cwts';

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Dashboard" />
      <main style={{ padding: '24px' }}>
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 20px', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Today's Overview
          </h2>

          <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="140px">
            {s && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
                {showStudents && (
                  <StatCard title="CWTS Students" value={s.users.students.toLocaleString()} subtitle={`${s.programs.CWTS || 0} in CWTS`} icon={Users} type="students" />
                )}
                {showCadets && (
                  <StatCard title="ROTC Cadets" value={s.users.cadets.toLocaleString()} subtitle={`${s.programs.ROTC || 0} in ROTC`} icon={GraduationCap} type="cadets" />
                )}
                <StatCard title="Active Officers" value={s.users.officers.toLocaleString()} subtitle="Across programs" icon={UserCog} type="officers" />
                <StatCard title="Announcements" value={s.content.announcements.toLocaleString()} subtitle={`${s.content.activities} activities`} icon={Megaphone} type="announcements" />
                <StatCard title="Attendance Today" value={s.attendanceToday.toLocaleString()} subtitle="Records logged today" icon={ClipboardCheck} type="attendance" />
              </div>
            )}
          </AsyncSection>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
          <Clock size={15} />
          <span>Last updated: {lastUpdated ? lastUpdated.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          {isSuperAdmin && s && s.program === null && (
            <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>(combined CWTS + ROTC totals)</span>
          )}
        </div>

        <section style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '24px 28px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              Recent Activity
            </h2>
            <button onClick={() => navigate('/announcements')} style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', padding: '6px 10px', borderRadius: '8px', transition: 'background 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              View All Activity <ChevronRight size={16} />
            </button>
          </div>
          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && feed.length === 0} emptyMessage="No recent activity." minHeight="140px">
            <div>
              {feed.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))}
            </div>
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}
