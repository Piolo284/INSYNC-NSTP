const Brigade = require('../models/Brigade');
const Officer = require('../models/Officer');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { PROGRAMS } = require('../config/constants');

/**
 * GET /api/brigades — admin/officer only. Brigades are only ever created
 * paired with a Program (see programController.create), so there is no
 * standalone POST here — that keeps "one program = one brigade" true by
 * construction instead of by extra validation. Used for the officer
 * assignment dropdown (admin) and the QR session brigade field (admin).
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.nstpProgram && PROGRAMS.includes(req.query.nstpProgram)) {
    filter.nstpProgram = req.query.nstpProgram;
  }
  if (req.query.status) filter.status = req.query.status;

  const brigades = await Brigade.find(filter).populate('programId', 'name code').sort({ name: 1 });
  res.json({ success: true, count: brigades.length, data: brigades });
});

/** GET /api/brigades/:id — includes live officer/student counts (spec: "View brigade statistics"). */
exports.get = asyncHandler(async (req, res) => {
  const brigade = await Brigade.findById(req.params.id).populate('programId');
  if (!brigade) throw ApiError.notFound('Brigade not found.');

  const trainees = brigade.nstpProgram === 'ROTC' ? Cadet : Student;
  const [officerCount, studentCount, officers] = await Promise.all([
    Officer.countDocuments({ brigadeId: brigade._id }),
    trainees.countDocuments({ brigadeId: brigade._id }),
    Officer.find({ brigadeId: brigade._id }).select('fullName email position status'),
  ]);

  res.json({ success: true, data: { brigade, officerCount, studentCount, officers } });
});

/** PUT /api/brigades/:id — rename or archive/reactivate. */
exports.update = asyncHandler(async (req, res) => {
  const brigade = await Brigade.findById(req.params.id);
  if (!brigade) throw ApiError.notFound('Brigade not found.');

  ['name', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) brigade[field] = req.body[field];
  });
  await brigade.save();

  res.json({ success: true, data: brigade });
});
