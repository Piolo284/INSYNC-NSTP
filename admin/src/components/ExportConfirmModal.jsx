import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { exportRowsToExcel, exportRowsToPdf } from '../utils/exportFile';
import { errorMessage } from '../hooks/useApi';

/**
 * Shared "pick a format, confirm, then export" modal — used everywhere a
 * page offers to export a table of records as Excel or PDF, so every export
 * flow in the admin panel has the same preview-then-confirm step instead of
 * downloading immediately on click.
 *
 * `columns`: [{ header, key }]. `rows`: plain objects keyed by column `key`
 * (already formatted strings — the same values shown in the on-screen
 * preview table, so what's confirmed is exactly what gets exported).
 */
export default function ExportConfirmModal({ title, description, filenameBase, columns, rows, onClose }) {
  const [format, setFormat] = useState('excel');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');
    setExporting(true);
    try {
      if (format === 'excel') {
        await exportRowsToExcel({ filename: `${filenameBase}.xlsx`, sheetTitle: title, columns, rows });
      } else {
        exportRowsToPdf({
          filename: `${filenameBase}.pdf`,
          title,
          subtitle: `${description} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          columns,
          rows,
        });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Unable to generate that file.'));
      setExporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={exporting ? undefined : onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '28px', width: 'min(460px, 100%)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Export {title}</h3>
          {!exporting && <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{description}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <FormatOption icon={FileSpreadsheet} label="Excel (.xlsx)" active={format === 'excel'} onClick={() => setFormat('excel')} />
          <FormatOption icon={FileText} label="PDF (.pdf)" active={format === 'pdf'} onClick={() => setFormat('pdf')} />
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" disabled={exporting} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.7 : 1 }}>Cancel</button>
          <button type="button" disabled={exporting} onClick={handleConfirm} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--maroon)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.7 : 1 }}>
            <Download size={15} /> {exporting ? 'Exporting...' : 'Confirm & Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormatOption({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px',
        borderRadius: '10px', border: active ? '1.5px solid var(--maroon)' : '1.5px solid var(--border)',
        background: active ? '#FDF2F4' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <Icon size={22} color={active ? 'var(--maroon)' : 'var(--text-secondary)'} />
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: active ? 'var(--maroon)' : 'var(--text-primary)' }}>{label}</span>
    </button>
  );
}
