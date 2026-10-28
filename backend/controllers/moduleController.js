const ModuleModel = require('../models/Module');
const Submission = require('../models/Submission');
const PrivateComment = require('../models/PrivateComment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS, TRAINEE_ROLES } = require('../config/constants');
const { announceModule, removeLinkedAnnouncements } = require('../utils/linkedAnnouncement');
const { parseDeadline, isPastDeadline } = require('../utils/deadline');
const { standingForUser } = require('../utils/attendanceStanding');
const {
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
} = require('../utils/programScope');

function parseJsonish(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const MAX_RUBRIC_CRITERIA = 20;

/**
 * Validates an activity's grading rubric and returns it in canonical form.
 * Every criterion needs a unique name and whole, positive points; the
 * criteria must add up to the activity's total points (when one is given),
 * since the grading screen totals rubric scores into the final score.
 * Returns { rubrics, total }.
 */
function normalizeRubric(raw, expectedTotal) {
  if (!Array.isArray(raw)) throw ApiError.badRequest('The rubric must be a list of criteria.');
  if (raw.length > MAX_RUBRIC_CRITERIA) {
    throw ApiError.badRequest(`A rubric can have at most ${MAX_RUBRIC_CRITERIA} criteria.`);
  }

  const seen = new Set();
  const rubrics = raw.map((item, i) => {
    const title = String(item?.title || '').trim();
    const description = String(item?.description || '').trim();
    const points = Number(item?.points);
    const label = title ? `"${title}"` : `Criterion ${i + 1}`;
    if (!title) throw ApiError.badRequest(`Criterion ${i + 1} needs a name.`);
    if (title.length > 100) throw ApiError.badRequest(`${label} name is too long (100 characters max).`);
    if (!Number.isInteger(points) || points <= 0) {
      throw ApiError.badRequest(`${label} must be worth a whole number of points greater than 0.`);
    }
    const key = title.toLowerCase();
    // The grading screen matches saved scores back to criteria by name.
    if (seen.has(key)) throw ApiError.badRequest(`Two criteria are both named "${title}". Each must be unique.`);
    seen.add(key);
    return { title, description, points };
  });

  const total = rubrics.reduce((sum, r) => sum + r.points, 0);
  if (expectedTotal !== undefined && expectedTotal !== null && Number(expectedTotal) !== total) {
    throw ApiError.badRequest(
      `The rubric criteria add up to ${total} points, but the activity is worth ${Number(expectedTotal)} points. Make them equal.`
    );
  }
  return { rubrics, total };
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
  scopeFilterToProgram(filter, req.user, req.query.program);

  if (req.query.status) filter.status = req.query.status;
  if (req.query.moduleCode && req.query.moduleCode !== 'All Modules') {
    filter.moduleCode = req.query.moduleCode;
  }
  if (req.query.withDeadline === 'true') filter.deadline = { $ne: null };
  // Plain learning materials (no due date) — the officer's Modules list.
  if (req.query.withDeadline === 'false') filter.deadline = null;
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

  // A trainee at the absence limit still sees what exists, but not the
  // content itself — opening a module is locked (routes/moduleRoutes.js), so
  // the list must not hand out the file links either.
  const standing = await standingForUser(req.user);
  const locked = Boolean(standing && standing.restricted);

  const totalTrainees = await User.countDocuments({
    role: { $in: TRAINEE_ROLES },
    ...(filter.program ? { program: filter.program } : {}),
    status: 'Active',
  });

  res.json({
    success: true,
    count: modules.length,
    restricted: locked,
    attendanceStanding: standing,
    data: modules.map((m) => {
      const c = countMap.get(String(m._id)) || { submitted: 0, graded: 0 };
      const own = mineMap.get(String(m._id));
      let myStatus = 'To Do';
      if (own) myStatus = own.status;
      else if (m.deadline && m.deadline < now) myStatus = 'Missing';

      const content = locked
        ? { fileUrl: '', fileName: '', fileSize: 0, instructions: [], locked: true }
        : {};
      return {
        ...m.toObject(),
        ...content,
        submittedCount: c.submitted,
        gradedCount: c.graded,
        totalTrainees,
        percentage: totalTrainees
          ? Math.round((c.submitted / totalTrainees) * 100)
          : 0,
        mySubmission: own || null,
        myStatus,
        isClosed: isPastDeadline(m, now),
      };
    }),
  });
});

/** GET /api/modules/:id */
exports.get = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id).populate('createdBy', 'name role');
  if (!module) throw ApiError.notFound('Module not found.');
  assertProgramAccess(req.user, module.program);

  const mine = await Submission.findOne({ moduleId: module._id, studentId: req.user._id });
  const submittedCount = await Submission.countDocuments({ moduleId: module._id });

  // Same status rule as the list. `isClosed` tells the trainee app to lock
  // Turn In once the due date has passed (enforced in submissionController).
  const isClosed = isPastDeadline(module);
  let myStatus = 'To Do';
  if (mine) myStatus = mine.status;
  else if (isClosed) myStatus = 'Missing';

  res.json({
    success: true,
    data: { ...module.toObject(), mySubmission: mine, myStatus, isClosed, submittedCount },
  });
});

/** A quiz's online-form link is optional, but must be a full web address. */
function assertFormUrl(value) {
  if (value && !/^https?:\/\/\S+$/i.test(String(value).trim())) {
    throw ApiError.badRequest('The Google Form link must be a full link starting with https://');
  }
}

/** POST /api/modules */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title']);
  assertEnum(req.body.program, PROGRAMS, 'program');

  const program = resolveProgramForCreate(req.user, req.body.program);
  assertFormUrl(req.body.formUrl);
  const file = req.file;
  const deadline = parseDeadline(req.body.deadline);

  // A graded activity (one with a due date) must carry a rubric; a plain
  // learning-material module is never graded, so it doesn't need one.
  let rubrics = [];
  let totalPoints = Number(req.body.totalPoints) || 100;
  const rawRubric = parseJsonish(req.body.rubrics, []);
  if (deadline || rawRubric.length) {
    if (!rawRubric.length) {
      throw ApiError.badRequest('Add a grading rubric (at least one criterion) before posting this activity.');
    }
    const normalized = normalizeRubric(
      rawRubric,
      req.body.totalPoints !== undefined && req.body.totalPoints !== '' ? Number(req.body.totalPoints) : undefined
    );
    rubrics = normalized.rubrics;
    totalPoints = normalized.total;
  }

  const module = await ModuleModel.create({
    title: req.body.title,
    description: req.body.description || '',
    program,
    moduleCode: req.body.moduleCode || '',
    section: req.body.section || '',
    fileUrl: file ? file.path : req.body.fileUrl || '',
    fileName: file ? file.originalname : req.body.fileName || '',
    fileSize: file ? file.size : Number(req.body.fileSize) || 0,
    instructions: parseList(req.body.instructions) || [],
    deadline,
    kind: req.body.kind === 'Quiz' ? 'Quiz' : 'Assignment',
    quizNumber: req.body.quizNumber || '',
    formUrl: req.body.formUrl || '',
    totalPoints,
    rubrics,
    status: req.body.status || 'Open',
    createdBy: req.user._id,
  });

  // Let the class know — posts an announcement that opens this module/quiz
  // directly in the app, and notifies every active trainee in the program.
  await announceModule(module, req.user._id);

  res.status(201).json({ success: true, data: module });
});

/** PUT /api/modules/:id */
exports.update = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');
  assertProgramAccess(req.user, module.program);
  assertEnum(req.body.program, PROGRAMS, 'program');
  if (req.user.role !== 'super_admin' && req.body.program !== undefined) {
    req.body.program = req.user.program;
  }

  assertEnum(req.body.kind, ['Assignment', 'Quiz'], 'kind');
  assertFormUrl(req.body.formUrl);
  ['title', 'description', 'program', 'moduleCode', 'section', 'kind', 'quizNumber', 'formUrl', 'status'].forEach((f) => {
    if (req.body[f] !== undefined) module[f] = req.body[f];
  });

  if (req.body.deadline !== undefined) {
    module.deadline = parseDeadline(req.body.deadline);
  }

  const rubricSent = req.body.rubrics !== undefined;
  const pointsSent = req.body.totalPoints !== undefined && req.body.totalPoints !== '';
  if (rubricSent || pointsSent) {
    const nextRubric = rubricSent ? parseJsonish(req.body.rubrics, []) : module.rubrics.map((r) => r.toObject?.() || r);
    const nextPoints = pointsSent ? Number(req.body.totalPoints) : undefined;
    const before = JSON.stringify({
      r: module.rubrics.map((r) => ({ title: r.title, points: r.points })),
      t: module.totalPoints,
    });
    if (nextRubric.length) {
      const normalized = normalizeRubric(nextRubric, nextPoints);
      module.rubrics = normalized.rubrics;
      module.totalPoints = normalized.total;
    } else {
      module.rubrics = [];
      if (pointsSent) module.totalPoints = nextPoints || module.totalPoints;
    }
    const after = JSON.stringify({
      r: module.rubrics.map((r) => ({ title: r.title, points: r.points })),
      t: module.totalPoints,
    });
    // Changing criteria/points under already-graded work would leave those
    // scores measured against a rubric that no longer exists.
    if (before !== after && (await Submission.exists({ moduleId: module._id, status: 'Graded' }))) {
      throw ApiError.conflict(
        'Some submissions for this activity are already graded, so its rubric and points can no longer be changed.'
      );
    }
  }
  // Only when the edit form itself is saved (it always resends the due date)
  // — a status-only update to an older rubric-less activity still goes through.
  if ((req.body.deadline !== undefined || rubricSent) && module.deadline && !module.rubrics.length) {
    throw ApiError.badRequest('Add a grading rubric (at least one criterion) to this activity before saving.');
  }
  const instructions = parseList(req.body.instructions);
  if (instructions) module.instructions = instructions;

  if (req.file) {
    module.fileUrl = req.file.path;
    module.fileName = req.file.originalname;
    module.fileSize = req.file.size;
  } else if (req.body.fileUrl !== undefined) {
    // No new upload this save — the officer either updated the external
    // video link or left it as-is (the form resends the current value
    // either way), never both a file and a link at once.
    module.fileUrl = req.body.fileUrl;
    module.fileName = req.body.fileName || '';
    module.fileSize = 0;
  }

  await module.save();
  res.json({ success: true, data: module });
});

/** DELETE /api/modules/:id */
exports.remove = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');
  assertProgramAccess(req.user, module.program);

  await Submission.deleteMany({ moduleId: module._id });
  await PrivateComment.deleteMany({ moduleId: module._id });
  await removeLinkedAnnouncements('Module', module._id);
  await module.deleteOne();

  res.json({ success: true, message: 'Module and its submissions deleted.' });
});

/** GET /api/modules/:id/submissions */
exports.submissions = asyncHandler(async (req, res) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw ApiError.notFound('Module not found.');
  assertProgramAccess(req.user, module.program);

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
