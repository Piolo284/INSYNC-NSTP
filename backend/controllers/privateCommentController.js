const mongoose = require('mongoose');
const ModuleModel = require('../models/Module');
const PrivateComment = require('../models/PrivateComment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { TRAINEE_ROLES } = require('../config/constants');
const { notifyUser, notifyUsers } = require('../utils/notify');
const { assertProgramAccess } = require('../utils/programScope');
const { assertBrigadeAccess, isBrigadeRestricted } = require('../utils/brigadeScope');

const AUTHOR_FIELDS = 'name role profileImage';

async function loadModule(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Module not found.');
  const module = await ModuleModel.findById(id);
  if (!module) throw ApiError.notFound('Module not found.');
  return module;
}

/**
 * Resolves whose thread the caller is reading/posting in, and checks they
 * may. A trainee only ever gets their own thread; staff must name the
 * trainee (`studentId`) and be allowed to manage them (program + brigade).
 */
async function resolveThreadStudent(req, module, requestedStudentId) {
  assertProgramAccess(req.user, module.program);

  if (TRAINEE_ROLES.includes(req.user.role)) return req.user;

  if (!requestedStudentId || !mongoose.isValidObjectId(requestedStudentId)) {
    throw ApiError.badRequest('studentId is required.');
  }
  const student = await User.findById(requestedStudentId).select('name program brigadeId role');
  if (!student || !TRAINEE_ROLES.includes(student.role)) {
    throw ApiError.notFound('Student not found.');
  }
  assertBrigadeAccess(req.user, student.brigadeId);
  return student;
}

/** GET /api/modules/:id/comments[?studentId=] — one trainee's private thread. */
exports.list = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id);
  const student = await resolveThreadStudent(req, module, req.query.studentId);

  const comments = await PrivateComment.find({ moduleId: module._id, studentId: student._id })
    .populate('authorId', AUTHOR_FIELDS)
    .sort({ createdAt: 1 });

  res.json({ success: true, count: comments.length, data: comments });
});

/** POST /api/modules/:id/comments — body: { message, studentId? (staff only) } */
exports.create = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) throw ApiError.badRequest('Write a message first.');
  if (message.length > 2000) throw ApiError.badRequest('Message is too long (2000 characters max).');

  const module = await loadModule(req.params.id);
  const student = await resolveThreadStudent(req, module, req.body.studentId);
  const fromTrainee = String(student._id) === String(req.user._id);

  const comment = await PrivateComment.create({
    moduleId: module._id,
    studentId: student._id,
    authorId: req.user._id,
    message,
  });
  await comment.populate('authorId', AUTHOR_FIELDS);

  const preview = message.length > 120 ? `${message.slice(0, 117)}...` : message;
  const data = { moduleId: module._id, studentId: student._id };

  if (fromTrainee) {
    // Reach the officers who handle this trainee; if none (e.g. a ROTC
    // cadet with no company yet), whoever posted the module.
    const officers = student.brigadeId
      ? await User.find({
          role: 'officer',
          program: module.program,
          brigadeId: student.brigadeId,
          status: 'Active',
        }).select('_id')
      : [];
    const recipients = officers.length ? officers.map((o) => o._id) : [module.createdBy].filter(Boolean);
    await notifyUsers(recipients, {
      title: `Private comment: ${module.title}`,
      message: `${student.name}: ${preview}`,
      type: 'submission',
      data,
    });
  } else {
    await notifyUser(student._id, {
      title: `Private comment: ${module.title}`,
      message: `${req.user.name}: ${preview}`,
      type: 'submission',
      data,
    });
  }

  res.status(201).json({ success: true, data: comment });
});

/**
 * GET /api/modules/:id/comment-threads — staff: every trainee who has a
 * private thread on this module (latest message first), scoped to the
 * officer's own brigade.
 */
exports.threads = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id);
  assertProgramAccess(req.user, module.program);

  const grouped = await PrivateComment.aggregate([
    { $match: { moduleId: module._id } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$studentId',
        count: { $sum: 1 },
        lastMessage: { $last: '$message' },
        lastAuthorId: { $last: '$authorId' },
        lastAt: { $last: '$createdAt' },
      },
    },
    { $sort: { lastAt: -1 } },
  ]);

  const students = await User.find({ _id: { $in: grouped.map((g) => g._id) } }).select(
    'name studentId profileImage brigadeId'
  );
  const byId = new Map(students.map((s) => [String(s._id), s]));

  const threads = grouped
    .map((g) => ({ ...g, student: byId.get(String(g._id)) }))
    .filter((t) => t.student)
    .filter(
      (t) =>
        !isBrigadeRestricted(req.user) ||
        String(t.student.brigadeId || '') === String(req.user.brigadeId || '')
    )
    .map((t) => ({
      student: t.student,
      count: t.count,
      lastMessage: t.lastMessage,
      lastAt: t.lastAt,
      // True when the trainee spoke last — i.e. waiting on a staff reply.
      awaitingReply: String(t.lastAuthorId) === String(t.student._id),
    }));

  res.json({ success: true, count: threads.length, data: threads });
});
