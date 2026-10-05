const Program = require('../models/Program');
const Brigade = require('../models/Brigade');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields } = require('../utils/validate');
const { PROGRAMS, CAMPUSES } = require('../config/constants');

/**
 * GET /api/programs — public (no auth): the trainee registration screen
 * fetches this before a JWT exists, to populate the course dropdown
 * dynamically instead of a hardcoded list. Lightweight by design — no
 * counts, just the program + its paired brigade name.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.nstpProgram && PROGRAMS.includes(req.query.nstpProgram)) {
    filter.nstpProgram = req.query.nstpProgram;
  }
  if (req.query.status) filter.status = req.query.status;

  const programs = await Program.find(filter)
    .populate('brigadeId', 'name status')
    .sort({ name: 1 });

  res.json({ success: true, count: programs.length, data: programs });
});

/** GET /api/programs/:id — admin-only, includes live student/officer counts. */
exports.get = asyncHandler(async (req, res) => {
  const program = await Program.findById(req.params.id).populate('brigadeId');
  if (!program) throw ApiError.notFound('Program not found.');

  const trainees = program.nstpProgram === 'ROTC' ? Cadet : Student;
  const [studentCount, officerCount] = await Promise.all([
    trainees.countDocuments({ programId: program._id }),
    Officer.countDocuments({ brigadeId: program.brigadeId }),
  ]);

  res.json({ success: true, data: { program, studentCount, officerCount } });
});

/**
 * POST /api/programs — admin-only. Creates the Program and its paired
 * Brigade together in one call, since the relationship is strictly 1:1.
 */
exports.create = asyncHandler(async (req, res) => {
  const { name, code, nstpProgram, brigadeName, campus = null } = req.body;
  requireFields(req.body, ['name', 'code', 'nstpProgram', 'brigadeName']);

  if (!PROGRAMS.includes(nstpProgram)) {
    throw ApiError.badRequest(`nstpProgram must be one of: ${PROGRAMS.join(', ')}.`);
  }
  if (campus && !CAMPUSES.includes(campus)) {
    throw ApiError.badRequest(`campus must be one of: ${CAMPUSES.join(', ')}.`);
  }

  const existing = await Program.findOne({
    code: String(code).trim().toUpperCase(),
    nstpProgram,
  });
  if (existing) {
    throw ApiError.conflict('A program with that code already exists for this NSTP program.');
  }

  const program = await Program.create({ name, code, nstpProgram, campus: campus || null, status: 'Active' });
  const brigade = await Brigade.create({
    name: brigadeName,
    programId: program._id,
    nstpProgram,
    status: 'Active',
  });
  program.brigadeId = brigade._id;
  await program.save();

  res.status(201).json({ success: true, data: { program, brigade } });
});

/**
 * PUT /api/programs/:id — admin-only. Edits the program's own fields and
 * (optionally) renames/re-statuses its paired brigade in the same request.
 */
exports.update = asyncHandler(async (req, res) => {
  const program = await Program.findById(req.params.id);
  if (!program) throw ApiError.notFound('Program not found.');

  if (req.body.campus !== undefined && req.body.campus && !CAMPUSES.includes(req.body.campus)) {
    throw ApiError.badRequest(`campus must be one of: ${CAMPUSES.join(', ')}.`);
  }

  ['name', 'code', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) program[field] = req.body[field];
  });
  if (req.body.campus !== undefined) program.campus = req.body.campus || null;
  await program.save();

  if (program.brigadeId && (req.body.brigadeName !== undefined || req.body.brigadeStatus !== undefined)) {
    const brigade = await Brigade.findById(program.brigadeId);
    if (brigade) {
      if (req.body.brigadeName !== undefined) brigade.name = req.body.brigadeName;
      if (req.body.brigadeStatus !== undefined) brigade.status = req.body.brigadeStatus;
      await brigade.save();
    }
  }

  res.json({ success: true, data: program });
});

/**
 * DELETE /api/programs/:id — system_maintenance_admin only. Refused if any
 * student, cadet, or officer is still assigned to the paired brigade —
 * archive (PUT status: 'Inactive') is the safe everyday path; this is only
 * for cleaning up a program that was created by mistake and never used.
 */
exports.remove = asyncHandler(async (req, res) => {
  const program = await Program.findById(req.params.id);
  if (!program) throw ApiError.notFound('Program not found.');

  const trainees = program.nstpProgram === 'ROTC' ? Cadet : Student;
  const [studentCount, officerCount] = await Promise.all([
    trainees.countDocuments({ programId: program._id }),
    program.brigadeId ? Officer.countDocuments({ brigadeId: program.brigadeId }) : 0,
  ]);
  if (studentCount > 0 || officerCount > 0) {
    throw ApiError.conflict(
      'This program still has students or officers assigned to its brigade. Archive it instead of deleting.'
    );
  }

  if (program.brigadeId) await Brigade.findByIdAndDelete(program.brigadeId);
  await program.deleteOne();

  res.json({ success: true, message: 'Program deleted.' });
});
