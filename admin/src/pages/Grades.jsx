import React, { useCallback, useState } from 'react';
import { ChevronDown, FileText, Download } from 'lucide-react';
import TopBar from '../components/TopBar';
import AsyncSection from '../components/AsyncSection';
import { useApi, errorMessage } from '../hooks/useApi';
import { gradesApi } from '../api/grades';
import { useAuth } from '../context/AuthContext';

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ position: 'relative', display: 'block' }}>
      <span style={{ position: 'absolute', left: '-9999px' }}>{label}</span>
      <select value={value} onChange={onChange} aria-label={label} style={{
        appearance: 'none', width: '100%', minWidth: '160px', padding: '12px 38px 12px 16px',
        border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)',
        color: 'var(--text-primary)', font: '600 13px inherit', cursor: 'pointer', outline: 'none'
      }}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '12px', pointerEvents: 'none' }} />
    </label>
  );
}

const REMARKS_COLORS = {
  Passed: '#3C9B50',
  Warning: '#D97706',
  Failed: '#DC2626',
  Incomplete: '#6B7280',
};

export default function Grades() {
  const { isSuperAdmin, effectiveProgram } = useAuth();
  const [program, setProgram] = useState('All');
  const [remarks, setRemarks] = useState('All');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const fetcher = useCallback(async () => {
    const params = {};
    if (isSuperAdmin) {
      if (program !== 'All') params.program = program;
    }
    if (remarks !== 'All') params.remarks = remarks;
    const res = await gradesApi.list(params);
    return res.data || [];
  }, [isSuperAdmin, program, remarks]);

  const { data, loading, error, refetch } = useApi(fetcher, [fetcher]);
  const grades = data || [];

  const handleExport = async () => {
    setExportError('');
    setExporting(true);
    try {
      const exportProgram = isSuperAdmin ? (program !== 'All' ? program : effectiveProgram || 'CWTS') : undefined;
      await gradesApi.exportReport(exportProgram ? { program: exportProgram } : undefined, 'grade-report.csv');
    } catch (err) {
      setExportError(errorMessage(err, 'Export failed.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Grades" />
      <main style={{ padding: '24px' }}>
        <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {isSuperAdmin && (
                <SelectField label="Program" value={program} onChange={e => setProgram(e.target.value)} options={['All', 'CWTS', 'ROTC']} />
              )}
              <SelectField label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} options={['All', 'Passed', 'Warning', 'Failed', 'Incomplete']} />
            </div>
            <button onClick={handleExport} disabled={exporting} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px',
              border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.7 : 1,
            }}>
              <Download size={15} /> {exporting ? 'Exporting...' : 'Export Report'}
            </button>
          </div>

          {exportError && (
            <div style={{ margin: '16px 24px 0', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px' }}>{exportError}</div>
          )}

          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={!loading && !error && grades.length === 0}
            emptyMessage="No grade records found."
            minHeight="240px"
          >
            {grades.map(g => {
              const student = g.studentId || {};
              return (
                <div key={g._id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <FileText size={20} color="var(--maroon-dark)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{student.name || 'Unknown'}</p>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.section || '—'} · {student.yearLevel || '—'} · {g.program}</p>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{student.studentId || ''}</p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '90px' }}>
                    <strong style={{ display: 'block', fontSize: '18px', color: REMARKS_COLORS[g.remarks] || '#6B7280' }}>{g.finalGrade?.toFixed(1) ?? '—'}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{g.remarks}</span>
                  </div>
                </div>
              );
            })}
          </AsyncSection>
        </section>
      </main>
    </div>
  );
}
