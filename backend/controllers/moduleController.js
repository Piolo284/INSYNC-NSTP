const ModuleModel = require('../models/Module');
const Submission = require('../models/Submission');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');
const { publicUrl } = require('../middleware/upload');
const { notifyUsers } = require('../utils/notify');

function parseJsonish(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseList(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/\r?\n|;/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * GET /api/modules
 * When called by a trainee, each module is annotated with that trainee's own
 * submission status ("To Do" / "Submitted" / "Graded" / "Missing") so the
 * Activities tab can render without a second request.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.program) filter.program = req.query.program;
  else if (['student', 'cadet'].includes(req.user.role)) filter.program = req.user.program;

  if (req.query.status) filter.status = req.query.status;
  if (req.query.moduleCode && req.query.moduleCode !== 'All Modules') {
    filter.moduleCode = req.query.moduleCode;
  }
  if (req.query.withDeadline === 'true') filter.deadline = { $ne: null };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }

  const modules = await ModuleModel.find(filter)
    .populate('createdBy', 'name role')
    .sort({ deadline: 1, createdAt: -1 });

  const moduleIds = modules.map((m) => m._id);
  const now = new Date();

  // Per-module submission counts (officer view) and the caller's own status.
  const [counts, mine] = await Promise.all([
    Submission.aggregate([
      { $match: { moduleId: { $in: moduleIds } } },
      {
        $group: {
          _id: '$moduleId',
          submitted: { $sum: 1 },
          graded: { $sum: { $cond: [{ $eq: ['$status', 'Graded'] }, 1, 0] } },
        },
      },
    ]),
    Submission.find({ moduleId: { $in: moduleIds }, studentId: req.user._id }),
  ]);

  const countMap = new Map(counts.map((c) => [String(c._id), c]));
  const mineMap = new Map(mine.map((s) => [String(s.moduleId), s]));

  const totalTrainees = await User.countDocuments({
    role: { $in: ['student', 'cadet'] },
    ...(filter.program ? { program: filter.program } : {}),
    status: 'Active',
  });

  res.json({
    success: true,
    count: modules.length,
    data: modules.map((m) => {
      const c = countMap.get(String(m._id)) || { submitted: 0, graded: 0 };
      const own = mineMap.get(String(m._id));
      let myStatus = 'To Do';
      if (own) myStatus = own.status;
      else if (m.deadline && m.deadline < now) myStatus = 'Missing';

      return {
        ...m.toObject(),
        submittedCount: c.submitted,
        gradedCount: c.graded,
        totalTrainees,
        percentage: totalTrainees
          ? Math.round((c.submitted / totalTrainees) * 100)
          : 0,
        mySubmission: own || null,
        myStatus,
      };
    }),
  });
});

/** GET /api/modules/:id */
exports.get = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id).populate('createdBy', 'name role');
  if (!module) throw ApiError.notFound('Module not found.');

  const mine = await Submission.findOne({ moduleId: module._id, studentId: req.user._id });
  const submittedCount = await Submission.countDocuments({ moduleId: module._id });

  res.json({
    success: true,
    data: { ...module.toObject(), mySubmission: mine, submittedCount },
  });
});

/** POST /api/modules */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title']);
  assertEnum(req.body.program, PROGRAMS, 'program');

  const program = req.body.program || req.user.program || 'CWTS';
  const file = req.file;

  const module = await ModuleModel.create({
    title: req.body.title,
    description: req.body.description || '',
    program,
    moduleCode: req.body.moduleCode || '',
    section: req.body.section || '',
    fileUrl: file ? publicUrl('modules', file.filename) : req.body.fileUrl || '',
    fileName: file ? file.originalname : req.body.fileName || '',
    fileSize: file ? file.size : Number(req.body.fileSize) || 0,
    instructions: parseList(req.body.instructions) || [],
    deadline: req.body.deadline ? new Date(req.body.deadline) : null,
    totalPoints: Number(req.body.totalPoints) || 100,
    rubrics: parseJsonish(req.body.rubrics, []),
    status: req.body.status || 'Open',
    createdBy: req.user._id,
  });

  // Let the class know a new module is available.
  const trainees = await User.find({
    role: program === 'ROTC' ? 'cadet' : 'student',
    program,
    status: 'Active',
  }).select('_id');

  await notifyUsers(
    trainees.map((t) => t._id),
    {
      title: 'New module posted',
      message: module.title,
      type: 'module',
      data: { moduleId: module._id },
    }
  );

  res.status(201).json({ success: true, data: module });
});

/** PUT /api/modules/:id */
exports.update = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');
  assertEnum(req.body.program, PROGRAMS, 'program');

  ['title', 'description', 'program', 'moduleCode', 'section', 'status'].forEach((f) => {
    if (req.body[f] !== undefined) module[f] = req.body[f];
  });

  if (req.body.deadline !== undefined) {
    module.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
  }
  if (req.body.totalPoints !== undefined) {
    module.totalPoints = Number(req.body.totalPoints) || module.totalPoints;
  }
  if (req.body.rubrics !== undefined) {
    module.rubrics = parseJsonish(req.body.rubrics, module.rubrics);
  }
  const instructions = parseList(req.body.instructions);
  if (instructions) module.instructions = instructions;

  if (req.file) {
    module.fileUrl = publicUrl('modules', req.file.filename);
    module.fileName = req.file.originalname;
    module.fileSize = req.file.size;
  }

  await module.save();
  res.json({ success: true, data: module });
});

/** DELETE /api/modules/:id */
exports.remove = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');

  await Submission.deleteMany({ moduleId: module._id });
  await module.deleteOne();

  res.json({ success: true, message: 'Module and its submissions deleted.' });
});

/** GET /api/modules/:id/submissions */
exports.submissions = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');

  const filter = { moduleId: module._id };
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;

  const submissions = await Submission.find(filter)
    .populate('studentId', 'name studentId program section yearLevel profileImage email')
    .sort({ submittedAt: -1 });

  res.json({
    success: true,
    count: submissions.length,
    stats: {
      submitted: submissions.filter((s) => s.status === 'Submitted').length,
      graded: submissions.filter((s) => s.status === 'Graded').length,
    },
    data: submissions,
  });
});
