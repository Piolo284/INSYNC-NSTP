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
  SESSION_CHECK_TYPES,
  attendanceRules,
} = require('../config/constants');
const {
  APP_TIMEZONE,
  startOfDay,
  endOfDay,
  combineDateAndTime,
  formatTime12h,
  addMinutes,
} = require('../utils/datetime');
const { sendAttendanceCode } = require('../utils/mailer');
const { notifyUser } = require('../utils/notify');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { TRAINEE_ROLES } = require('../config/constants');
const {
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
} = require('../utils/programScope');
const {
  assertBrigadeAccess,
  scopeFilterToBrigade,
  resolveBrigadeForCreate,
} = require('../utils/brigadeScope');
const {
  assertSpecialClassManager,
  isSpecialClassManager,
  isSpecialClassTrainee,
  specialClassTraineeIds,
} = require('../utils/specialClass');
const { SPECIAL_CLASS_CATEGORIES } = require('../config/constants');
const Brigade = require('../models/Brigade');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const { markMissingAbsent } = require('../utils/attendanceSweep');

const { sixDigit, codeSentMessage, checkCode } = require('../utils/verificationCode');

// ============================================================
// SESSIONS (officer "Create QR Code" flow)
// ============================================================

/** POST /api/attendance/sessions */
exports.createSession = asyncHandler(async (req, res) => {
  requireFields(req.body, ['date', 'startTime', 'endTime']);

  const checkType = req.body.checkType ? String(req.body.checkType).toUpperCase() : 'IN';
  assertEnum(checkType, SESSION_CHECK_TYPES, 'checkType');

  // An OUT session must open to exactly the same audience as the IN session
  // it closes out, so every scoping field below is mirrored from that
  // session below instead of re-derived from the request body.
  let inSession = null;
  if (checkType === 'OUT') {
    requireFields(req.body, ['pairedSessionId']);
    inSession = await AttendanceSession.findById(req.body.pairedSessionId);
    if (!inSession || inSession.checkType === 'OUT') {
      throw ApiError.badRequest('Select a valid check-in session to pair this check-out QR code with.');
    }
    assertProgramAccess(req.user, inSession.program);
    if (inSession.isSpecialClass) {
      await assertSpecialClassManager(req.user, inSession.program);
    } else {
      assertBrigadeAccess(req.user, inSession.brigadeId);
    }
  } else {
    assertEnum(req.body.program, PROGRAMS, 'program');
  }

  const program = inSession ? inSession.program : resolveProgramForCreate(req.user, req.body.program);
  const date = new Date(req.body.date);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Please provide a valid date.');
  }

  const startsAt = combineDateAndTime(date, req.body.startTime);
  const endsAt = combineDateAndTime(date, req.body.endTime);
  if (endsAt <= startsAt) {
    throw ApiError.badRequest('End time must be after the start time.');
  }

  let activityId = inSession ? inSession.activityId : req.body.activityId || null;
  // The assigned Special Class officer always creates Special Class
  // sessions — no toggle needed, since that's the only thing they manage.
  let isSpecialClass = inSession
    ? inSession.isSpecialClass
    : (req.user.role === 'officer' && (await isSpecialClassManager(req.user, program))) ||
      req.body.isSpecialClass === true ||
      req.body.isSpecialClass === 'true';
  if (!inSession && activityId) {
    const activity = await Activity.findById(activityId);
    if (!activity) throw ApiError.notFound('Activity not found.');
    assertProgramAccess(req.user, activity.program);
    if (activity.brigadeId) assertBrigadeAccess(req.user, activity.brigadeId);
    // A session for a Special Class activity is always Special Class too,
    // regardless of what the request body said.
    isSpecialClass = isSpecialClass || activity.isSpecialClass;
  }
  if (!inSession && isSpecialClass) {
    await assertSpecialClassManager(req.user, program);
  }

  // The officer's own brigade — never manually picked (spec §8: "the system
  // automatically knows the officer's brigade"). Special Class sessions are
  // always program-wide instead, since that roster cuts across brigades.
  const brigadeId = inSession
    ? inSession.brigadeId
    : isSpecialClass
      ? null
      : resolveBrigadeForCreate(req.user, req.body.brigadeId);
  const brigade = inSession ? null : brigadeId ? await Brigade.findById(brigadeId) : null;
  const brigadeName = inSession ? inSession.brigade : brigade ? brigade.name : '';

  // Optional further narrowing within the brigade (a ROTC platoon or a CWTS
  // section/task-force label) — left blank, the session stays open to the
  // whole brigade exactly as before. Not offered on Special Class sessions,
  // whose roster is already program-wide by design.
  const subgroup = inSession
    ? inSession.subgroup
    : !isSpecialClass && req.body.subgroup
      ? String(req.body.subgroup).trim()
      : '';
  const autoCloseAtEnd = req.body.autoCloseAtEnd === true || req.body.autoCloseAtEnd === 'true';

  const session = await AttendanceSession.create({
    activityId,
    program,
    brigadeId,
    brigade: brigadeName,
    isSpecialClass,
    subgroup,
    autoCloseAtEnd,
    checkType,
    pairedSessionId: inSession ? inSession._id : null,
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
  scopeFilterToProgram(filter, req.user, req.query.program);
  const program = filter.program || req.query.program;
  // The assigned Special Class officer has no separate "Special" tab — their
  // whole interface is the Special Class roster, so this defaults for them
  // without needing ?specialClass=true explicitly.
  const isOfficerSpecial =
    req.user.role === 'officer' && Boolean(program) && (await isSpecialClassManager(req.user, program));
  if (req.query.specialClass === 'true' || isOfficerSpecial) {
    // A Special Class session's brigadeId is always null, so the normal
    // brigade scoping below (which forces an officer onto their own
    // brigadeId) would hide these entirely — filter by the flag instead.
    if (!program) {
      throw ApiError.badRequest('program is required when requesting a Special Class list.');
    }
    await assertSpecialClassManager(req.user, program);
    filter.program = program;
    filter.isSpecialClass = true;
  } else {
    scopeFilterToBrigade(filter, req.user, req.query.brigadeId);
    filter.isSpecialClass = { $ne: true };
  }
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
  assertProgramAccess(req.user, session.program);
  if (session.isSpecialClass) {
    await assertSpecialClassManager(req.user, session.program);
  } else {
    assertBrigadeAccess(req.user, session.brigadeId);
  }

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
  assertProgramAccess(req.user, session.program);
  if (session.isSpecialClass) {
    // brigadeId is always null here — that means "program-wide" everywhere
    // else, but a Special Class session isn't open to every officer the way
    // a program-wide one is, so assertBrigadeAccess's null-brigade skip
    // would wrongly let any officer in; check the real gate instead.
    await assertSpecialClassManager(req.user, session.program);
  } else {
    assertBrigadeAccess(req.user, session.brigadeId);
  }

  // Closing an OUT session is the "finalize the day" moment for its paired
  // IN session: anyone who checked in there but never checked out here is
  // marked Absent — mirrors a real roll call cutoff, just for the exit gate
  // instead of the entry one.
  if (session.checkType === 'OUT') {
    const missingCheckout = session.pairedSessionId
      ? await Attendance.find({
          sessionId: session.pairedSessionId,
          checkOutAt: null,
          status: { $in: ['Present', 'Late'] },
        })
      : [];

    if (missingCheckout.length) {
      await Attendance.updateMany(
        { _id: { $in: missingCheckout.map((r) => r._id) } },
        {
          $set: {
            status: 'Absent',
            remarks: 'Checked in but did not check out.',
            recordedBy: req.user._id,
          },
        }
      );

      await Promise.all([
        ...missingCheckout.map((r) =>
          notifyUser(r.studentId, {
            title: 'Attendance recorded',
            message: `You were marked Absent for ${r.title || 'the session'} — you checked in but did not check out.`,
            type: 'attendance',
            data: { attendanceId: r._id },
          })
        ),
        ...missingCheckout.map((r) => recalculateGrade(r.studentId, r.program)),
      ]);
    }

    session.status = 'Closed';
    await session.save();

    return res.json({ success: true, data: session, markedAbsentCount: missingCheckout.length });
  }

  // Anyone in this session's roster without a successful scan is marked
  // Absent the moment the officer closes it — mirrors a real roll call
  // cutoff. Same routine the automatic end-of-session sweep uses, so it's a
  // no-op for anyone that sweep already handled.
  const markedAbsentCount = await markMissingAbsent(session, {
    recordedBy: req.user._id,
    remarks: 'Automatically marked absent when the session was closed.',
  });

  session.status = 'Closed';
  if (!session.absentSweptAt) session.absentSweptAt = new Date();
  await session.save();

  res.json({ success: true, data: session, markedAbsentCount });
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
  // No upper time bound here by default — scanning stays open (marked Late
  // once past the grace period below) for as long as the officer leaves the
  // session Active, even past its scheduled end time. The officer closing
  // the session is what actually cuts scanning off (checked above) and is
  // also what sweeps everyone still missing into Absent (see closeSession).
  // An officer can opt a session into a hard cutoff instead (autoCloseAtEnd).
  if (session.autoCloseAtEnd && now > session.endsAt) {
    throw ApiError.badRequest('This attendance session has ended.');
  }
  if (session.program !== req.user.program) {
    throw ApiError.forbidden(`This QR code is for ${session.program} only.`);
  }
  if (session.brigadeId && String(session.brigadeId) !== String(req.user.brigadeId)) {
    throw ApiError.forbidden(`You are not assigned to this ${session.program} brigade.`);
  }
  if (session.isSpecialClass && !(await isSpecialClassTrainee(req.user._id, req.user.role))) {
    throw ApiError.forbidden(`This QR code is for the ${session.program} Special Class track only.`);
  }
  if (session.subgroup) {
    if (session.program === 'ROTC') {
      const cadet = await Cadet.findOne({ userId: req.user._id }).select('platoon');
      if (!cadet || cadet.platoon !== session.subgroup) {
        throw ApiError.forbidden(`This QR code is for ${session.subgroup} platoon only.`);
      }
    } else if (req.user.section !== session.subgroup) {
      throw ApiError.forbidden(`This QR code is for ${session.subgroup} only.`);
    }
  }

  const { lateGraceMinutes, codeTtlMinutes } = attendanceRules();

  // Check-out QR: find the attendance row this trainee's matching check-in
  // created, and attach a check-out verification code to that SAME row
  // instead of creating a new one — one row per trainee per day stays true.
  if (session.checkType === 'OUT') {
    const checkInRecord = await Attendance.findOne({
      sessionId: session.pairedSessionId,
      studentId: req.user._id,
    }).select('+verificationCode +checkOutVerificationCode');

    if (!checkInRecord) {
      throw ApiError.badRequest('You must check in before you can check out.');
    }
    if (!checkInRecord.verified) {
      throw ApiError.badRequest('Please verify your check-in first.');
    }
    if (checkInRecord.checkOutAt) {
      throw ApiError.conflict('You have already checked out.');
    }

    const outCode = sixDigit();
    const outExpiresAt = addMinutes(now, codeTtlMinutes);
    checkInRecord.outSessionId = session._id;
    checkInRecord.checkOutVerificationCode = outCode;
    checkInRecord.checkOutVerificationExpiresAt = outExpiresAt;
    checkInRecord.checkOutVerificationAttempts = 0;
    await checkInRecord.save();

    const outMail = await sendAttendanceCode({
      to: req.user.email,
      name: req.user.name,
      code: outCode,
      sessionTitle: session.title || `${session.program} Check-Out`,
      minutes: codeTtlMinutes,
    });

    return res.status(201).json({
      success: true,
      message: codeSentMessage(outMail, req.user.email),
      data: {
        attendanceId: checkInRecord._id,
        sessionId: session.pairedSessionId,
        status: checkInRecord.status,
        time: checkInRecord.time,
        emailSent: outMail.delivered,
        expiresAt: outExpiresAt,
      },
    });
  }

  const existing = await Attendance.findOne({
    sessionId: session._id,
    studentId: req.user._id,
  });
  // An Absent the system wrote on its own at the scheduled end time doesn't
  // block a scan while the officer still leaves the session open — the
  // trainee arrived after all, so the normal late policy below applies.
  if (existing && existing.verified && !existing.autoAbsent) {
    throw ApiError.conflict('You have already recorded attendance for this session.');
  }

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
        brigadeId: session.brigadeId,
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
        verificationAttempts: 0,
        autoAbsent: false,
        remarks: '',
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
    message: codeSentMessage(mail, req.user.email),
    data: {
      attendanceId: record._id,
      sessionId: session._id,
      status: record.status,
      time: record.time,
      emailSent: mail.delivered,
      expiresAt,
    },
  });
});

/**
 * POST /api/attendance/verify
 * Step 2: confirms the emailed code and finalises the attendance record.
 */
exports.verify = asyncHandler(async (req, res) => {
  requireFields(req.body, ['verificationCode']);

  // A row can have a pending check-in code, a pending check-out code, or
  // (once check-in is verified but check-out hasn't been scanned yet)
  // neither — never both at once, since check-out can't start until
  // check-in is verified. Whichever one is pending is the one being verified.
  const filter = { studentId: req.user._id };
  if (req.body.attendanceId) {
    filter._id = req.body.attendanceId;
  } else if (req.body.sessionId) {
    filter.$or = [{ sessionId: req.body.sessionId }, { outSessionId: req.body.sessionId }];
  } else {
    filter.$or = [{ verified: false }, { checkOutVerificationCode: { $ne: null } }];
  }

  const record = await Attendance.findOne(filter)
    .select('+verificationCode +checkOutVerificationCode +verificationAttempts +checkOutVerificationAttempts')
    .sort({ updatedAt: -1 });

  if (!record) {
    throw ApiError.notFound('No pending attendance found. Please scan the QR code again.');
  }

  const isCheckOut = record.verified && Boolean(record.checkOutVerificationCode);
  const pendingCode = isCheckOut ? record.checkOutVerificationCode : record.verificationCode;

  if (!pendingCode) {
    throw ApiError.notFound('No pending attendance found. Please scan the QR code again.');
  }
  // Expiry + a capped number of wrong guesses; clears the code on success.
  await checkCode(record, {
    codeField: isCheckOut ? 'checkOutVerificationCode' : 'verificationCode',
    expiresField: isCheckOut ? 'checkOutVerificationExpiresAt' : 'verificationExpiresAt',
    attemptsField: isCheckOut ? 'checkOutVerificationAttempts' : 'verificationAttempts',
    input: req.body.verificationCode,
    restartHint: 'Please scan the QR code again.',
  });

  if (isCheckOut) {
    const now = new Date();
    record.checkOutAt = now;
    record.checkOutTime = formatTime12h(now);
  } else {
    record.verified = true;
  }
  await record.save();

  await Promise.all([
    notifyUser(req.user._id, {
      title: 'Attendance recorded',
      message: isCheckOut
        ? `You checked out for ${record.title || 'the session'}.`
        : `You were marked ${record.status} for ${record.title || 'the session'}.`,
      type: 'attendance',
      data: { attendanceId: record._id },
    }),
    recalculateGrade(req.user._id, record.program),
  ]);

  res.json({
    success: true,
    message: isCheckOut
      ? `Checked out at ${record.checkOutTime}.`
      : `Attendance recorded. You were marked ${record.status}.`,
    data: isCheckOut ? { ...record.toObject(), time: record.checkOutTime } : record,
  });
});

// ============================================================
// LIST / MANUAL / UPDATE
// ============================================================

/** GET /api/attendance */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  scopeFilterToProgram(filter, req.user, req.query.program);
  // A Special Class session/record's brigadeId is always null, so the usual
  // scopeFilterToBrigade (which forces an officer onto their own personal
  // brigade) would never match — the assigned Special Class officer is
  // scoped to their trainee roster by studentId instead.
  if (req.user.role === 'officer' && (await isSpecialClassManager(req.user, filter.program))) {
    filter.studentId = { $in: await specialClassTraineeIds(filter.program) };
  } else {
    scopeFilterToBrigade(filter, req.user, req.query.brigadeId);
  }
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;
  if (req.query.activityId) filter.activityId = req.query.activityId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.date) {
    const d = new Date(req.query.date);
    filter.date = { $gte: startOfDay(d), $lte: endOfDay(d) };
  }

  // Trainees may only ever see their own rows.
  if (TRAINEE_ROLES.includes(req.user.role)) {
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

  // 'IN' (the default) is today's original manual-mark behaviour — pick a
  // status and write/update the row. 'OUT' instead finds each student's
  // already-checked-in row for the day and stamps a check-out time onto it;
  // it never creates a row on its own, since you can't check out before
  // checking in.
  const checkType = req.body.checkType ? String(req.body.checkType).toUpperCase() : 'IN';
  assertEnum(checkType, SESSION_CHECK_TYPES, 'checkType');
  if (checkType === 'IN') {
    assertEnum(req.body.status, ATTENDANCE_STATUSES, 'status');
  }

  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Please provide a valid date.');
  }

  let session = null;
  if (req.body.sessionId) {
    session = await AttendanceSession.findById(req.body.sessionId);
    if (!session) throw ApiError.notFound('Attendance session not found.');
    assertProgramAccess(req.user, session.program);
    if (session.isSpecialClass) {
      await assertSpecialClassManager(req.user, session.program);
    } else {
      assertBrigadeAccess(req.user, session.brigadeId);
    }
  }

  const users = await User.find({
    _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) },
  });
  if (users.length !== ids.length) {
    throw ApiError.badRequest('One or more selected students could not be found.');
  }

  const program = session ? session.program : resolveProgramForCreate(req.user, req.body.program);
  if (users.some((u) => u.program !== program)) {
    throw ApiError.badRequest('All selected students must belong to the same program.');
  }

  // The assigned Special Class officer's manual markings are always Special
  // Class — no toggle needed, since that's the only roster they manage.
  const isSpecialClass = session
    ? session.isSpecialClass
    : req.body.isSpecialClass === true ||
      req.body.isSpecialClass === 'true' ||
      (req.user.role === 'officer' && (await isSpecialClassManager(req.user, program)));

  if (isSpecialClass && !session) {
    await assertSpecialClassManager(req.user, program);
  }

  // An officer's manual roster search is already scoped to their own
  // brigade (see userController's roster endpoint), but re-check here too —
  // an officer must not be able to mark a student from another brigade by
  // constructing the request directly. A Special Class marking checks
  // Special Class membership instead, since that roster cuts across brigades.
  const brigadeId = isSpecialClass
    ? null
    : session
      ? session.brigadeId
      : resolveBrigadeForCreate(req.user, req.body.brigadeId);
  if (isSpecialClass) {
    const ProfileModel = program === 'ROTC' ? Cadet : Student;
    const eligible = await ProfileModel.find({
      program,
      specialCategory: { $in: SPECIAL_CLASS_CATEGORIES },
      status: 'Active',
    }).select('userId');
    const eligibleIds = new Set(eligible.map((c) => String(c.userId)));
    if (users.some((u) => !eligibleIds.has(String(u._id)))) {
      throw ApiError.forbidden('All selected cadets must be in the ROTC Special Class track.');
    }
  } else if (brigadeId && users.some((u) => String(u.brigadeId || '') !== String(brigadeId))) {
    throw ApiError.forbidden('All selected students must belong to your assigned brigade.');
  }

  const status = req.body.status || 'Present';
  const now = new Date();

  const results = [];
  const skipped = [];
  const failed = [];

  for (const user of users) {
    const dedupe = session
      ? { sessionId: session._id, studentId: user._id }
      : {
          studentId: user._id,
          date: { $gte: startOfDay(date), $lte: endOfDay(date) },
          title: req.body.title || session?.title || `${program} Attendance`,
        };

    if (checkType === 'OUT') {
      const existing = await Attendance.findOne(dedupe);
      if (!existing) {
        failed.push({ studentId: user._id, reason: 'Has not checked in yet.' });
        continue;
      }
      if (existing.checkOutAt) {
        skipped.push({ studentId: user._id, action: 'already checked out' });
        results.push(existing);
        continue;
      }
      existing.checkOutAt = now;
      existing.checkOutTime = req.body.time || formatTime12h(now);
      existing.recordedBy = req.user._id;
      if (req.body.remarks) existing.remarks = req.body.remarks;
      await existing.save();
      results.push(existing);

      await notifyUser(user._id, {
        title: 'Attendance updated',
        message: `You checked out for ${existing.title}.`,
        type: 'attendance',
        data: { attendanceId: existing._id },
      });
      continue;
    }

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
      brigadeId: brigadeId || user.brigadeId || null,
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
    message:
      checkType === 'OUT'
        ? `${results.length} student(s) checked out.${failed.length ? ` ${failed.length} have not checked in yet.` : ''}`
        : `${results.length} attendance record(s) saved.`,
    count: results.length,
    updated: skipped.length,
    failed: failed.length,
    data: results,
  });
});

/**
 * POST /api/attendance/finalize
 * "Finalize the day" for manual/ad hoc attendance that has no
 * AttendanceSession to close (the QR equivalent is closing an OUT session —
 * see closeSession). Marks Absent anyone in the given day/title/brigade
 * scope who checked in but never checked out.
 */
exports.finalizeDay = asyncHandler(async (req, res) => {
  requireFields(req.body, ['date']);

  const date = new Date(req.body.date);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Please provide a valid date.');
  }

  const program = req.user.role === 'super_admin' ? req.body.program || 'CWTS' : req.user.program;
  const isOfficerSpecial = req.user.role === 'officer' && (await isSpecialClassManager(req.user, program));

  const filter = {
    program,
    date: { $gte: startOfDay(date), $lte: endOfDay(date) },
    checkOutAt: null,
    status: { $in: ['Present', 'Late'] },
  };
  if (req.body.title) filter.title = req.body.title;

  if (isOfficerSpecial) {
    filter.studentId = { $in: await specialClassTraineeIds(program) };
  } else {
    scopeFilterToBrigade(filter, req.user, req.body.brigadeId);
  }

  const missingCheckout = await Attendance.find(filter);

  if (missingCheckout.length) {
    await Attendance.updateMany(
      { _id: { $in: missingCheckout.map((r) => r._id) } },
      {
        $set: {
          status: 'Absent',
          remarks: 'Checked in but did not check out.',
          recordedBy: req.user._id,
        },
      }
    );

    await Promise.all([
      ...missingCheckout.map((r) =>
        notifyUser(r.studentId, {
          title: 'Attendance recorded',
          message: `You were marked Absent for ${r.title || 'the session'} — you checked in but did not check out.`,
          type: 'attendance',
          data: { attendanceId: r._id },
        })
      ),
      ...missingCheckout.map((r) => recalculateGrade(r.studentId, r.program)),
    ]);
  }

  res.json({
    success: true,
    message: missingCheckout.length
      ? `${missingCheckout.length} student(s) marked Absent for missing check-out.`
      : 'Everyone who checked in also checked out — nothing to finalize.',
    markedAbsentCount: missingCheckout.length,
  });
});

/** PUT /api/attendance/:id */
exports.update = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) throw ApiError.notFound('Attendance record not found.');
  assertProgramAccess(req.user, record.program);
  assertBrigadeAccess(req.user, record.brigadeId);

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
  assertProgramAccess(req.user, record.program);
  assertBrigadeAccess(req.user, record.brigadeId);

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
  const program =
    req.user.role === 'super_admin'
      ? req.query.program || 'CWTS'
      : req.user.program;
  const date = req.query.date ? new Date(req.query.date) : new Date();

  // Officers only ever see their own brigade's numbers here — an officer
  // with no brigade assigned yet sees all-zero rather than the whole program.
  // The assigned Special Class officer has no separate tab, so this screen
  // is their Attendance tab too — scoped by their trainee roster instead,
  // since Special Class attendance is always program-wide (brigadeId: null).
  // Kept separate from `brigadeFilter` below since Attendance.studentId (a
  // User ref) and User.studentId (the trainee's ID number string) are
  // unrelated fields that just happen to share a name.
  const isOfficerSpecial =
    req.user.role === 'officer' && (await isSpecialClassManager(req.user, program));
  const brigadeFilter = {};
  let totalStudentsQuery;
  if (isOfficerSpecial) {
    const traineeIds = await specialClassTraineeIds(program);
    brigadeFilter.studentId = { $in: traineeIds };
    totalStudentsQuery = Promise.resolve(traineeIds.length);
  } else {
    scopeFilterToBrigade(brigadeFilter, req.user, req.query.brigadeId);
    totalStudentsQuery = User.countDocuments({
      role: program === 'ROTC' ? 'cadet' : 'student',
      program,
      ...brigadeFilter,
      status: 'Active',
    });
  }

  const dayFilter = {
    program,
    ...brigadeFilter,
    date: { $gte: startOfDay(date), $lte: endOfDay(date) },
  };

  const [dayRows, totalStudents, trendRows, overallRows] = await Promise.all([
    Attendance.aggregate([
      { $match: dayFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    totalStudentsQuery,
    Attendance.aggregate([
      {
        $match: {
          program,
          ...brigadeFilter,
          date: {
            $gte: new Date(date.getFullYear(), date.getMonth(), 1),
            $lte: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: APP_TIMEZONE } },
          present: {
            $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Excused']] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: { program, ...brigadeFilter } },
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
