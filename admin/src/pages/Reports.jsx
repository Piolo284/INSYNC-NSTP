import React, { useCallback, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, Download, GraduationCap, Users } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { attendanceApi } from '../api/attendance';
import { gradesApi } from '../api/grades';
import { toCsv, downloadCsvString } from '../api/client';
import { useAuth } from '../context/AuthContext';

const reportOptions = [
  { id: 'enrollment', title: 'Enrollment Summary', description: 'Summary of all enrolled students and cadets', icon: Users },
  { id: 'attendance', title: 'Attendance Summary', description: 'Summary of today’s and this month’s attendance', icon: ClipboardList },
  { id: 'grades', title: 'Grades Summary', description: 'Summary of grading results and remarks', icon: GraduationCap },
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
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '22px', width: '100%', minHeight: '64px', padding: '12px 24px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', boxShadow: 'var(--shadow)', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
    <Icon size={26} color="#9B1C43" strokeWidth={1.8} />
    <span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>{report.title}</strong><small style={{ display: 'block', marginTop: '2px', color: 'var(--text-secondary)', fontSize: '12px' }}>{report.description}</small></span>
    <ChevronRight size={22} color="var(--text-primary)" />
  </button>;
}

function ReportPreview({ report, onBack }) {
  const Icon = report.icon;
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const fetcher = useCallback(async () => {
    if (report.id === 'enrollment') {
      const wantsStudents = effectiveProgram !== 'ROTC';
      const wantsCadets = effectiveProgram !== 'CWTS';
      const [s, c] = await Promise.all([
        wantsStudents ? studentsApi.list() : Promise.resolve({ stats: { total: 0, active: 0, inactive: 0 }, data: [] }),
        wantsCadets ? cadetsApi.list() : Promise.resolve({ stats: { total: 0, active: 0, inactive: 0 }, data: [] }),
      ]);
      return {
        summary: [
          { label: 'Total Enrolled', value: s.stats.total + c.stats.total },
          { label: 'CWTS Students', value: s.stats.total },
          { label: 'ROTC Cadets', value: c.stats.total },
          { label: 'Active', value: s.stats.active + c.stats.active },
        ],
        rows: [...s.data, ...c.data],
      };
    }
    if (report.id === 'attendance') {
      const program = isSuperAdmin ? (effectiveProgram || 'CWTS') : undefined;
      const res = await attendanceApi.summary(program ? { program } : undefined);
      const d = res.data;
      return {
        summary: [
          { label: 'Present Today', value: d.today.present },
          { label: 'Late Today', value: d.today.late },
          { label: 'Absent Today', value: d.today.absent },
          { label: 'Total Trainees', value: d.totalStudents },
        ],
        raw: d,
      };
    }
    // grades
    const params = isSuperAdmin && effectiveProgram ? { program: effectiveProgram } : undefined;
    const res = await gradesApi.list(params);
    return {
      summary: [
        { label: 'Passed', value: res.stats.passed },
        { label: 'Warning', value: res.stats.warning },
        { label: 'Failed', value: res.stats.failed },
        { label: 'Incomplete', value: res.stats.incomplete },
      ],
    };
  }, [report.id, effectiveProgram, isSuperAdmin]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);

  const handleExport = async () => {
    setExportError('');
    setExporting(true);
    try {
      if (report.id === 'grades') {
        const exportProgram = isSuperAdmin ? (effectiveProgram || 'CWTS') : undefined;
        await gradesApi.exportReport(exportProgram ? { program: exportProgram } : undefined, 'grade-report.csv');
      } else if (report.id === 'enrollment' && data?.rows) {
        const csv = toCsv(data.rows.map((r) => ({
          id: r.studentId || r.cadetId, name: r.fullName, program: r.program,
          course: r.course, yearLevel: r.yearLevel, status: r.status,
        })), [
          { label: 'ID', value: 'id' }, { label: 'Name', value: 'name' }, { label: 'Program', value: 'program' },
          { label: 'Course', value: 'course' }, { label: 'Year Level', value: 'yearLevel' }, { label: 'Status', value: 'status' },
        ]);
        downloadCsvString(csv, 'enrollment-summary.csv');
      } else if (report.id === 'attendance' && data?.raw) {
        const csv = toCsv([
          { metric: 'Present (today)', value: data.raw.today.present },
          { metric: 'Late (today)', value: data.raw.today.late },
          { metric: 'Absent (today)', value: data.raw.today.absent },
          { metric: 'Excused (today)', value: data.raw.today.excused },
          { metric: 'Total trainees', value: data.raw.totalStudents },
          { metric: 'Present (overall)', value: data.raw.overall.present },
          { metric: 'Late (overall)', value: data.raw.overall.late },
          { metric: 'Absent (overall)', value: data.raw.overall.absent },
        ], [{ label: 'Metric', value: 'metric' }, { label: 'Value', value: 'value' }]);
        downloadCsvString(csv, 'attendance-summary.csv');
      }
    } catch (err) {
      setExportError(errorMessage(err, 'Export failed.'));
    } finally {
      setExporting(false);
    }
  };

  return <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
    <TopBar title={report.title} showBreadcrumb={true} />
    <main style={{ padding: '24px' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '7px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '18px' }}><ArrowLeft size={16} /> Back to Reports</button>
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '22px' }}>
          <Icon size={25} color="var(--maroon)" />
          <div><h2 style={{ margin: 0, fontSize: '18px' }}>{report.title}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
        </div>

        {exportError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '18px' }}>{exportError}</div>}

        <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="200px">
          {data && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.summary.length}, 1fr)`, gap: '14px', marginBottom: '28px' }}>
                {data.summary.map((s) => <Summary key={s.label} label={s.label} value={s.value} />)}
              </div>
              <div style={{ padding: '18px', background: 'var(--bg)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Report data reflects live records from the server as of the generation time above.
              </div>
              <button onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'min(300px, 100%)', margin: '28px auto 0', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--maroon)', color: '#fff', font: '600 13px inherit', cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.7 : 1 }}>
                <Download size={16} /> {exporting ? 'Exporting...' : 'Export Report'}
              </button>
            </>
          )}
        </AsyncSection>
      </section>
    </main>
  </div>;
}

function Summary({ label, value }) { return <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}><span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span><strong style={{ display: 'block', marginTop: '5px', fontSize: '24px' }}>{value}</strong></div>; }
