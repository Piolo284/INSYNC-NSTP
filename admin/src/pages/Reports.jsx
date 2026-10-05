import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, Download, GraduationCap, Users } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import ExportConfirmModal from '../components/ExportConfirmModal';
import SummaryBarChart from '../components/SummaryBarChart';
import AttendanceTrendChart from '../components/AttendanceTrendChart';
import { useApi } from '../hooks/useApi';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';
import { attendanceApi } from '../api/attendance';
import { gradesApi } from '../api/grades';
import { useAuth } from '../context/AuthContext';
import { schoolYearRanges } from '../utils/exportFile';

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

/**
 * Builds this report type's summary tiles + exportable table (columns +
 * plain-object rows) from an already school-year-filtered row set, so the
 * on-screen numbers/table and whatever gets exported always agree.
 */
function buildReportView(reportId, rows) {
  if (reportId === 'enrollment') {
    return {
      summary: [
        { label: 'Total Enrolled', value: rows.length },
        { label: 'CWTS Students', value: rows.filter((r) => r.program === 'CWTS').length },
        { label: 'ROTC Cadets', value: rows.filter((r) => r.program === 'ROTC').length },
        { label: 'Active', value: rows.filter((r) => r.status === 'Active').length },
      ],
      columns: [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Program', key: 'program' },
        { header: 'Course', key: 'course' },
        { header: 'Year Level', key: 'yearLevel' },
        { header: 'Status', key: 'status' },
        { header: 'Date Enrolled', key: 'enrolled' },
      ],
      tableRows: rows.map((r) => ({
        id: r.studentId || r.cadetId || '—',
        name: r.fullName || '—',
        program: r.program || '—',
        course: r.course || '—',
        yearLevel: r.yearLevel || '—',
        status: r.status || '—',
        enrolled: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
      })),
    };
  }

  if (reportId === 'attendance') {
    return {
      summary: [
        { label: 'Present', value: rows.filter((r) => r.status === 'Present').length },
        { label: 'Late', value: rows.filter((r) => r.status === 'Late').length },
        { label: 'Absent', value: rows.filter((r) => r.status === 'Absent').length },
        { label: 'Excused', value: rows.filter((r) => r.status === 'Excused').length },
      ],
      columns: [
        { header: 'Date', key: 'date' },
        { header: 'Name', key: 'name' },
        { header: 'ID', key: 'id' },
        { header: 'Program', key: 'program' },
        { header: 'Status', key: 'status' },
        { header: 'Time', key: 'time' },
      ],
      tableRows: rows.map((r) => {
        const student = r.studentId && typeof r.studentId === 'object' ? r.studentId : {};
        return {
          date: r.date ? new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
          name: student.name || '—',
          id: student.studentId || '—',
          program: r.program || '—',
          status: r.status || '—',
          time: r.time || '—',
        };
      }),
    };
  }

  // grades
  return {
    summary: [
      { label: 'Passed', value: rows.filter((r) => r.remarks === 'Passed').length },
      { label: 'Failed', value: rows.filter((r) => r.remarks === 'Failed').length },
      { label: 'Incomplete', value: rows.filter((r) => r.remarks === 'Incomplete').length },
    ],
    columns: [
      { header: 'Student ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Program', key: 'program' },
      { header: 'Section', key: 'section' },
      { header: 'Year Level', key: 'yearLevel' },
      { header: 'Final Grade', key: 'gradePoint' },
      { header: 'Remarks', key: 'remarks' },
    ],
    // College grading scale (1.00 highest, 5.00 lowest) — same value shown as
    // the primary grade on the Grades page — not the raw percentage.
    tableRows: rows.map((r) => {
      const student = r.studentId && typeof r.studentId === 'object' ? r.studentId : {};
      return {
        id: student.studentId || '—',
        name: student.name || '—',
        program: r.program || '—',
        section: student.section || '—',
        yearLevel: student.yearLevel || '—',
        gradePoint: typeof r.gradePoint === 'number' ? r.gradePoint.toFixed(2) : '—',
        remarks: r.remarks || '—',
      };
    }),
  };
}

function ReportPreview({ report, onBack }) {
  const Icon = report.icon;
  const { effectiveProgram, isSuperAdmin } = useAuth();
  const [schoolYear, setSchoolYear] = useState('current'); // 'current' | 'previous'
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const ranges = useMemo(() => schoolYearRanges(), []);
  const activeRange = ranges[schoolYear];

  const fetcher = useCallback(async () => {
    if (report.id === 'enrollment') {
      const wantsStudents = effectiveProgram !== 'ROTC';
      const wantsCadets = effectiveProgram !== 'CWTS';
      const [s, c] = await Promise.all([
        wantsStudents ? studentsApi.list() : Promise.resolve({ data: [] }),
        wantsCadets ? cadetsApi.list() : Promise.resolve({ data: [] }),
      ]);
      return [...(s.data || []), ...(c.data || [])];
    }
    if (report.id === 'attendance') {
      const program = isSuperAdmin ? effectiveProgram || undefined : undefined;
      const res = await attendanceApi.list({ program, limit: 5000 });
      return res.data || [];
    }
    // grades
    const params = isSuperAdmin && effectiveProgram ? { program: effectiveProgram } : undefined;
    const res = await gradesApi.list(params);
    return res.data || [];
  }, [report.id, effectiveProgram, isSuperAdmin]);

  const { data: rawRows, loading, error, refetch } = useApi(fetcher, [fetcher]);

  // Real (not estimated) daily trend for the Attendance report only — the
  // backend has computed this all along via GET /attendance/summary, but no
  // screen has ever rendered it.
  const trendFetcher = useCallback(async () => {
    if (report.id !== 'attendance') return null;
    const program = isSuperAdmin ? effectiveProgram || undefined : undefined;
    const res = await attendanceApi.summary({ program });
    return res.data?.trend || [];
  }, [report.id, isSuperAdmin, effectiveProgram]);
  const { data: trend } = useApi(trendFetcher, [trendFetcher]);

  const filteredRows = useMemo(() => {
    if (!rawRows) return [];
    const dateOf = report.id === 'attendance' ? (r) => r.date : (r) => r.createdAt;
    return rawRows.filter((r) => {
      const raw = dateOf(r);
      if (!raw) return false;
      const t = new Date(raw).getTime();
      return t >= activeRange.start.getTime() && t <= activeRange.end.getTime();
    });
  }, [rawRows, activeRange, report.id]);

  const view = useMemo(() => buildReportView(report.id, filteredRows), [report.id, filteredRows]);

  return <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
    <TopBar title={report.title} showBreadcrumb={true} />
    <main style={{ padding: '24px' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '7px', border: 0, background: 'none', color: 'var(--maroon)', font: '600 13px inherit', cursor: 'pointer', padding: 0, marginBottom: '18px' }}><ArrowLeft size={16} /> Back to Reports</button>
      <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '28px', minHeight: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon size={25} color="var(--maroon)" />
            <div><h2 style={{ margin: 0, fontSize: '18px' }}>{report.title}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            School Year
            <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}>
              <option value="current">Current SY ({ranges.current.label})</option>
              <option value="previous">Previous SY ({ranges.previous.label})</option>
            </select>
          </label>
        </div>

        <AsyncSection loading={loading} error={error} onRetry={refetch} minHeight="200px">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${view.summary.length}, 1fr)`, gap: '14px', marginBottom: '24px' }}>
            {view.summary.map((s) => <Summary key={s.label} label={s.label} value={s.value} />)}
          </div>

          <SummaryBarChart data={view.summary} title={`${report.title} Breakdown`} subtitle={`For School Year ${ranges[schoolYear].label}`} />
          {report.id === 'attendance' && <AttendanceTrendChart trend={trend} />}

          <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Based on {report.id === 'attendance' ? 'each record\'s attendance date' : 'each record\'s enrollment/creation date'} — the closest proxy available, since the system has no dedicated school-year field yet. Preview below reflects exactly what will be exported.
          </p>

          <ReportTable columns={view.columns} rows={view.tableRows} />

          <button
            onClick={() => setExportModalOpen(true)}
            disabled={view.tableRows.length === 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'min(300px, 100%)', margin: '24px auto 0', padding: '12px', border: 0, borderRadius: '8px', background: 'var(--maroon)', color: '#fff', font: '600 13px inherit', cursor: view.tableRows.length === 0 ? 'default' : 'pointer', opacity: view.tableRows.length === 0 ? 0.5 : 1 }}
          >
            <Download size={16} /> Export Report
          </button>
        </AsyncSection>
      </section>
    </main>

    {exportModalOpen && (
      <ExportConfirmModal
        title={report.title}
        description={`This will export ${view.tableRows.length} record(s) for School Year ${ranges[schoolYear].label}, in table layout.`}
        filenameBase={`${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ranges[schoolYear].label}`}
        columns={view.columns}
        rows={view.tableRows}
        onClose={() => setExportModalOpen(false)}
      />
    )}
  </div>;
}

function ReportTable({ columns, rows }) {
  if (!rows.length) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
        No records fall within the selected school year.
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'auto', maxHeight: '360px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1 }}>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '9px 14px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ label, value }) { return <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}><span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span><strong style={{ display: 'block', marginTop: '5px', fontSize: '24px' }}>{value}</strong></div>; }
