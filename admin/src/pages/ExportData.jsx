import React from 'react';
import { Download, FileSpreadsheet, FileText, FileJson, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';

const exportOptions = [
  { id: 'csv', label: 'Export as CSV', desc: 'Download student data in CSV format for Excel', icon: FileSpreadsheet, color: '#059669', bg: '#ECFDF5' },
  { id: 'pdf', label: 'Export as PDF', desc: 'Generate a PDF report with all student records', icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  { id: 'json', label: 'Export as JSON', desc: 'Export raw data in JSON format for developers', icon: FileJson, color: '#2563EB', bg: '#EFF6FF' },
];

export default function ExportData() {
  const navigate = useNavigate();

  const handleExport = (type) => {
    alert(`Exporting data as ${type.toUpperCase()}...`);
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <TopBar title="Export Data" showBreadcrumb={true} />

      <main style={{ padding: '24px' }}>
        <button
          onClick={() => navigate('/students')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <ArrowLeft size={16} /> Back to Students
        </button>

        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius)',
            padding: '32px',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
            maxWidth: '700px',
          }}
        >
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              margin: '0 0 8px',
              color: 'var(--text-primary)',
            }}
          >
            Export Student Data
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: '0 0 28px',
            }}
          >
            Choose your preferred format to download the student records.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {exportOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleExport(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 24px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = opt.color;
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: opt.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} color={opt.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        margin: '0 0 4px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {opt.label}
                    </h4>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        margin: 0,
                      }}
                    >
                      {opt.desc}
                    </p>
                  </div>
                  <Download size={20} color="var(--text-secondary)" />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
