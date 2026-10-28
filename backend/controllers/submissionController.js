const Submission = require('../models/Submission');
const ModuleModel = require('../models/Module');
const Activity = require('../models/Activity');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireOneOf } = require('../utils/validate');
const { notifyUser } = require('../utils/notify');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { assertBeforeDeadline } = require('../utils/deadline');
const { STAFF_ROLES } = require('../config/constants');
const { assertProgramAccess } = require('../utils/programScope');
const { assertBrigadeAccess, isBrigadeRestricted } = require('../utils/brigadeScope');

/** Loads just the brigadeId for whichever student owns this submission. */
async function loadBrigadeId(submission) {
  if (submission.studentId && typeof submission.studentId === 'object' && 'brigadeId' in submission.studentId) {
    return submission.studentId.brigadeId;
  }
  const student = await User.findById(submission.studentId).select('brigadeId');
  return student ? student.brigadeId : null;
}

function parseJsonish(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Best-effort program a submission belongs to, from whichever ref is populated. */
function deriveProgram(submission) {
  if (submission.moduleId && typeof submission.moduleId === 'object' && submission.moduleId.program) {
    return submission.moduleId.program;
  }
  if (
    submission.activityId &&
    typeof submission.activityId === 'object' &&
    submission.activityId.program
  ) {
    return submission.activityId.program;
  }
  if (submission.studentId && typeof submission.studentId === 'object' && submission.studentId.program) {
    return submission.studentId.program;
  }
  return null;
}

/** Loads the module/activity program for a submission that isn't populated yet. */
async function loadProgram(submission) {
  if (submission.moduleId) {
    const mod = await ModuleModel.findById(submission.moduleId).select('program');
    if (mod) return mod.program;
  }
  if (submission.activityId) {
    const act = await Activity.findById(submission.activityId).select('program');
    if (act) return act.program;
  }
  const student = await User.findById(submission.studentId).select('program');
  return student ? student.program : null;
}

/** GET /api/submissions */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.moduleId) filter.moduleId = req.query.moduleId;
  if (req.query.activityId) filter.activityId = req.query.activityId;
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;

  // Trainees only ever see their own submissions.
  if (['student', 'cadet'].includes(req.user.role)) {
    filter.studentId = req.user._id;
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId;
  }

  let submissions = await Submission.find(filter)
    .populate('studentId', 'name studentId program brigadeId section yearLevel profileImage')
    .populate('moduleId', 'title deadline totalPoints moduleCode rubrics program')
    .populate('activityId', 'title date program')
    .sort({ submittedAt: -1 });

  // Program-scoped staff never see the other program's submissions.
  if (req.user.role !== 'super_admin' && STAFF_ROLES.includes(req.user.role)) {
    submissions = submissions.filter((s) => deriveProgram(s) === req.user.program);
  }
  // An officer only sees their own brigade's students' submissions.
  if (isBrigadeRestricted(req.user)) {
    submissions = submissions.filter(
      (s) => String(s.studentId?.brigadeId || '') === String(req.user.brigadeId || '')
    );
  }

  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    submissions = submissions.filter((s) => {
      const u = s.studentId;
      const m = s.moduleId;
      return (
        String(u?.name || '').toLowerCase().includes(q) ||
        String(u?.studentId || '').toLowerCase().includes(q) ||
        String(m?.title || '').toLowerCase().includes(q)
      );
    });
  }

  res.json({ success: true, count: submissions.length, data: submissions });
});

/** GET /api/submissions/:id */
exports.get = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('studentId', 'name studentId program brigadeId section yearLevel profileImage email')
    .populate('moduleId', 'title deadline totalPoints moduleCode rubrics description program')
    .populate('activityId', 'title date program')
    .populate('gradedBy', 'name role');

  if (!submission) throw ApiError.notFound('Submission not found.');

  const isOwner = String(submission.studentId?._id) === String(req.user._id);
  const isStaff = STAFF_ROLES.includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw ApiError.forbidden('You can only view your own submission.');
  }
  if (isStaff && !isOwner) {
    assertProgramAccess(req.user, deriveProgram(submission));
    assertBrigadeAccess(req.user, await loadBrigadeId(submission));
  }

  res.json({ success: true, data: submission });
});

/**
 * POST /api/submissions
 * The trainee "Turn In" button. Multipart with a `file` field, or JSON with a
 * pre-uploaded fileUrl. Re-submitting before grading replaces the file.
 */
exports.create = asyncHandler(async (req, res) => {
  requireOneOf(req.body, ['moduleId', 'activityId']);

  const { moduleId, activityId } = req.body;
  let totalPoints = 100;

  if (moduleId) {
    const module = await ModuleModel.findById(moduleId);
    if (!module) throw ApiError.notFound('Module not found.');
    assertProgramAccess(req.user, module.program);
    assertBeforeDeadline(module);
    totalPoints = module.totalPoints || 100;
  }
  if (activityId) {
    const activity = await Activity.findById(activityId);
    if (!activity) throw ApiError.notFound('Activity not found.');
    assertProgramAccess(req.user, activity.program);
  }

  if (!req.file && !req.body.fileUrl && !req.body.comment) {
    throw ApiError.badRequest('Attach a file or write a comment before submitting.');
  }

  const payload = {
    moduleId: moduleId || null,
    activityId: activityId || null,
    studentId: req.user._id,
    fileUrl: req.file ? req.file.path : req.body.fileUrl || '',
    fileName: req.file ? req.file.originalname : req.body.fileName || '',
    fileSize: req.file ? req.file.size : Number(req.body.fileSize) || 0,
    comment: req.body.comment || '',
    submittedAt: new Date(),
    status: 'Submitted',
    totalPoints,
  };

  let submission;
  if (moduleId) {
    const existing = await Submission.findOne({ moduleId, studentId: req.user._id });
    if (existing && existing.status === 'Graded') {
      throw ApiError.conflict(
        'This submission has already been graded and can no longer be replaced.'
      );
    }
    submission = await Submission.findOneAndUpdate(
      { moduleId, studentId: req.user._id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    submission = await Submission.create(payload);
  }

  res.status(201).json({
    success: true,
    message: 'Submission turned in.',
    data: submission,
  });
});

/**
 * PUT /api/submissions/:id
 * Owner can update the comment/file before grading; staff grade it here.
 */
exports.update = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw ApiError.notFound('Submission not found.');

  const isOwner = String(submission.studentId) === String(req.user._id);
  const isStaff = STAFF_ROLES.includes(req.user.role);

  if (!isOwner && !isStaff) {
    throw ApiError.forbidden('You cannot modify this submission.');
  }
  if (isStaff && !isOwner) {
    assertProgramAccess(req.user, await loadProgram(submission));
    assertBrigadeAccess(req.user, await loadBrigadeId(submission));
  }

  if (isOwner && !isStaff) {
    if (submission.status === 'Graded') {
      throw ApiError.conflict('This submission has already been graded.');
    }
    if (submission.moduleId) {
      assertBeforeDeadline(await ModuleModel.findById(submission.moduleId).select('deadline'));
    }
    if (req.body.comment !== undefined) submission.comment = req.body.comment;
    if (req.file) {
      submission.fileUrl = req.file.path;
      submission.fileName = req.file.originalname;
      submission.fileSize = req.file.size;
    }
    submission.submittedAt = new Date();
    submission.status = 'Submitted';
    await submission.save();
    return res.json({ success: true, data: submission });
  }

  ['status', 'feedback'].forEach((f) => {
    if (req.body[f] !== undefined) submission[f] = req.body[f];
  });
  if (req.body.score !== undefined) submission.score = Number(req.body.score);
  if (req.body.totalPoints !== undefined) {
    submission.totalPoints = Number(req.body.totalPoints);
  }
  await submission.save();

  res.json({ success: true, data: submission });
});

/**
 * POST /api/submissions/:id/grade
 * Officer/admin grading screen. Accepts either a flat `score` or the
 * rubric rows the grading screen already maintains, which are summed here.
 */
exports.grade = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw ApiError.notFound('Submission not found.');
  assertProgramAccess(req.user, await loadProgram(submission));
  assertBrigadeAccess(req.user, await loadBrigadeId(submission));

  const rubricScores = parseJsonish(req.body.rubricScores, null);
  let score;
  let totalPoints = submission.totalPoints || 100;

  // An activity with a rubric is always graded against that rubric as
  // defined on the activity — criteria and max points come from the server,
  // only each criterion's awarded score comes from the officer.
  const module = submission.moduleId
    ? await ModuleModel.findById(submission.moduleId).select('rubrics totalPoints')
    : null;

  if (module && module.rubrics.length) {
    if (!Array.isArray(rubricScores) || !rubricScores.length) {
      throw ApiError.badRequest('Score every rubric criterion before submitting the grade.');
    }
    const given = new Map(
      rubricScores.map((r) => [String(r.title || '').trim().toLowerCase(), r.score])
    );
    const scored = module.rubrics.map((criterion) => {
      const raw = given.get(criterion.title.toLowerCase());
      const value = Number(raw);
      if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
        throw ApiError.badRequest(`Enter a score for "${criterion.title}".`);
      }
      if (value < 0 || value > criterion.points) {
        throw ApiError.badRequest(
          `Score for "${criterion.title}" must be between 0 and ${criterion.points}.`
        );
      }
      return { title: criterion.title, points: criterion.points, score: value };
    });
    score = scored.reduce((sum, r) => sum + r.score, 0);
    totalPoints = scored.reduce((sum, r) => sum + r.points, 0);
    submission.rubricScores = scored;
  } else if (Array.isArray(rubricScores) && rubricScores.length) {
    const invalid = rubricScores.find(
      (r) => Number(r.score) < 0 || Number(r.score) > Number(r.points)
    );
    if (invalid) {
      throw ApiError.badRequest(
        `Score for "${invalid.title}" must be between 0 and ${invalid.points}.`
      );
    }
    score = rubricScores.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    totalPoints = rubricScores.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
    submission.rubricScores = rubricScores;
  } else if (req.body.score !== undefined) {
    score = Number(req.body.score);
    if (req.body.totalPoints !== undefined) totalPoints = Number(req.body.totalPoints);
  } else {
    throw ApiError.badRequest('Provide a score or rubric scores.');
  }

  if (!Number.isFinite(score) || score < 0 || score > totalPoints) {
    throw ApiError.badRequest(`Score must be between 0 and ${totalPoints}.`);
  }

  submission.score = score;
  submission.totalPoints = totalPoints;
  submission.feedback = req.body.feedback ?? submission.feedback;
  submission.status = 'Graded';
  submission.gradedBy = req.user._id;
  submission.gradedAt = new Date();
  await submission.save();

  const student = await User.findById(submission.studentId);
  if (student) {
    await Promise.all([
      notifyUser(student._id, {
        title: 'Submission graded',
        message: `You scored ${score}/${totalPoints}.`,
        type: 'grade',
        data: { submissionId: submission._id },
      }),
      // Keeps the trainee's overall grade in step with the new score.
      recalculateGrade(student._id, student.program || 'CWTS', req.user._id),
    ]);
  }

  res.json({ success: true, message: 'Grade submitted.', data: submission });
});

/** DELETE /api/submissions/:id */
exports.remove = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw ApiError.notFound('Submission not found.');

  const isOwner = String(submission.studentId) === String(req.user._id);
  const isStaff = STAFF_ROLES.includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw ApiError.forbidden('You cannot delete this submission.');
  }
  if (isStaff && !isOwner) {
    assertProgramAccess(req.user, await loadProgram(submission));
    assertBrigadeAccess(req.user, await loadBrigadeId(submission));
  }
  if (isOwner && !isStaff && submission.status === 'Graded') {
    throw ApiError.conflict('A graded submission cannot be withdrawn.');
  }
  // Withdrawing after the due date would just turn it into a Missing the
  // trainee can no longer fix.
  if (isOwner && !isStaff && submission.moduleId) {
    assertBeforeDeadline(await ModuleModel.findById(submission.moduleId).select('deadline'));
  }

  const { studentId } = submission;
  await submission.deleteOne();

  const student = await User.findById(studentId);
  if (student) await recalculateGrade(student._id, student.program || 'CWTS');

  res.json({ success: true, message: 'Submission deleted.' });
});
