const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Attendance = require('../models/Attendance');
const Announcement = require('../models/Announcement');
const Activity = require('../models/Activity');
const ModuleModel = require('../models/Module');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const CertificateRequest = require('../models/CertificateRequest');
const asyncHandler = require('../utils/asyncHandler');
const { APP_TIMEZONE, startOfDay, endOfDay } = require('../utils/datetime');
const { isSpecialClassManager, specialClassTraineeIds } = require('../utils/specialClass');
const { scopeFilterToBrigade } = require('../utils/brigadeScope');
const { profileFor } = require('./authController');

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

/**
 * One status per trainee per DAY. A day can hold several sessions (morning
 * and afternoon, a re-run QR...), so counting raw attendance rows made the
 * tiles add up past the roster (e.g. 112 "absents" out of 31 cadets). A
 * trainee's day counts as their best status that day:
 * Present > Late > Excused > Absent.
 */
const DAY_STATUS_RANK = { Absent: 1, Excused: 2, Late: 3, Present: 4 };
const dayStatusRank = {
  $switch: {
    branches: Object.entries(DAY_STATUS_RANK).map(([status, rank]) => ({
      case: { $eq: ['$status', status] },
      then: rank,
    })),
    default: 0,
  },
};
const rankToStatus = (rank) =>
  Object.keys(DAY_STATUS_RANK).find((s) => DAY_STATUS_RANK[s] === rank);

/** Absences needed (counted in DAYS, not sessions) to flag a trainee At-Risk. */
const AT_RISK_ABSENT_DAYS = 3;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Percent change from `previous` to `current`. `null` (not 0%) when there's
 * no earlier baseline to compare against — a fresh count isn't a "0% change",
 * it's simply not comparable yet. */
function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Today's attendance rate broken down by the hour each record was actually
 * logged (`createdAt`), not the whole month — the officer home screen's
 * "Overview" section is already scoped to today, so the trend under it
 * should read the same way instead of jumping out to a month view.
 */
async function attendanceTrend(program, reference = new Date(), extraMatch = {}) {
  const rows = await Attendance.aggregate([
    {
      $match: {
        program,
        ...extraMatch,
        date: { $gte: startOfDay(reference), $lte: endOfDay(reference) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$createdAt', timezone: APP_TIMEZONE } },
        present: {
          $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Excused']] }, 1, 0] },
        },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    date: r._id,
    value: r.total ? Math.round((r.present / r.total) * 100) / 100 : 0,
  }));
}

/**
 * GET /api/dashboard/officer
 * Fills the officer home screen: present/absent/late/at-risk/total counters,
 * the monthly attendance trend line, and the most recent announcements.
 */
exports.officer = asyncHandler(async (req, res) => {
  const program = req.query.program || req.user.program || 'CWTS';
  // The Presents/Absents/Late/Excused tiles are "today's" counts, not a
  // running total since the program started — scope to the given date (or
  // today by default), same as attendanceController.summary's day totals.
  const referenceDate = req.query.date ? new Date(req.query.date) : new Date();

  // The dedicated Special Class officer only manages the PWD/Medical
  // Condition trainees (program-wide, cutting across every brigade), not
  // the whole program roster a regular brigade officer would see — so every
  // count below is scoped to that trainee set instead of `program` alone.
  const isSpecialOfficer =
    req.user.role === 'officer' && (await isSpecialClassManager(req.user, program));
  let extraMatch = {};
  let totalStudentsQuery;
  if (isSpecialOfficer) {
    const traineeIds = await specialClassTraineeIds(program);
    extraMatch = { studentId: { $in: traineeIds } };
    totalStudentsQuery = Promise.resolve(traineeIds.length);
  } else if (req.user.role === 'officer') {
    // A regular officer only monitors the trainees they handle — the roster
    // on their Cadets/Students tab (their own company/brigade). The total
    // AND every attendance count (presents, absents, at-risk, trend) are
    // scoped to exactly those trainees, matched by student rather than by
    // the record's brigade snapshot, so attendance from before a cadet was
    // added to this officer still counts and other companies' never does.
    const rosterFilter = scopeFilterToBrigade({ program }, req.user);
    const RosterModel = program === 'ROTC' ? Cadet : Student;
    const roster = await RosterModel.find(rosterFilter).select('userId').lean();
    const traineeIds = roster.map((r) => r.userId).filter(Boolean);
    extraMatch = { studentId: { $in: traineeIds } };
    totalStudentsQuery = Promise.resolve(roster.length);
  } else {
    // Admin roles see the whole program unless they pass ?brigadeId.
    scopeFilterToBrigade(extraMatch, req.user, req.query.brigadeId);
    const RosterModel = program === 'ROTC' ? Cadet : Student;
    totalStudentsQuery = RosterModel.countDocuments({ program, ...extraMatch });
  }

  // Trainees at the absence limit waiting for this officer's drop decision.
  const pendingDropFilter = {
    role: program === 'ROTC' ? 'cadet' : 'student',
    program,
    status: { $ne: 'Dropped' },
    dropPendingSince: { $ne: null },
    ...(extraMatch.studentId ? { _id: extraMatch.studentId } : {}),
    ...(extraMatch.brigadeId !== undefined ? { brigadeId: extraMatch.brigadeId } : {}),
  };

  const [statusRows, totalStudents, atRiskRows, announcements, trend, pendingDrops] =
    await Promise.all([
      // The day's sessions/events → one status per trainee (see dayStatusRank).
      // A scan whose emailed code was never entered isn't attendance yet.
      Attendance.aggregate([
        {
          $match: {
            program,
            ...extraMatch,
            verified: { $ne: false },
            date: { $gte: startOfDay(referenceDate), $lte: endOfDay(referenceDate) },
          },
        },
        { $group: { _id: '$studentId', rank: { $max: dayStatusRank } } },
        { $group: { _id: '$rank', count: { $sum: 1 } } },
      ]),
      totalStudentsQuery,
      // At-Risk: absent on 3+ separate DAYS (a day with several missed
      // sessions is one absence, matching the per-day tiles above). A day is
      // an absence only if the trainee wasn't Present/Late/Excused in any of
      // that day's sessions.
      Attendance.aggregate([
        { $match: { program, ...extraMatch, verified: { $ne: false } } },
        {
          $group: {
            _id: {
              studentId: '$studentId',
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: APP_TIMEZONE } },
            },
            rank: { $max: dayStatusRank },
          },
        },
        { $match: { rank: DAY_STATUS_RANK.Absent } },
        { $group: { _id: '$_id.studentId', absentDays: { $sum: 1 } } },
        { $match: { absentDays: { $gte: AT_RISK_ABSENT_DAYS } } },
      ]),
      Announcement.find({
        status: 'Published',
        program: { $in: [program, 'All'] },
      })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(5),
      attendanceTrend(program, referenceDate, extraMatch),
      User.countDocuments(pendingDropFilter),
    ]);

  const status = Object.fromEntries(statusRows.map((r) => [rankToStatus(r._id), r.count]));
  const profile = await profileFor(req.user);

  res.json({
    success: true,
    data: {
      user: req.user.toPublic(),
      profile,
      program,
      overview: {
        presents: status.Present || 0,
        absents: status.Absent || 0,
        late: status.Late || 0,
        excused: status.Excused || 0,
        atRisk: atRiskRows.length,
        pendingDrops,
        totalStudents,
      },
      trend,
      announcements,
    },
  });
});

/**
 * GET /api/dashboard/admin
 * Every admin-managed count in one payload — users by role, per-program
 * trainee counts, and content totals. super_admin gets the full CWTS+ROTC
 * picture; admin_cwts/admin_rotc get the identical shape scoped to their
 * own program only.
 */
exports.admin = asyncHandler(async (req, res) => {
  const today = new Date();
  const isSuperAdmin = req.user.role === 'super_admin';
  const programFilter = isSuperAdmin ? {} : { program: req.user.program };
  const contentFilter = isSuperAdmin ? {} : { program: req.user.program };
  const attendanceFilter = isSuperAdmin ? {} : { program: req.user.program };
  const gradeFilter = isSuperAdmin ? {} : { program: req.user.program };

  // Trend baselines — derived entirely from existing createdAt/date fields,
  // no separate historical-snapshot table needed. "School year" and "month"
  // are approximated as rolling 365-/30-day windows rather than calendar
  // academic-year boundaries (the app has no configured AY start date yet).
  const schoolYearAgo = new Date(today.getTime() - 365 * ONE_DAY_MS);
  const monthAgo = new Date(today.getTime() - 30 * ONE_DAY_MS);
  const yesterday = new Date(today.getTime() - ONE_DAY_MS);
  const announcementFilter = isSuperAdmin ? {} : { program: { $in: [req.user.program, 'All'] } };

  const [
    roleRows,
    programRows,
    activities,
    announcements,
    modules,
    submissions,
    attendanceToday,
    grades,
    studentsPrev,
    cadetsPrev,
    officersPrev,
    announcementsPrev,
    attendanceYesterday,
    certificatesPending,
  ] = await Promise.all([
    User.aggregate([
      { $match: programFilter },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: { $in: ['student', 'cadet'] }, ...programFilter } },
      { $group: { _id: '$program', count: { $sum: 1 } } },
    ]),
    Activity.countDocuments(contentFilter),
    Announcement.countDocuments(announcementFilter),
    ModuleModel.countDocuments(contentFilter),
    Submission.countDocuments(), // Submission has no direct program field.
    Attendance.countDocuments({
      ...attendanceFilter,
      date: { $gte: startOfDay(today), $lte: endOfDay(today) },
    }),
    Grade.aggregate([
      { $match: gradeFilter },
      { $group: { _id: '$remarks', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'student', ...programFilter, createdAt: { $lte: schoolYearAgo } }),
    User.countDocuments({ role: 'cadet', ...programFilter, createdAt: { $lte: schoolYearAgo } }),
    User.countDocuments({ role: 'officer', ...programFilter, createdAt: { $lte: monthAgo } }),
    Announcement.countDocuments({ ...announcementFilter, createdAt: { $lte: monthAgo } }),
    Attendance.countDocuments({
      ...attendanceFilter,
      date: { $gte: startOfDay(yesterday), $lte: endOfDay(yesterday) },
    }),
    CertificateRequest.countDocuments({ ...contentFilter, status: 'Pending' }),
  ]);

  const byRole = toMap(roleRows);

  res.json({
    success: true,
    data: {
      program: isSuperAdmin ? null : req.user.program,
      users: {
        total: Object.values(byRole).reduce((a, b) => a + b, 0),
        students: byRole.student || 0,
        cadets: byRole.cadet || 0,
        officers: byRole.officer || 0,
        adminCwts: byRole.admin_cwts || 0,
        adminRotc: byRole.admin_rotc || 0,
        superAdmins: byRole.super_admin || 0,
      },
      programs: toMap(programRows),
      content: { activities, announcements, modules, submissions },
      attendanceToday,
      certificatesPending,
      grades: toMap(grades),
      trends: {
        students: { changePercent: percentChange(byRole.student || 0, studentsPrev), compareLabel: 'vs last school year' },
        cadets: { changePercent: percentChange(byRole.cadet || 0, cadetsPrev), compareLabel: 'vs last school year' },
        officers: { changePercent: percentChange(byRole.officer || 0, officersPrev), compareLabel: 'vs last month' },
        announcements: { changePercent: percentChange(announcements, announcementsPrev), compareLabel: 'vs last month' },
        attendanceToday: { changePercent: percentChange(attendanceToday, attendanceYesterday), compareLabel: 'vs yesterday' },
      },
    },
  });
});
