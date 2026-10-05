const AttendanceContest = require('../models/AttendanceContest');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { notifyUser } = require('../utils/notify');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { CONTEST_STATUSES } = require('../config/constants');
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
    .populate('attendanceId');
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
 * PUT /api/attendance-contests/:id — officer approves or rejects.
 * Approving flips the linked Attendance record to Excused and recalculates
 * the trainee's grade (attendance feeds directly into it); rejecting leaves
 * the Absent record untouched. Either way the trainee is notified.
 */
exports.review = asyncHandler(async (req, res) => {
  requireFields(req.body, ['status']);
  assertEnum(req.body.status, ['Approved', 'Rejected'], 'status');

  const contest = await AttendanceContest.findById(req.params.id);
  if (!contest) throw ApiError.notFound('Contest not found.');
  if (contest.status !== 'Pending') {
    throw ApiError.conflict('This contest has already been reviewed.');
  }

  assertProgramAccess(req.user, contest.program);
  assertBrigadeAccess(req.user, contest.brigadeId);

  contest.status = req.body.status;
  contest.reviewNote = req.body.reviewNote || '';
  contest.reviewedBy = req.user._id;
  contest.reviewedAt = new Date();
  await contest.save();

  if (contest.status === 'Approved') {
    const record = await Attendance.findById(contest.attendanceId);
    if (record) {
      record.status = 'Excused';
      record.remarks = contest.reviewNote
        ? `Contest approved: ${contest.reviewNote}`
        : 'Contest approved — absence excused.';
      record.recordedBy = req.user._id;
      await record.save();
      await recalculateGrade(record.studentId, record.program, req.user._id);
    }
  }

  await notifyUser(contest.studentId, {
    title: contest.status === 'Approved' ? 'Attendance contest approved' : 'Attendance contest rejected',
    message:
      contest.status === 'Approved'
        ? 'Your absence dispute was approved and your attendance record has been excused.'
        : `Your absence dispute was rejected.${contest.reviewNote ? ` Reason: ${contest.reviewNote}` : ''}`,
    type: 'attendance',
    data: { attendanceId: contest.attendanceId, contestId: contest._id },
  });

  res.json({ success: true, data: contest });
});
