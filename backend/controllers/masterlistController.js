const path = require('path');
const ExcelJS = require('exceljs');
const Masterlist = require('../models/Masterlist');
const MasterlistImport = require('../models/MasterlistImport');
const User = require('../models/User');
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

// The six columns every Master List file must have, with the header names
// each one accepts (compared lowercased).
const REQUIRED_COLUMNS = [
  ['Student ID', ID_KEYS],
  ['Full Name', NAME_KEYS],
  ['Email', EMAIL_KEYS],
  ['Program', COURSE_KEYS],
  ['Campus', CAMPUS_KEYS],
  ['Year Level', YEAR_KEYS],
];

const MAX_IMPORT_ROWS = 20000;
const PREVIEW_ROW_LIMIT = 5;
const INVALID_ROW_LIMIT = 500;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_NUMBER_RX = /^[A-Z0-9][A-Z0-9-]{2,29}$/;
const COMPARED_FIELDS = ['fullName', 'email', 'courseProgram', 'campus', 'academicYear'];
const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

function pick(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '';
}

/**
 * Maps the common ways a registrar file writes a year level ("1", "1st",
 * "First Year", "1st yr") onto the four canonical values. Returns '' for
 * anything else so the row is rejected rather than stored as free text.
 */
function normalizeYearLevel(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return '';
  const words = { first: 1, second: 2, third: 3, fourth: 4 };
  const m = v.match(/^([1-4])(?:st|nd|rd|th)?(?: (?:year|yr)\.?)?$/) || v.match(/^(first|second|third|fourth)(?: (?:year|yr)\.?)?$/);
  if (!m) return '';
  const n = words[m[1]] || Number(m[1]);
  return YEAR_LEVELS[n - 1];
}

/** Trims + validates one student's six fields (shared by add and edit). */
function cleanStudentFields(body) {
  const fields = {
    studentNumber: String(body.studentNumber || '').trim().toUpperCase(),
    fullName: String(body.fullName || '').trim().replace(/\s+/g, ' '),
    email: String(body.email || '').trim().toLowerCase(),
    courseProgram: String(body.courseProgram || '').trim(),
    campus: String(body.campus || '').trim(),
    academicYear: normalizeYearLevel(body.academicYear),
  };
  if (!STUDENT_NUMBER_RX.test(fields.studentNumber)) {
    throw ApiError.badRequest('Student ID may only contain letters, numbers and dashes (3-30 characters).');
  }
  if (!fields.fullName) throw ApiError.badRequest('Full Name is required.');
  if (!EMAIL_RX.test(fields.email)) throw ApiError.badRequest('Please enter a valid email address.');
  if (!fields.courseProgram) throw ApiError.badRequest('Program is required.');
  if (!fields.campus) throw ApiError.badRequest('Campus is required.');
  if (!fields.academicYear) throw ApiError.badRequest('Year Level must be 1st, 2nd, 3rd or 4th Year.');
  return fields;
}

/**
 * Reads the first worksheet of an .xlsx workbook into the same shape
 * parseCsvToObjects produces — plain objects keyed by the (trimmed,
 * lowercased) header row — so the import handlers below don't care which
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

/** Reads the uploaded roster into header-keyed row objects (CSV or .xlsx). */
async function parseRosterFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.xlsx') return { fileType: 'xlsx', rows: await parseExcelToObjects(file.buffer) };
  if (ext === '.csv') return { fileType: 'csv', rows: parseCsvToObjects(file.buffer.toString('utf8')) };
  if (ext === '.xls') {
    throw ApiError.badRequest('Old .xls files can\'t be read. Open the file in Excel and save it as .xlsx or .csv.');
  }
  throw ApiError.badRequest('Unsupported file type. Please upload an .xlsx or .csv file.');
}

/**
 * Validates every row of an uploaded roster. Returns the clean rows plus the
 * rejected ones with a reason, so the preview shows exactly what will and
 * won't be imported. Name, Student ID, Email, Course, Campus and Year are all
 * required (see models/Masterlist.js). A Student Number appearing twice in
 * the same file keeps its first row; later copies are rejected as duplicates.
 */
function validateRows(rawRows) {
  const valid = [];
  const invalid = [];
  const firstRowFor = new Map();

  rawRows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 for the header row, +1 for 1-based numbering
    const rec = {
      rowNumber,
      studentNumber: pick(row, ID_KEYS).trim().toUpperCase(),
      fullName: pick(row, NAME_KEYS).trim().replace(/\s+/g, ' '),
      email: pick(row, EMAIL_KEYS).trim().toLowerCase(),
      courseProgram: pick(row, COURSE_KEYS).trim(),
      campus: pick(row, CAMPUS_KEYS).trim(),
      academicYear: pick(row, YEAR_KEYS).trim(),
    };
    const reject = (reason) =>
      invalid.push({ rowNumber, studentNumber: rec.studentNumber, fullName: rec.fullName, reason });

    const missing = [
      ['studentNumber', 'Student ID'],
      ['fullName', 'Full Name'],
      ['email', 'Email'],
      ['courseProgram', 'Program'],
      ['campus', 'Campus'],
      ['academicYear', 'Year Level'],
    ]
      .filter(([key]) => !rec[key])
      .map(([, label]) => label);
    if (missing.length) return reject(`Missing ${missing.join(', ')}`);
    if (!STUDENT_NUMBER_RX.test(rec.studentNumber)) {
      return reject('Student ID may only contain letters, numbers and dashes');
    }
    if (!EMAIL_RX.test(rec.email)) return reject('Invalid email address');
    const year = normalizeYearLevel(rec.academicYear);
    if (!year) return reject('Year Level must be 1st, 2nd, 3rd or 4th Year');
    rec.academicYear = year;
    if (firstRowFor.has(rec.studentNumber)) {
      return reject(`Duplicate Student ID (same as row ${firstRowFor.get(rec.studentNumber)})`);
    }
    firstRowFor.set(rec.studentNumber, rowNumber);
    valid.push(rec);
  });

  return { valid, invalid };
}

/**
 * Compares validated rows with what's already on the masterlist (matched by
 * Student ID): which students are new, which existing ones change, and which
 * are identical.
 */
async function diffAgainstMasterlist(rows) {
  const numbers = rows.map((r) => r.studentNumber);
  const existing = await Masterlist.find({ studentNumber: { $in: numbers } }).lean();
  const byNumber = new Map(existing.map((e) => [e.studentNumber, e]));

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const annotated = rows.map((r) => {
    const prev = byNumber.get(r.studentNumber);
    if (!prev) {
      added += 1;
      return { ...r, change: 'New' };
    }
    const changed =
      COMPARED_FIELDS.some((f) => String(prev[f] || '') !== String(r[f] || '')) || prev.inCurrentList === false;
    if (changed) {
      updated += 1;
      return { ...r, change: 'Updated' };
    }
    unchanged += 1;
    return { ...r, change: 'Unchanged' };
  });

  return { annotated, counts: { added, updated, unchanged } };
}

/**
 * POST /api/master-enrollment/import/preview
 * Step 1: parse + validate the CSV/.xlsx and stage it as a Pending import.
 * Nothing on the masterlist changes until the admin confirms.
 */
exports.previewImport = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please choose an .xlsx or .csv file.');

  let parsed;
  try {
    parsed = await parseRosterFile(req.file);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('That file could not be read. Make sure it is a valid .xlsx or .csv file.');
  }
  const { fileType, rows: rawRows } = parsed;

  if (!rawRows.length) {
    throw ApiError.badRequest('The file has no student rows. Use the template and fill in one student per row.');
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(`That file has ${rawRows.length} rows; the maximum per upload is ${MAX_IMPORT_ROWS}.`);
  }
  const headers = Object.keys(rawRows[0]);
  const missingColumns = REQUIRED_COLUMNS.filter(([, keys]) => !keys.some((k) => headers.includes(k))).map(
    ([label]) => label
  );
  if (missingColumns.length) {
    throw ApiError.badRequest(
      `Missing column${missingColumns.length > 1 ? 's' : ''}: ${missingColumns.join(', ')}. Download the template to see the required headers.`
    );
  }

  const { valid, invalid } = validateRows(rawRows);
  if (!valid.length) {
    throw ApiError.badRequest(
      `No rows can be imported. Row ${invalid[0].rowNumber}: ${invalid[0].reason}.`
    );
  }

  const { annotated, counts } = await diffAgainstMasterlist(valid);

  // Only one staged upload at a time — an older unconfirmed preview is
  // superseded by this one.
  await MasterlistImport.updateMany(
    { status: 'Pending' },
    { $set: { status: 'Cancelled', rows: [], errorMessage: 'Superseded by a newer upload before it was confirmed.' } }
  );

  const importDoc = await MasterlistImport.create({
    fileName: req.file.originalname,
    fileType,
    importedBy: req.user._id,
    status: 'Pending',
    counts: {
      totalRows: rawRows.length,
      valid: valid.length,
      invalid: invalid.length,
      ...counts,
    },
    rows: valid,
    invalidRows: invalid.slice(0, INVALID_ROW_LIMIT),
  });

  const importJson = importDoc.toObject();
  delete importJson.rows;
  delete importJson.invalidRows;

  res.status(201).json({
    success: true,
    message: `${valid.length} row(s) ready to import, ${invalid.length} with errors.`,
    data: {
      import: importJson,
      previewRows: annotated.slice(0, PREVIEW_ROW_LIMIT),
      invalidRows: invalid.slice(0, INVALID_ROW_LIMIT),
      invalidTruncated: invalid.length > INVALID_ROW_LIMIT,
    },
  });
});

/**
 * POST /api/master-enrollment/import/:id/confirm
 * Step 2: applies a staged import. Students in the file are added or updated
 * (matched by Student ID, never duplicated). Students already on the list
 * but absent from this file are left exactly as they are — removing anyone
 * is always an explicit admin action (delete / clear).
 */
exports.confirmImport = asyncHandler(async (req, res) => {
  // Pending -> Processing atomically, so a double-click can't apply twice.
  const importDoc = await MasterlistImport.findOneAndUpdate(
    { _id: req.params.id, status: 'Pending' },
    { $set: { status: 'Processing' } },
    { new: true }
  ).select('+rows');
  if (!importDoc) {
    const exists = await MasterlistImport.findById(req.params.id).select('status');
    if (!exists) throw ApiError.notFound('Import not found.');
    throw ApiError.conflict(`This upload is already ${exists.status.toLowerCase()}.`);
  }

  try {
    const rows = importDoc.rows.map((r) => (r.toObject ? r.toObject() : r));
    // Re-diffed now rather than trusted from the preview — the list may have
    // changed since (e.g. a student added by hand in between).
    const { counts } = await diffAgainstMasterlist(rows);

    const ops = rows.map((r) => ({
      updateOne: {
        filter: { studentNumber: r.studentNumber },
        update: {
          $set: {
            studentNumber: r.studentNumber,
            fullName: r.fullName,
            email: r.email,
            courseProgram: r.courseProgram,
            campus: r.campus,
            academicYear: r.academicYear,
            uploadedBy: req.user._id,
            inCurrentList: true,
            lastImportId: importDoc._id,
            removedFromListAt: null,
          },
        },
        upsert: true,
      },
    }));
    for (let i = 0; i < ops.length; i += 1000) {
      await Masterlist.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
    }

    await MasterlistImport.updateMany({ isCurrent: true }, { $set: { isCurrent: false } });
    importDoc.status = 'Completed';
    importDoc.isCurrent = true;
    importDoc.confirmedAt = new Date();
    importDoc.counts = { ...importDoc.counts.toObject(), ...counts, notInList: 0 };
    importDoc.rows = [];
    await importDoc.save();
  } catch (err) {
    await MasterlistImport.updateOne(
      { _id: importDoc._id },
      { $set: { status: 'Failed', errorMessage: err.message || 'Import failed.' } }
    );
    console.error('[masterlist] import failed:', err);
    throw ApiError.badRequest('The import could not be completed. Please try again.');
  }

  const saved = await MasterlistImport.findById(importDoc._id).select('-invalidRows');
  const { added, updated, invalid } = saved.counts;
  res.json({
    success: true,
    message: `${added} added, ${updated} updated, ${invalid} skipped.`,
    data: { added, updated, skipped: invalid, unchanged: saved.counts.unchanged, fileName: saved.fileName },
  });
});

/** POST /api/master-enrollment/import/:id/cancel — discard a staged upload. */
exports.cancelImport = asyncHandler(async (req, res) => {
  const importDoc = await MasterlistImport.findOneAndUpdate(
    { _id: req.params.id, status: 'Pending' },
    { $set: { status: 'Cancelled', rows: [] } },
    { new: true }
  );
  if (!importDoc) {
    throw ApiError.conflict('Only an import that is still waiting for confirmation can be cancelled.');
  }
  res.json({ success: true, message: 'Import cancelled. The Master List was not changed.', data: importDoc });
});

/** GET /api/master-enrollment/imports — import history, newest first. */
exports.listImports = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const imports = await MasterlistImport.find()
    .select('-invalidRows')
    .populate('importedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ success: true, count: imports.length, data: imports });
});

/** GET /api/master-enrollment/imports/:id — one import, incl. rejected rows. */
exports.getImport = asyncHandler(async (req, res) => {
  const importDoc = await MasterlistImport.findById(req.params.id).populate('importedBy', 'name email');
  if (!importDoc) throw ApiError.notFound('Import not found.');
  res.json({ success: true, data: importDoc });
});

/**
 * POST /api/master-enrollment — add a single student by hand, for the rare
 * student who needs to be added between registrar file uploads.
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['studentNumber', 'fullName', 'email', 'courseProgram', 'campus', 'academicYear']);
  const { studentNumber, ...fields } = cleanStudentFields(req.body);

  const existing = await Masterlist.findOne({ studentNumber });
  if (existing && existing.inCurrentList !== false) {
    throw ApiError.conflict(`Student ID ${studentNumber} is already on the masterlist.`);
  }
  if (existing) {
    Object.assign(existing, fields, { uploadedBy: req.user._id, inCurrentList: true, removedFromListAt: null });
    await existing.save();
    return res.json({ success: true, message: 'Student added.', data: existing });
  }

  const row = await Masterlist.create({ studentNumber, ...fields, uploadedBy: req.user._id });
  res.status(201).json({ success: true, message: 'Student added.', data: row });
});

/**
 * PUT /api/master-enrollment/:id — correct one student's details. Saving
 * also re-activates a student an older import had left out. The Student ID
 * can't be changed once a trainee account is registered under it, so the
 * account keeps matching its masterlist row.
 */
exports.update = asyncHandler(async (req, res) => {
  const row = await Masterlist.findById(req.params.id);
  if (!row) throw ApiError.notFound('Student not found.');
  const fields = cleanStudentFields(req.body);

  if (fields.studentNumber !== row.studentNumber) {
    const [taken, account] = await Promise.all([
      Masterlist.exists({ studentNumber: fields.studentNumber, _id: { $ne: row._id } }),
      User.exists({ studentId: row.studentNumber }),
    ]);
    if (taken) throw ApiError.conflict(`Student ID ${fields.studentNumber} is already on the masterlist.`);
    if (account) {
      throw ApiError.badRequest('This student already has a registered account, so the Student ID can\'t be changed.');
    }
  }

  Object.assign(row, fields, { inCurrentList: true, removedFromListAt: null });
  await row.save();
  res.json({ success: true, message: 'Student updated.', data: row });
});

/**
 * GET /api/master-enrollment — paginated search for the admin table.
 * `search` matches Student ID or Full Name; `page` is 1-based.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(q, 'i');
    filter.$or = [{ studentNumber: rx }, { fullName: rx }];
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [rows, matched, total, currentImport] = await Promise.all([
    Masterlist.find(filter).sort({ studentNumber: 1 }).skip((page - 1) * limit).limit(limit),
    Masterlist.countDocuments(filter),
    Masterlist.estimatedDocumentCount(),
    MasterlistImport.findOne({ isCurrent: true }).select('fileName confirmedAt createdAt'),
  ]);

  res.json({
    success: true,
    count: rows.length,
    matched,
    total,
    page,
    pages: Math.max(Math.ceil(matched / limit), 1),
    currentImport,
    data: rows,
  });
});

/** DELETE /api/master-enrollment/:id — remove a single entry. */
exports.remove = asyncHandler(async (req, res) => {
  const row = await Masterlist.findByIdAndDelete(req.params.id);
  if (!row) throw ApiError.notFound('Student not found.');
  res.json({ success: true, message: 'Student removed.' });
});

/** DELETE /api/master-enrollment — clears the whole list. */
exports.clear = asyncHandler(async (req, res) => {
  const result = await Masterlist.deleteMany({});
  // The import history stays, but no import is the Current Master List now.
  await MasterlistImport.updateMany({ isCurrent: true }, { $set: { isCurrent: false } });
  res.json({ success: true, message: `Removed ${result.deletedCount} entries.` });
});
