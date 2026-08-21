const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Announcement = require('../models/Announcement');
const Activity = require('../models/Activity');
const ModuleModel = require('../models/Module');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, endOfDay } = require('../utils/datetime');
const { profileFor } = require('./authController');

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

async function attendanceTrend(program, reference = new Date()) {
  const rows = await Attendance.aggregate([
    {
      $match: {
        program,
        date: {
          $gte: new Date(reference.getFullYear(), reference.getMonth(), 1),
          $lte: new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59),
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
  const traineeRole = program === 'ROTC' ? 'cadet' : 'student';

  const [statusRows, totalStudents, atRiskRows, announcements, trend] =
    await Promise.all([
      Attendance.aggregate([
        { $match: { program } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: traineeRole, program, status: 'Active' }),
      Attendance.aggregate([
        { $match: { program, status: 'Absent' } },
        { $group: { _id: '$studentId', absents: { $sum: 1 } } },
        { $match: { absents: { $gte: 3 } } },
      ]),
      Announcement.find({
        status: 'Published',
        program: { $in: [program, 'All'] },
      })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(5),
      attendanceTrend(program),
    ]);

  const status = toMap(statusRows);
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

  const [
    roleRows,
    programRows,
    activities,
    announcements,
    modules,
    submissions,
    attendanceToday,
    grades,
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
    Announcement.countDocuments(
      isSuperAdmin ? {} : { program: { $in: [req.user.program, 'All'] } }
    ),
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
      grades: toMap(grades),
    },
  });
});
