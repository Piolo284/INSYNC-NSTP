import React, { useState } from 'react';
import { AlertCircle, Search, User, Download } from 'lucide-react';
import TopBar from '../components/TopBar';

const mockUnfitStudents = [
  { id: 1, name: 'Jojo Malangis', course: 'BSI/T', year: '2nd Year', component: 'ROTC' },
  { id: 2, name: 'Jojo Malangis', course: 'BSI/T', year: '2nd Year', component: 'ROTC' },
  { id: 3, name: 'Jojo Malangis', course: 'BSI/T', year: '2nd Year', component: 'ROTC' },
  { id: 4, name: 'Jojo Malangis', course: 'BSI/T', year: '2nd Year', component: 'ROTC' },
  { id: 5, name: 'Jojo Malangis', course: 'BSI/T', year: '2nd Year', component: 'ROTC' },
];

export default function MedicallyUnfit() {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = mockUnfitStudents.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Medically unfit Student" showBreadcrumb={true} />

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
          {/* Alert Banner */}
          <div
            style={{
              background: 'var(--orange-banner)',
              border: '1px solid var(--orange-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px 20px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--orange-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--orange-text)',
                lineHeight: 1.5,
              }}
            >
              These students are medically unfit to undergo training and community services. They will undergo Modular Distance Learning (MDL)
            </p>
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: '0 0 16px',
              color: 'var(--text-primary)',
            }}
          >
            Total Medically Unfit
          </h2>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
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
              placeholder="Search student.."
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

          {/* Student List */}
          <div style={{ marginBottom: '24px' }}>
            {filtered.map((student) => (
              <div
                key={student.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 18px',
                  background: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '10px',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'var(--sidebar-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={22} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <h4
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      margin: '0 0 3px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {student.name}
                  </h4>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: '0 0 2px',
                      fontWeight: 500,
                    }}
                  >
                    {student.course} / {student.year}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                    }}
                  >
                    {student.component}
                  </p>
                </div>
                <button
                  style={{
                    padding: '7px 24px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--maroon)',
                    background: 'transparent',
                    color: 'var(--maroon)',
                    fontSize: '13px',
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
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--maroon)';
                  }}
                >
                  View
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No students found.
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--sidebar-bg)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Download size={18} /> Export Unfit List
          </button>
        </div>
      </main>
    </div>
  );
}
