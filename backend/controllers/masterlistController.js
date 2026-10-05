const path = require('path');
const ExcelJS = require('exceljs');
const Masterlist = require('../models/Masterlist');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseCsvToObjects } = require('../utils/csv');
const { requireFields } = require('../utils/validate');

const ID_KEYS = ['studentnumber', 'student number', 'studentid', 'student id', 'id number', 'id no', 'idno', 'id'];
const NAME_KEYS = ['fullname', 'full name', 'name'];
const EMAIL_KEYS = ['email', 'email address', 'emailaddress'];
const COURSE_KEYS = ['courseprogram', 'course/program', 'course', 'program'];
const CAMPUS_KEYS = ['campus'];
const YEAR_KEYS = ['academicyear', 'academic year', 'year', 'yearlevel', 'year level'];
const SECTION_KEYS = ['section'];

const REQUIRED_FIELD_LABEL = 'Student Number, Full Name, Email, Course/Program, Campus, Year, or Section';

function pick(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '';
}

/**
 * Reads the first worksheet of an .xlsx workbook into the same shape
 * parseCsvToObjects produces — plain objects keyed by the (trimmed,
 * lowercased) header row — so the upload handler below doesn't care which
 * format the admin sent.
 */
async function parseExcelToObjects(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const cellText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (value.richText) return value.richText.map((t) => t.text).join('');
      if (value.text) return String(value.text);
      if (value.result !== undefined) return String(value.result);
      if (value instanceof Date) return value.toISOString().slice(0, 10);
    }
    return String(value).trim();
  };

  let headers = [];
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1).map(cellText);
    if (rowNumber === 1) {
      headers = values.map((h) => h.trim().toLowerCase());
      return;
    }
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim();
    });
    rows.push(obj);
  });

  return rows.filter((r) => Object.values(r).some((v) => v !== ''));
}

/**
 * POST /api/master-enrollment/upload
 * Admin uploads a CSV or Excel (.xlsx) export of the official NSTP
 * enrollment roster — one shared list used to validate both CWTS and ROTC
 * self-registration. Rows are upserted by Student Number; ?mode=replace
 * wipes the existing list first (a full refresh) instead of merging with
 * what's already there (the default).
 */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please attach a CSV or Excel file.');

  const ext = path.extname(req.file.originalname).toLowerCase();
  let rows;
  if (ext === '.xlsx') {
    rows = await parseExcelToObjects(req.file.buffer);
  } else if (ext === '.csv') {
    rows = parseCsvToObjects(req.file.buffer.toString('utf8'));
  } else {
    throw ApiError.badRequest(
      'Unsupported file type. Please upload a .csv or .xlsx file (legacy .xls is not supported — save it as .xlsx first).'
    );
  }
  if (!rows.length) {
    throw ApiError.badRequest(
      'No data rows were found in that file. Make sure the first row has column headers like "Student Number", "Full Name", "Email", "Course/Program", "Campus", "Year", "Section".'
    );
  }

  const mode = req.query.mode === 'replace' ? 'replace' : 'merge';
  if (mode === 'replace') {
    await Masterlist.deleteMany({});
  }

  let skipped = 0;
  const ops = [];
  for (const row of rows) {
    const studentNumber = pick(row, ID_KEYS).toUpperCase();
    const fullName = pick(row, NAME_KEYS);
    const email = pick(row, EMAIL_KEYS).toLowerCase();
    const courseProgram = pick(row, COURSE_KEYS);
    const campus = pick(row, CAMPUS_KEYS);
    const academicYear = pick(row, YEAR_KEYS);
    const section = pick(row, SECTION_KEYS);
    // Name, Student ID, Email, Course, Campus, Year, and Section are all
    // required — a row missing even one of them never makes it onto the
    // masterlist at all.
    if (!studentNumber || !fullName || !email || !courseProgram || !campus || !academicYear || !section) {
      skipped += 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { studentNumber },
        update: {
          $set: {
            studentNumber,
            fullName,
            email,
            courseProgram,
            campus,
            academicYear,
            section,
            uploadedBy: req.user._id,
          },
        },
        upsert: true,
      },
    });
  }

  let saved = 0;
  if (ops.length) {
    // Every op either creates a new row (upserted) or updates an existing
    // one it matched — either way it counts as "saved".
    const result = await Masterlist.bulkWrite(ops, { ordered: false });
    saved = (result.upsertedCount || 0) + (result.matchedCount || 0);
  }

  const total = await Masterlist.countDocuments();

  res.json({
    success: true,
    message: `Processed ${rows.length} row(s): ${saved} saved, ${skipped} skipped (missing ${REQUIRED_FIELD_LABEL}).`,
    data: { processed: rows.length, saved, skipped, total, mode },
  });
});

/**
 * POST /api/master-enrollment — add a single enrollee by hand, for the rare
 * student who needs to be added between registrar file uploads.
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['studentNumber', 'fullName', 'email', 'courseProgram', 'campus', 'academicYear', 'section']);

  const studentNumber = String(req.body.studentNumber).trim().toUpperCase();
  const existing = await Masterlist.findOne({ studentNumber });
  if (existing) {
    throw ApiError.badRequest(`Student Number ${studentNumber} is already on the masterlist.`);
  }

  const row = await Masterlist.create({
    studentNumber,
    fullName: String(req.body.fullName).trim(),
    email: String(req.body.email).trim().toLowerCase(),
    courseProgram: String(req.body.courseProgram).trim(),
    campus: String(req.body.campus).trim(),
    academicYear: String(req.body.academicYear).trim(),
    section: String(req.body.section).trim(),
    uploadedBy: req.user._id,
  });

  res.status(201).json({ success: true, message: 'Entry added.', data: row });
});

/** GET /api/master-enrollment — search/list, for the admin panel table. */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(q, 'i');
    filter.$or = [{ studentNumber: rx }, { fullName: rx }];
  }
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const [rows, total] = await Promise.all([
    Masterlist.find(filter).sort({ studentNumber: 1 }).limit(limit),
    Masterlist.countDocuments(),
  ]);

  res.json({ success: true, count: rows.length, total, data: rows });
});

/** DELETE /api/master-enrollment/:id — remove a single entry. */
exports.remove = asyncHandler(async (req, res) => {
  const row = await Masterlist.findByIdAndDelete(req.params.id);
  if (!row) throw ApiError.notFound('Entry not found.');
  res.json({ success: true, message: 'Entry removed.' });
});

/** DELETE /api/master-enrollment — clears the whole list. */
exports.clear = asyncHandler(async (req, res) => {
  const result = await Masterlist.deleteMany({});
  res.json({ success: true, message: `Removed ${result.deletedCount} entries.` });
});
