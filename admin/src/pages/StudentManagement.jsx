import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Upload, Plus, ChevronDown } from 'lucide-react';
import TopBar from '../components/TopBar';

const mockStudents = [
  { id: 1, name: 'Jojo Malangis', component: 'ROTC', program: 'BSI/T', status: 'Fit' },
  { id: 2, name: 'Piolo Privado', component: 'CWTS', program: 'BSI/T', status: 'Unfit' },
  { id: 3, name: 'Jojo Malangis', component: 'ROTC', program: 'BSI/T', status: 'Fit' },
  { id: 4, name: 'Jojo Malangis', component: 'ROTC', program: 'BSI/T', status: 'Fit' },
  { id: 5, name: 'Piolo Privado', component: 'CWTS', program: 'BSI/T', status: 'Unfit' },
  { id: 6, name: 'Lorenz Mira', component: 'ROTC', program: 'BSI/T', status: 'Fit' },
  { id: 7, name: 'Emmanuel Noche', component: 'CWTS', program: 'BSI/T', status: 'Unfit' },
  { id: 8, name: 'Maria Santos', component: 'ROTC', program: 'BSBA', status: 'Fit' },
];

export default function StudentManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSY, setSelectedSY] = useState('SY 2026-2027');
  const [selectedSem, setSelectedSem] = useState('1st Semester');
  const [selectedNSTP, setSelectedNSTP] = useState('All NSTP');
  const [selectedProgram, setSelectedProgram] = useState('All Program');
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredStudents = useMemo(() => {
    return mockStudents.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNSTP = selectedNSTP === 'All NSTP' || s.component === selectedNSTP;
      const matchesProgram = selectedProgram === 'All Program' || s.program === selectedProgram;
      const matchesStatus =
        activeFilter === 'all'
          ? true
          : activeFilter === 'fit'
          ? s.status === 'Fit'
          : s.status === 'Unfit';
      return matchesSearch && matchesNSTP && matchesProgram && matchesStatus;
    });
  }, [searchQuery, selectedNSTP, selectedProgram, activeFilter]);

  const totalEnrolled = mockStudents.length;
  const fitCount = mockStudents.filter((s) => s.status === 'Fit').length;
  const unfitCount = mockStudents.filter((s) => s.status === 'Unfit').length;

  const CustomSelect = ({ value, onChange, options }) => (
    <div style={{ position: 'relative', minWidth: '160px' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 36px 10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          background: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          appearance: 'none',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--text-secondary)',
        }}
      />
    </div>
  );

  const StatCard = ({ title, value, percent, type, filterKey }) => {
    const isActive = activeFilter === filterKey;
    const colors = {
      all: { label: 'var(--text-secondary)', value: 'var(--text-primary)', percent: '#059669', border: isActive ? '#059669' : 'var(--border)' },
      fit: { label: 'var(--text-secondary)', value: 'var(--text-primary)', percent: '#059669', border: isActive ? '#059669' : 'var(--border)' },
      unfit: { label: 'var(--red-status)', value: 'var(--red-status)', percent: 'var(--red-status)', border: isActive ? 'var(--red-status)' : 'var(--border)' },
    };
    const c = colors[filterKey];

    return (
      <div
        onClick={() => setActiveFilter(filterKey)}
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-sm)',
          padding: '24px',
          textAlign: 'center',
          border: `2px solid ${c.border}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isActive ? 'var(--shadow-lg)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.boxShadow = 'var(--shadow)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: c.label,
            margin: '0 0 10px',
          }}
        >
          {title}
        </p>
        <h3
          style={{
            fontSize: '32px',
            fontWeight: 800,
            margin: '0 0 6px',
            color: c.value,
          }}
        >
          {value.toLocaleString()}
        </h3>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: c.percent,
            margin: 0,
          }}
        >
          {percent}
        </p>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Student Management" showBreadcrumb={true} />

      <main style={{ padding: '24px' }}>
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius)',
            padding: '28px',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={22} color="var(--text-primary)" strokeWidth={2.2} />
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Student List
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => navigate('/export-data')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--maroon)',
                  background: '#fff',
                  color: 'var(--maroon)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--maroon)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = 'var(--maroon)';
                }}
              >
                <Upload size={16} /> Export Data
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--maroon)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Plus size={16} /> Add Student
              </button>
            </div>
          </div>

          {/* Search & Filters Row 1 */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                placeholder="Search Students"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <CustomSelect
              value={selectedSY}
              onChange={setSelectedSY}
              options={['SY 2026-2027', 'SY 2025-2026', 'SY 2024-2025']}
            />
            <CustomSelect
              value={selectedSem}
              onChange={setSelectedSem}
              options={['1st Semester', '2nd Semester']}
            />
          </div>

          {/* Filters Row 2 */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <CustomSelect
              value={selectedNSTP}
              onChange={setSelectedNSTP}
              options={['All NSTP', 'ROTC', 'CWTS']}
            />
            <CustomSelect
              value={selectedProgram}
              onChange={setSelectedProgram}
              options={['All Program', 'BSI/T', 'BSBA', 'BSED']}
            />
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <StatCard
              title="Total Enrolled"
              value={totalEnrolled}
              percent="(100%)"
              type="all"
              filterKey="all"
            />
            <StatCard
              title="Fit for Training"
              value={fitCount}
              percent="(88.4%)"
              type="fit"
              filterKey="fit"
            />
            <StatCard
              title="Medically Unfit"
              value={unfitCount}
              percent="(11.6%)"
              type="unfit"
              filterKey="unfit"
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['No.', 'Name', 'Component', 'Program', 'Status'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => (
                  <tr
                    key={student.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {student.name}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {student.component}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {student.program}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '5px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: student.status === 'Fit' ? '#ECFDF5' : '#FEF2F2',
                          color: student.status === 'Fit' ? '#059669' : '#DC2626',
                        }}
                      >
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: 'var(--text-secondary)',
                }}
              >
                No students found.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
