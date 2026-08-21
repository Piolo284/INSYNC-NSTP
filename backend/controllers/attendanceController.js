const crypto = require('crypto');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const Activity = require('../models/Activity');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const {
  PROGRAMS,
  ATTENDANCE_STATUSES,
  attendanceRules,
} = require('../config/constants');
const {
  startOfDay,
  endOfDay,
  combineDateAndTime,
  formatTime12h,
  addMinutes,
} = require('../utils/datetime');
const { sendAttendanceCode } = require('../utils/mailer');
const { notifyUser } = require('../utils/notify');
const { recalculateGrade } = require('../utils/gradeCalculator');

const sixDigit = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// ============================================================
// SESSIONS (officer "Create QR Code" flow)
// ============================================================

/** POST /api/attendance/sessions */
exports.createSession = asyncHandler(async (req, res) => {
  requireFields(req.body, ['date', 'startTime', 'endTime']);
  assertEnum(req.body.program, PROGRAMS, 'program');

  const program = req.body.program || req.user.program || 'CWTS';
  const date = new Date(req.body.date);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Please provide a valid date.');
  }

  const startsAt = combineDateAndTime(date, req.body.startTime);
  const endsAt = combineDateAndTime(date, req.body.endTime);
  if (endsAt <= startsAt) {
    throw ApiError.badRequest('End time must be after the start time.');
  }

  let activityId = req.body.activityId || null;
  if (activityId) {
    const activity = await Activity.findById(activityId);
    if (!activity) throw ApiError.notFound('Activity not found.');
  }

  const session = await AttendanceSession.create({
    activityId,
    program,
    brigade: req.body.brigade || '',
    title: req.body.title || req.body.notes || `${program} Attendance`,
    date: startOfDay(date),
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    startsAt,
    endsAt,
    // Value encoded into the QR image; opaque and unguessable.
    sessionCode: `NSTP-${program}-${crypto.randomBytes(9).toString('hex').toUpperCase()}`,
    notes: req.body.notes || '',
    status: 'Active',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: session });
});

/** GET /api/attendance/sessions */
exports.listSessions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.program) filter.program = req.query.program;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) {
    const d = new Date(req.query.date);
    filter.date = { $gte: startOfDay(d), $lte: endOfDay(d) };
  }

  const sessions = await AttendanceSession.find(filter)
    .populate('activityId', 'title location')
    .sort({ startsAt: -1 });

  res.json({ success: true, count: sessions.length, data: sessions });
});

/** GET /api/attendance/sessions/:id */
exports.getSession = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id).populate(
    'activityId',
    'title location'
  );
  if (!session) throw ApiError.notFound('Attendance session not found.');

  const records = await Attendance.countDocuments({ sessionId: session._id });
  res.json({
    success: true,
    data: { ...session.toObject(), recordCount: records, isOpen: session.isOpenAt() },
  });
});

/** PUT /api/attendance/sessions/:id/close */
exports.closeSession = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) throw ApiError.notFound('Attendance session not found.');

  session.status = 'Closed';
  await session.save();

  res.json({ success: true, data: session });
});

// ============================================================
// TRAINEE QR SCAN + EMAIL VERIFICATION
// ============================================================

/**
 * POST /api/attendance/scan
 * Step 1 of the QR flow: validates the session, blocks duplicates, creates the
 * pending record and mails a verification code.
 */
exports.scan = asyncHandler(async (req, res) => {
  requireFields(req.body, ['sessionCode']);

  const session = await AttendanceSession.findOne({
    sessionCode: String(req.body.sessionCode).trim(),
  });
  if (!session) {
    throw ApiError.badRequest('This QR code is not recognized.');
  }

  const now = new Date();
  if (session.status !== 'Active') {
    throw ApiError.badRequest('This attendance session is already closed.');
  }
  if (now < session.startsAt) {
    throw ApiError.badRequest('This attendance session has not started yet.');
  }
  if (now > session.endsAt) {
    throw ApiError.badRequest('This attendance session has already ended.');
  }
  if (session.program !== req.user.program) {
    throw ApiError.forbidden(`This QR code is for ${session.program} only.`);
  }

  const existing = await Attendance.findOne({
    sessionId: session._id,
    studentId: req.user._id,
  });
  if (existing && existing.verified) {
    throw ApiError.conflict('You have already recorded attendance for this session.');
  }

  const { lateGraceMinutes, codeTtlMinutes } = attendanceRules();
  const lateAfter = addMinutes(session.startsAt, lateGraceMinutes);
  const status = now > lateAfter ? 'Late' : 'Present';

  const code = sixDigit();
  const expiresAt = addMinutes(now, codeTtlMinutes);

  let record;
  try {
    record = await Attendance.findOneAndUpdate(
      { sessionId: session._id, studentId: req.user._id },
      {
        sessionId: session._id,
        activityId: session.activityId,
        studentId: req.user._id,
        program: session.program,
        title: session.title,
        date: session.date,
        time: formatTime12h(now),
        status,
        attendanceMethod: 'QR',
        verificationCode: code,
        verificationExpiresAt: expiresAt,
        verified: false,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Unique index tripped by a concurrent scan of the same QR.
    if (err.code === 11000) {
      throw ApiError.conflict('You have already recorded attendance for this session.');
    }
    throw err;
  }

  const mail = await sendAttendanceCode({
    to: req.user.email,
    name: req.user.name,
    code,
    sessionTitle: session.title || `${session.program} Attendance`,
    minutes: codeTtlMinutes,
  });

  res.status(201).json({
    success: true,
    message: mail.delivered
      ? `A verification code was sent to ${req.user.email}.`
      : 'Verification code generated (development mode).',
    data: {
      attendanceId: record._id,
      sessionId: session._id,
      status: record.status,
      time: record.time,
      emailSent: mail.delivered,
      expiresAt,
      // Only exposed when SMTP is not configured, so local testing still works.
      ...(mail.devMode ? { devVerificationCode: code } : {}),
    },
  });
});

/**
 * POST /api/attendance/verify
 * Step 2: confirms the emailed code and finalises the attendance record.
 */
exports.verify = asyncHandler(async (req, res) => {
  requireFields(req.body, ['verificationCode']);

  const filter = { studentId: req.user._id, verified: false };
  if (req.body.attendanceId) {
    filter._id = req.body.attendanceId;
  } else if (req.body.sessionId) {
    filter.sessionId = req.body.sessionId;
  }

  const record = await Attendance.findOne(filter)
    .select('+verificationCode')
    .sort({ createdAt: -1 });

  if (!record) {
    throw ApiError.notFound('No pending attendance found. Please scan the QR code again.');
  }
  if (record.verificationExpiresAt && record.verificationExpiresAt < new Date()) {
    throw ApiError.badRequest('That code has expired. Please scan the QR code again.');
  }
  if (record.verificationCode !== String(req.body.verificationCode).trim()) {
    throw ApiError.badRequest('That verification code is incorrect.');
  }

  record.verified = true;
  record.verificationCode = null;
  record.verificationExpiresAt = null;
  await record.save();

  await Promise.all([
    notifyUser(req.user._id, {
      title: 'Attendance recorded',
      message: `You were marked ${record.status} for ${record.title || 'the session'}.`,
      type: 'attendance',
      data: { attendanceId: record._id },
    }),
    recalculateGrade(req.user._id, record.program),
  ]);

  res.json({
    success: true,
    message: `Attendance recorded. You were marked ${record.status}.`,
    data: record,
  });
});

// ============================================================
// LIST / MANUAL / UPDATE
// ============================================================

/** GET /api/attendance */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.program) filter.program = req.query.program;
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;
  if (req.query.activityId) filter.activityId = req.query.activityId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.date) {
    const d = new Date(req.query.date);
    filter.date = { $gte: startOfDay(d), $lte: endOfDay(d) };
  }

  // Trainees may only ever see their own rows.
  if (['student', 'cadet'].includes(req.user.role)) {
    filter.studentId = req.user._id;
  }

  let records = await Attendance.find(filter)
    .populate('studentId', 'name studentId program section yearLevel profileImage')
    .populate('activityId', 'title location')
    .sort({ date: -1, createdAt: -1 })
    .limit(Number(req.query.limit) || 500);

  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    records = records.filter((r) => {
      const u = r.studentId;
      if (!u || typeof u === 'string') return false;
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.studentId || '').toLowerCase().includes(q)
      );
    });
  }

  res.json({ success: true, count: records.length, data: records });
});

/**
 * POST /api/attendance
 * Officer manual attendance. Accepts a single studentId or a studentIds array
 * so the "Add Manually" button can submit the whole list at once.
 */
exports.create = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.studentIds)
    ? req.body.studentIds
    : [req.body.studentId].filter(Boolean);

  if (!ids.length) {
    throw ApiError.badRequest('Select at least one student.');
  }
  assertEnum(req.body.status, ATTENDANCE_STATUSES, 'status');

  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Please provide a valid date.');
  }

  let session = null;
  if (req.body.sessionId) {
    session = await AttendanceSession.findById(req.body.sessionId);
    if (!session) throw ApiError.notFound('Attendance session not found.');
  }

  const users = await User.find({
    _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) },
  });
  if (users.length !== ids.length) {
    throw ApiError.badRequest('One or more selected students could not be found.');
  }

  const program = req.body.program || session?.program || req.user.program || 'CWTS';
  const status = req.body.status || 'Present';
  const now = new Date();

  const results = [];
  const skipped = [];

  for (const user of users) {
    const dedupe = session
      ? { sessionId: session._id, studentId: user._id }
      : {
          studentId: user._id,
          date: { $gte: startOfDay(date), $lte: endOfDay(date) },
          title: req.body.title || session?.title || `${program} Attendance`,
        };

    const existing = await Attendance.findOne(dedupe);
    if (existing) {
      // Manual entry over an existing record updates it rather than duplicating.
      existing.status = status;
      existing.remarks = req.body.remarks ?? existing.remarks;
      existing.attendanceMethod = 'Manual';
      existing.verified = true;
      existing.recordedBy = req.user._id;
      await existing.save();
      skipped.push({ studentId: user._id, action: 'updated' });
      results.push(existing);
      continue;
    }

    const record = await Attendance.create({
      sessionId: session ? session._id : null,
      activityId: req.body.activityId || session?.activityId || null,
      studentId: user._id,
      program,
      title: req.body.title || session?.title || `${program} Attendance`,
      date: startOfDay(date),
      time: req.body.time || formatTime12h(now),
      status,
      attendanceMethod: 'Manual',
      verified: true,
      remarks: req.body.remarks || '',
      recordedBy: req.user._id,
    });
    results.push(record);

    await notifyUser(user._id, {
      title: 'Attendance updated',
      message: `You were marked ${status} for ${record.title}.`,
      type: 'attendance',
      data: { attendanceId: record._id },
    });
  }

  await Promise.all(users.map((u) => recalculateGrade(u._id, program)));

  res.status(201).json({
    success: true,
    message: `${results.length} attendance record(s) saved.`,
    count: results.length,
    updated: skipped.length,
    data: results,
  });
});

/** PUT /api/attendance/:id */
exports.update = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) throw ApiError.notFound('Attendance record not found.');

  assertEnum(req.body.status, ATTENDANCE_STATUSES, 'status');

  ['status', 'time', 'remarks'].forEach((f) => {
    if (req.body[f] !== undefined) record[f] = req.body[f];
  });
  record.recordedBy = req.user._id;
  await record.save();

  await recalculateGrade(record.studentId, record.program);

  res.json({ success: true, data: record });
});

/** DELETE /api/attendance/:id */
exports.remove = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) throw ApiError.notFound('Attendance record not found.');

  const { studentId, program } = record;
  await record.deleteOne();
  await recalculateGrade(studentId, program);

  res.json({ success: true, message: 'Attendance record deleted.' });
});

/**
 * GET /api/attendance/summary
 * Feeds the officer attendance screen: per-day totals plus a monthly trend.
 */
exports.summary = asyncHandler(async (req, res) => {
  const program = req.query.program || req.user.program || 'CWTS';
  const date = req.query.date ? new Date(req.query.date) : new Date();

  const dayFilter = {
    program,
    date: { $gte: startOfDay(date), $lte: endOfDay(date) },
  };

  const [dayRows, totalStudents, trendRows, overallRows] = await Promise.all([
    Attendance.aggregate([
      { $match: dayFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    User.countDocuments({
      role: program === 'ROTC' ? 'cadet' : 'student',
      program,
      status: 'Active',
    }),
    Attendance.aggregate([
      {
        $match: {
          program,
          date: {
            $gte: new Date(date.getFullYear(), date.getMonth(), 1),
            $lte: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: {
            $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Excused']] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: { program } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const day = toMap(dayRows);
  const overall = toMap(overallRows);

  const dayTotal = Object.values(day).reduce((a, b) => a + b, 0);
  const pct = (n) => (dayTotal ? Math.round(((n || 0) / dayTotal) * 1000) / 10 : 0);

  res.json({
    success: true,
    data: {
      date,
      totalStudents,
      today: {
        present: day.Present || 0,
        late: day.Late || 0,
        absent: day.Absent || 0,
        excused: day.Excused || 0,
        total: dayTotal,
        presentPercent: pct(day.Present),
        latePercent: pct(day.Late),
        absentPercent: pct(day.Absent),
      },
      overall: {
        present: overall.Present || 0,
        late: overall.Late || 0,
        absent: overall.Absent || 0,
        excused: overall.Excused || 0,
      },
      trend: trendRows.map((r) => ({
        date: r._id,
        value: r.total ? Math.round((r.present / r.total) * 100) / 100 : 0,
      })),
    },
  });
});
