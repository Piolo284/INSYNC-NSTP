import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Neither Student/Cadet, Attendance, nor Grade records carry a real
 * school-year field anywhere in this system — the only school-year value
 * that exists at all is a free-text, unlinked column on Masterlist CSV/Excel
 * uploads. So "current" vs "previous" school year here is a date-range
 * proxy over each record's own date (createdAt for enrollment/grades, the
 * attendance date for attendance), anchored to MARSU's academic calendar
 * (school year starts August 1). It is a reasonable approximation, not a
 * ground-truth school-year field.
 */
function schoolYearRangeFor(startYear) {
  const start = new Date(startYear, 7, 1, 0, 0, 0);
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999);
  return { start, end, label: `${startYear}-${startYear + 1}` };
}

export function schoolYearRanges(now = new Date()) {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    current: schoolYearRangeFor(startYear),
    previous: schoolYearRangeFor(startYear - 1),
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** columns: [{ header, key }]; rows: array of plain objects keyed by `key`. */
export async function exportRowsToExcel({ filename, sheetTitle, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MARSU NSTP Admin';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetTitle.slice(0, 31) || 'Report');

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(c.header.length + 4, 14) }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9B1C43' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}

/** columns: [{ header, key }]; rows: array of plain objects keyed by `key`. */
export function exportRowsToPdf({ filename, title, subtitle, columns, rows }) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(subtitle, 14, 23);
  }
  autoTable(doc, {
    startY: subtitle ? 28 : 22,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => (row[c.key] ?? '').toString())),
    headStyles: { fillColor: [155, 28, 67] },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });
  doc.save(filename);
}
