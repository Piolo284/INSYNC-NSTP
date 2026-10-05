import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCog, GraduationCap, Megaphone, ClipboardCheck, ChevronRight, Clock } from 'lucide-react';
import TopBar from '../components/TopBar';
import StatCard from '../components/StatCard';
import DataStatusPanel from '../components/DataStatusPanel';
import EnrollmentTrendChart from '../components/EnrollmentTrendChart';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import ActivityItem from '../components/ActivityItem';
import AsyncSection from '../components/AsyncSection';
import { useApi } from '../hooks/useApi';
import { dashboardApi } from '../api/dashboard';
import { announcementsApi } from '../api/announcements';
import { activitiesApi } from '../api/activities';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetcher = useCallback(async () => {
    // The super_admin layout needs a richer feed (Activities merged with
    // Announcements) and more announcement cards than the other roles' plain
    // list — only fetch that extra data for the role that actually uses it.
    const [summary, announcements, activities] = await Promise.all([
      dashboardApi.admin(),
      announcementsApi.list({ limit: isSuperAdmin ? 6 : 5 }),
      isSuperAdmin ? activitiesApi.list() : Promise.resolve(null),
    ]);
    setLastUpdated(new Date());
    return { summary: summary.data, announcements: announcements.data, activities: activities?.data || [] };
  }, [isSuperAdmin]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);

  const announcementFeed = (data?.announcements || []).map((a) => ({
    _id: a._id,
    type: 'announcement',
    title: a.title,
    description: a.content?.length > 110 ? `${a.content.slice(0, 110)}...` : a.content,
    timestamp: a.createdAt,
  }));

  // super_admin's "Recent Activity" is a genuine cross-entity feed (new NSTP
  // activities + announcements), merged by recency — not just announcements
  // reused under a different heading.
  const activityFeed = (data?.activities || []).map((a) => ({
    _id: a._id,
    type: 'activity',
    title: a.title,
    description: a.description?.length > 110 ? `${a.description.slice(0, 110)}...` : a.description,
    timestamp: a.createdAt,
  }));
  const mergedFeed = [...announcementFeed, ...activityFeed]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6);

  const s = data?.summary;
  const showStudents = currentUser?.role !== 'admin_rotc';
  const showCadets = currentUser?.role !== 'admin_cwts';

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  if (isSuperAdmin) {
    const dataStatusRows = s
      ? [
          { type: 'total', label: 'Total Enrolled', value: (s.users.students + s.users.cadets).toLocaleString() },
          { type: 'cadets', label: 'ROTC Cadets', value: s.users.cadets.toLocaleString() },
          { type: 'students', label: 'CWTS Students', value: s.users.students.toLocaleString() },
          { type: 'officers', label: 'Active Officers', value: s.users.officers.toLocaleString() },
          { type: 'announcements', label: 'Announcements', value: s.content.announcements.toLocaleString() },
          { type: 'attendance', label: 'Attendance Today', value: s.attendanceToday.toLocaleString() },
          { type: 'certificates', label: 'Certificates Requested', value: s.certificatesPending.toLocaleString() },
        ]
      : [];

    return (
      <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
        <TopBar title="Dashboard" />
        <main style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            <Clock size={15} />
            <span>Last updated: {lastUpdatedLabel}</span>
          </div>

          <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="300px">
            {s && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr) minmax(280px, 340px)', gap: '20px', alignItems: 'start' }}>
                <DataStatusPanel rows={dataStatusRows} />

                <div>
                  <EnrollmentTrendChart total={s.users.students + s.users.cadets} />

                  <section style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius)', padding: '20px 22px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Recent Activity</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Latest updates in the system</p>
                      </div>
                      <button
                        onClick={() => navigate('/announcements')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
                          color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'inherit', padding: '6px 10px', borderRadius: '8px', whiteSpace: 'nowrap',
                        }}
                      >
                        View All Activity <ChevronRight size={14} />
                      </button>
                    </div>
                    <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && mergedFeed.length === 0} emptyMessage="No recent activity." minHeight="140px">
                      <div>
                        {mergedFeed.map((activity) => (
                          <ActivityItem key={`${activity.type}-${activity._id}`} activity={activity} />
                        ))}
                      </div>
                    </AsyncSection>
                  </section>
                </div>

                <AnnouncementsPanel announcements={data.announcements || []} />
              </div>
            )}
          </AsyncSection>
        </main>
      </div>
    );
  }

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
          <span>Last updated: {lastUpdatedLabel}</span>
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
          <AsyncSection loading={loading} error={error} onRetry={refetch} isEmpty={!loading && !error && announcementFeed.length === 0} emptyMessage="No recent activity." minHeight="140px">
            <div>
              {announcementFeed.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))}
            </div>
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}
