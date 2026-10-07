/* eslint-disable no-console */
/**
 * Generates an NSTP masterlist file (.xlsx + .csv) ready for upload in the
 * admin panel (Masterlist → Upload, POST /api/master-enrollment/upload).
 *
 * Student Number format:  YY + C + NNNN
 *   YY   = last 2 digits of the academic year the student enrolled
 *          (AY 2026-2027 → "26", AY 2023-2024 → "23")
 *   C    = campus letter: B = Boac (Main), S = Sta. Cruz, G = Gasan, T = Torrijos
 *   NNNN = the student's enrollment number at that campus for that year,
 *          4 digits (the 1st enrollee is 0001, the 1000th is 1000)
 *   e.g. 26B0001, 26S0042, 23B1000
 *
 * Usage (from backend/):
 *   node scripts/generateMasterlist.js                 # AY 2026-2027, default counts
 *   node scripts/generateMasterlist.js --year 2023     # AY 2023-2024 → "23..." IDs
 *   node scripts/generateMasterlist.js --boac 300 --stacruz 80 --gasan 60 --torrijos 60
 *
 * The data is generated (realistic but fictional) and reproducible — the
 * same options always produce the same list.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { collegeFor } = require('../config/colleges');

// ---- options ----
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const START_YEAR = Number(opt('year', 2026));
const ACADEMIC_YEAR = `${START_YEAR}-${START_YEAR + 1}`;
const YY = String(START_YEAR).slice(-2);
const OUT_DIR = path.resolve(opt('out', path.join(__dirname, '..', '..', 'masterlist')));

/**
 * Campus → ID letter, the courses that campus offers (matching the
 * college/campus mapping used by the system's programs), and how many
 * enrollees to generate.
 */
const CAMPUSES = [
  {
    name: 'MARSU - Boac (Main)',
    letter: 'B',
    count: Number(opt('boac', 240)),
    courses: [
      'BS Information Technology',
      'BS Computer Science',
      'BS Information Systems',
      'BS Business Administration',
      'BS Accountancy',
      'BS Civil Engineering',
      'BS Electrical Engineering',
      'BS Mechanical Engineering',
      'BS Nursing',
      'Bachelor of Elementary Education',
      'Bachelor of Secondary Education',
      'BA Communication',
      'BA Political Science',
      'Bachelor of Public Administration',
      'BS Environmental Science',
      'BS Industrial Technology',
      'BS Criminology',
    ],
  },
  {
    name: 'MARSU - Sta. Cruz',
    letter: 'S',
    count: Number(opt('stacruz', 80)),
    courses: ['BS Tourism Management', 'BS Hospitality Management'],
  },
  {
    name: 'MARSU - Gasan',
    letter: 'G',
    count: Number(opt('gasan', 60)),
    courses: ['BS Fisheries'],
  },
  {
    name: 'MARSU - Torrijos',
    letter: 'T',
    count: Number(opt('torrijos', 60)),
    courses: ['BS Agriculture', 'BS Agribusiness'],
  },
];

// NSTP (CWTS/ROTC) is a first-year subject.
const YEAR_LEVEL = '1st Year';

const FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Angela', 'John Paul', 'Kristine', 'Carlo', 'Princess',
  'Miguel', 'Camille', 'Joshua', 'Nicole', 'Christian', 'Jasmine', 'Rafael', 'Andrea', 'Paolo', 'Bea',
  'Gabriel', 'Patricia', 'Daniel', 'Katrina', 'Adrian', 'Mae', 'Kenneth', 'Rhea', 'Jerome', 'Liza',
  'Vincent', 'Shiela', 'Arnel', 'Jenny', 'Ronald', 'Grace', 'Francis', 'Joy', 'Ramon', 'Clarisse',
  'Joel', 'Hazel', 'Allan', 'Lovely', 'Dominic', 'Erika', 'Renz', 'Trisha', 'Aldrin', 'Mylene',
];
const MIDDLE_INITIALS = 'ABCDEFGHIJLMNOPRSTV'.split('');
const LAST_NAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Villanueva', 'Ramos', 'Castillo', 'Navarro', 'Bautista',
  'Fernandez', 'Torres', 'Lopez', 'Aquino', 'Salazar', 'Manalo', 'Rosales', 'Pastor', 'Lim', 'Morales',
  'Malabanan', 'Sadiwa', 'Leva', 'Lagran', 'Madrigal', 'Monteagudo', 'Pelaez', 'Jamilla', 'Larracas', 'Rejano',
  'Sales', 'Lacdao', 'Mampusti', 'Seño', 'Rey', 'Saguid', 'Manoos', 'Muhi', 'Pornillos', 'Ricafort',
];

// Small deterministic PRNG so the list is reproducible.
let seed = START_YEAR * 7919;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const emailPart = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function generate() {
  const rows = [];
  const usedNames = new Set();
  const usedEmails = new Set();

  for (const campus of CAMPUSES) {
    if (campus.count > 9999) throw new Error(`${campus.name}: at most 9999 enrollees fit in 4 digits.`);
    for (let n = 1; n <= campus.count; n += 1) {
      let first;
      let middle;
      let last;
      let fullName;
      do {
        first = pick(FIRST_NAMES);
        middle = pick(MIDDLE_INITIALS);
        last = pick(LAST_NAMES);
        fullName = `${first} ${middle}. ${last}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      let email = `${emailPart(first)}.${emailPart(last)}@marsu.edu.ph`;
      for (let k = 2; usedEmails.has(email); k += 1) {
        email = `${emailPart(first)}.${emailPart(last)}${k}@marsu.edu.ph`;
      }
      usedEmails.add(email);

      rows.push({
        studentNumber: `${YY}${campus.letter}${String(n).padStart(4, '0')}`,
        fullName,
        email,
        // The Program is the student's college (config/colleges.js); the
        // course list above only decides which college they fall under.
        courseProgram: collegeFor(campus.courses[(n - 1) % campus.courses.length]).name,
        campus: campus.name,
        year: YEAR_LEVEL,
      });
    }
  }
  return rows;
}

const HEADERS = [
  ['studentNumber', 'Student Number'],
  ['fullName', 'Full Name'],
  ['email', 'Email'],
  ['courseProgram', 'Program'],
  ['campus', 'Campus'],
  ['year', 'Year'],
];

async function main() {
  const rows = generate();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `MARSU_NSTP_Masterlist_AY${ACADEMIC_YEAR}`);

  // CSV
  const csvCell = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const csv = [HEADERS.map(([, h]) => h).join(',')]
    .concat(rows.map((r) => HEADERS.map(([k]) => csvCell(r[k])).join(',')))
    .join('\r\n');
  fs.writeFileSync(`${base}.csv`, `${csv}\r\n`, 'utf8');

  // Excel
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`AY ${ACADEMIC_YEAR}`);
  ws.columns = HEADERS.map(([key, header]) => ({
    key,
    header,
    width: { studentNumber: 16, fullName: 30, email: 34, courseProgram: 46, campus: 22, year: 10 }[key],
  }));
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B1F1F' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'F1' };
  await wb.xlsx.writeFile(`${base}.xlsx`);

  console.log(`Academic year ${ACADEMIC_YEAR} → ID prefix "${YY}"`);
  for (const c of CAMPUSES) {
    console.log(`  ${c.name.padEnd(22)} ${YY}${c.letter}0001 – ${YY}${c.letter}${String(c.count).padStart(4, '0')}  (${c.count} students)`);
  }
  console.log(`Total: ${rows.length} students`);
  console.log(`Wrote ${base}.xlsx`);
  console.log(`Wrote ${base}.csv`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
