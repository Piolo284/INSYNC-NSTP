const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const { SPECIAL_CLASS_CATEGORIES } = require('../config/constants');
const { notifyUser } = require('./notify');
const { recalculateGrade } = require('./gradeCalculator');

/**
 * Everyone expected to attend `session` — the same roster a trainee's scan
 * is checked against in attendanceController.scan (program + brigade, an
 * optional platoon/section subgroup, or the Special Class track).
 */
async function expectedRoster(session) {
  if (session.isSpecialClass) {
    const ProfileModel = session.program === 'ROTC' ? Cadet : Student;
    const eligible = await ProfileModel.find({
      program: session.program,
      specialCategory: { $in: SPECIAL_CLASS_CATEGORIES },
      status: 'Active',
    }).select('userId');
    return User.find({ _id: { $in: eligible.map((c) => c.userId) }, status: 'Active' }).select('_id');
  }

  const rosterFilter = {
    role: session.program === 'ROTC' ? 'cadet' : 'student',
    program: session.program,
    status: 'Active',
  };
  if (session.brigadeId) rosterFilter.brigadeId = session.brigadeId;
  // A session narrowed to a platoon/section only ever had that subgroup's
  // roster in scope — never sweep the rest of the brigade into Absent for a
  // session they were never eligible to scan into.
  if (session.subgroup) {
    if (session.program === 'ROTC') {
      const matches = await Cadet.find({ platoon: session.subgroup, status: 'Active' }).select('userId');
      rosterFilter._id = { $in: matches.map((c) => c.userId) };
    } else {
      rosterFilter.section = session.subgroup;
    }
  }
  return User.find(rosterFilter).select('_id');
}

/**
 * Marks Absent every expected trainee of a check-IN session who has no
 * successful (verified) scan. Covers both trainees with no row at all and
 * trainees who scanned but never confirmed the emailed code. Idempotent —
 * running it twice never creates a second row (unique {sessionId, studentId}
 * index) and never touches a verified Present/Late/Excused record.
 *
 * Returns how many trainees were newly marked Absent.
 */
async function markMissingAbsent(session, { recordedBy = null, remarks } = {}) {
  const note = remarks || 'Automatically marked absent — no QR scan before the session ended.';
  const roster = await expectedRoster(session);

  const records = await Attendance.find({ sessionId: session._id }).select('studentId verified');
  const verifiedIds = new Set(records.filter((r) => r.verified).map((r) => String(r.studentId)));
  const pendingIds = new Set(records.filter((r) => !r.verified).map((r) => String(r.studentId)));

  const withoutRecord = roster.filter(
    (u) => !verifiedIds.has(String(u._id)) && !pendingIds.has(String(u._id))
  );
  const pending = roster.filter((u) => pendingIds.has(String(u._id)));

  if (withoutRecord.length) {
    try {
      await Attendance.insertMany(
        withoutRecord.map((u) => ({
          sessionId: session._id,
          activityId: session.activityId,
          brigadeId: session.brigadeId,
          studentId: u._id,
          program: session.program,
          title: session.title,
          date: session.date,
          time: '',
          status: 'Absent',
          attendanceMethod: 'Manual',
          verified: true,
          autoAbsent: true,
          remarks: note,
          recordedBy,
        })),
        { ordered: false }
      );
    } catch (err) {
      // A trainee may have scanned at the same instant — the unique
      // {sessionId, studentId} index rejects just that row while every
      // other Absent row still inserts (ordered: false).
      const isDuplicateOnly =
        err.code === 11000 ||
        (Array.isArray(err.writeErrors) && err.writeErrors.every((e) => e.code === 11000));
      if (!isDuplicateOnly) throw err;
    }
  }

  // Scanned but never entered the emailed code → not a successful scan.
  if (pending.length) {
    await Attendance.updateMany(
      { sessionId: session._id, studentId: { $in: pending.map((u) => u._id) }, verified: false },
      {
        $set: {
          status: 'Absent',
          time: '',
          verified: true,
          autoAbsent: true,
          verificationCode: null,
          verificationExpiresAt: null,
          remarks: `${note} (QR scan was never verified.)`,
          recordedBy,
        },
      }
    );
  }

  const newlyAbsent = [...withoutRecord, ...pending];
  if (newlyAbsent.length) {
    await Promise.all([
      ...newlyAbsent.map((u) =>
        notifyUser(u._id, {
          title: 'Attendance recorded',
          message: `You were marked Absent for ${session.title || 'the session'}.`,
          type: 'attendance',
          data: { sessionId: session._id },
        })
      ),
      // Idempotent — recomputes from whatever attendance is actually on record.
      ...newlyAbsent.map((u) => recalculateGrade(u._id, session.program)),
    ]);
  }

  return newlyAbsent.length;
}

/**
 * The automatic end-of-session step: every Active check-IN session whose
 * scheduled end time has passed and hasn't been swept yet gets its
 * no-shows marked Absent. A session set to auto-close at its end time is
 * also closed here (scanning is already refused for it). Any other session
 * stays Active until the officer closes it, so a late arrival can still
 * scan under the existing late policy (see attendanceController.scan).
 */
async function sweepEndedSessions(now = new Date()) {
  const due = await AttendanceSession.find({
    status: 'Active',
    checkType: { $ne: 'OUT' },
    endsAt: { $lte: now },
    absentSweptAt: null,
  }).limit(50);

  let marked = 0;
  for (const session of due) {
    // Claim the session first so two server instances never sweep it twice.
    const claimed = await AttendanceSession.findOneAndUpdate(
      { _id: session._id, absentSweptAt: null },
      {
        $set: {
          absentSweptAt: now,
          ...(session.autoCloseAtEnd ? { status: 'Closed' } : {}),
        },
      },
      { new: true }
    );
    if (!claimed) continue;
    try {
      marked += await markMissingAbsent(claimed);
    } catch (err) {
      // Release the claim so the next run retries this session.
      await AttendanceSession.updateOne({ _id: session._id }, { $set: { absentSweptAt: null } });
      console.error(`[attendance-sweep] session ${session._id}:`, err.message);
    }
  }
  return { sessions: due.length, marked };
}

let lastRunAt = 0;
let running = null;

/**
 * Throttled wrapper (at most once per `intervalMs` per server instance) so
 * it is cheap enough to call from a timer AND from incoming requests — the
 * latter is what keeps it working on Vercel, where no background timer
 * survives between requests. Never throws.
 */
async function maybeSweepEndedSessions(intervalMs = 60 * 1000) {
  if (running) return running;
  if (Date.now() - lastRunAt < intervalMs) return null;
  lastRunAt = Date.now();
  running = sweepEndedSessions()
    .catch((err) => {
      console.error('[attendance-sweep] failed:', err.message);
      return null;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

module.exports = {
  expectedRoster,
  markMissingAbsent,
  sweepEndedSessions,
  maybeSweepEndedSessions,
};
