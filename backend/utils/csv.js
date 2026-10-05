/**
 * Minimal RFC4180-ish CSV parser — good enough for admin-uploaded rosters
 * (quoted fields, embedded commas, "" for a literal quote inside a quoted
 * field). No external dependency needed for a format this simple.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  const input = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  // Trailing field/row if the file doesn't end with a newline.
  if (field.length || row.length) pushRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Parses a CSV with a header row into an array of plain objects keyed by
 * the (trimmed, lowercased) header — so callers can look up columns by
 * name without caring about their exact casing/spacing in the source file.
 */
function parseCsvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] || '').trim();
    });
    return obj;
  });
}

module.exports = { parseCsv, parseCsvToObjects };
