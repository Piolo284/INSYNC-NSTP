const AttendanceContest = require('../models/AttendanceContest');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { notifyUser } = require('../utils/notify');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { CONTEST_STATUSES, CONTEST_APPROVAL_TYPES } = require('../config/constants');
const { assertSelfOrStaff } = require('../middleware/auth');
const { assertProgramAccess, scopeFilterToProgram } = require('../utils/programScope');
const { assertBrigadeAccess, scopeFilterToBrigade } = require('../utils/brigadeScope');

/**
 * POST /api/attendance-contests
 * A trainee disputes one of their own Absent records: a required written
 * reason plus an optional attachment (e.g. a medical certificate image).
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['attendanceId', 'reason']);

  const record = await Attendance.findById(req.body.attendanceId);
  if (!record) throw ApiError.notFound('Attendance record not found.');
  if (String(record.studentId) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only contest your own attendance record.');
  }
  if (record.status !== 'Absent') {
    throw ApiError.badRequest('Only an Absent record can be contested.');
  }

  const existingPending = await AttendanceContest.findOne({
    attendanceId: record._id,
    status: 'Pending',
  });
  if (existingPending) {
    throw ApiError.conflict('You already have a pending contest for this record.');
  }

  const contest = await AttendanceContest.create({
    attendanceId: record._id,
    studentId: req.user._id,
    program: req.user.program,
    brigadeId: req.user.brigadeId || null,
    reason: req.body.reason,
    attachmentUrl: req.file ? req.file.path : '',
    attachmentName: req.file ? req.file.originalname : '',
    attachmentSize: req.file ? req.file.size : 0,
  });

  res.status(201).json({ success: true, data: contest });
});

/** GET /api/attendance-contests/mine — the trainee's own filed contests. */
exports.listMine = asyncHandler(async (req, res) => {
  const contests = await AttendanceContest.find({ studentId: req.user._id }).sort({
    createdAt: -1,
  });
  res.json({ success: true, count: contests.length, data: contests });
});

/**
 * GET /api/attendance-contests — officer/admin review queue. Program- and
 * brigade-scoped exactly like every other officer-facing list: an officer
 * only ever sees their own brigade's students' contests.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    assertEnum(req.query.status, CONTEST_STATUSES, 'status');
    filter.status = req.query.status;
  }
  scopeFilterToProgram(filter, req.user, req.query.program);
  scopeFilterToBrigade(filter, req.user, req.query.brigadeId);

  const contests = await AttendanceContest.find(filter)
    .populate('studentId', 'name studentId profileImage')
    .populate('attendanceId')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: contests.length, data: contests });
});

/** GET /api/attendance-contests/:id */
exports.get = asyncHandler(async (req, res) => {
  const contest = await AttendanceContest.findById(req.params.id)
    .populate('studentId', 'name studentId profileImage')
    .populate('attendanceId')
    .populate('reviewedBy', 'name role');
  if (!contest) throw ApiError.notFound('Contest not found.');

  const ownerId = contest.studentId?._id || contest.studentId;
  assertSelfOrStaff(req, ownerId);
  if (String(req.user._id) !== String(ownerId)) {
    assertProgramAccess(req.user, contest.program);
    assertBrigadeAccess(req.user, contest.brigadeId);
  }

  res.json({ success: true, data: contest });
});

/**
 * PUT /api/attendance-contests/:id — officer decides a pending contest.
 *
 *   { status: 'Approved', approvedAs: 'Excused' } — "Approve as Excuse": the
 *       record stays in the history as Excused, which never counts toward the
 *       absence limit.
 *   { status: 'Approved', approvedAs: 'Present' } — "Approve as Present": the
 *       record becomes Present, so the absence disappears entirely.
 *   { status: 'Rejected', reviewNote }            — the record stays Absent and
 *       keeps counting; a reason is required so the trainee knows why.
 *
 * `approvedAs` defaults to Excused for older clients that only send status.
 * Either approval recalculates the trainee's grade, absence count, at-risk
 * warning and feature restriction (utils/gradeCalculator.js).
 */
exports.review = asyncHandler(async (req, res) => {
  requireFields(req.body, ['status']);
  assertEnum(req.body.status, ['Approved', 'Rejected'], 'status');

  const status = req.body.status;
  const reviewNote = String(req.body.reviewNote || '').trim();
  let approvedAs = null;
  if (status === 'Approved') {
    approvedAs = req.body.approvedAs || 'Excused';
    assertEnum(approvedAs, CONTEST_APPROVAL_TYPES, 'approvedAs');
  } else if (!reviewNote) {
    throw ApiError.badRequest('Please give a reason for rejecting this contest.');
  }

  const existing = await AttendanceContest.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Contest not found.');
  if (existing.status !== 'Pending') {
    throw ApiError.conflict('This contest has already been reviewed.');
  }
  assertProgramAccess(req.user, existing.program);
  assertBrigadeAccess(req.user, existing.brigadeId);

  const record = await Attendance.findById(existing.attendanceId);
  const originalStatus = record ? record.status : 'Absent';
  const finalStatus = status === 'Approved' ? approvedAs : originalStatus;

  // Conditional on still being Pending, so two officers deciding the same
  // contest at once can't both apply (and double-notify).
  const contest = await AttendanceContest.findOneAndUpdate(
    { _id: existing._id, status: 'Pending' },
    {
      status,
      approvedAs,
      originalStatus,
      finalStatus,
      reviewNote,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    },
    { new: true }
  );
  if (!contest) throw ApiError.conflict('This contest has already been reviewed.');

  if (status === 'Approved' && record) {
    const label = approvedAs === 'Present' ? 'Approved as Present' : 'Approved as Excuse';
    record.status = approvedAs;
    record.autoAbsent = false;
    record.remarks = reviewNote ? `Contest ${label.toLowerCase()}: ${reviewNote}` : `Contest ${label.toLowerCase()}.`;
    record.recordedBy = req.user._id;
    await record.save();
    await recalculateGrade(record.studentId, record.program, req.user._id);
  }

  let message;
  if (status === 'Rejected') {
    message = `Your absence dispute was rejected and the record stays Absent. Reason: ${reviewNote}`;
  } else if (approvedAs === 'Present') {
    message = 'Your absence dispute was approved as Present. The record now counts as attended and no longer counts as an absence.';
  } else {
    message = 'Your absence dispute was approved as an Excuse. The record is now Excused and does not count as an absence.';
  }

  await notifyUser(contest.studentId, {
    title: status === 'Approved'
      ? `Attendance contest approved as ${approvedAs === 'Present' ? 'Present' : 'Excuse'}`
      : 'Attendance contest rejected',
    message,
    type: 'attendance',
    data: { attendanceId: contest.attendanceId, contestId: contest._id },
  });

  const populated = await AttendanceContest.findById(contest._id)
    .populate('studentId', 'name studentId profileImage')
    .populate('attendanceId')
    .populate('reviewedBy', 'name role');
  res.json({ success: true, data: populated });
});
