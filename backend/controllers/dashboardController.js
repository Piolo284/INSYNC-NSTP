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
 * GET /api/dashboard/instructor
 * Fills the instructor home screen: module count, enrolled trainees,
 * attendance rate, announcement count, class breakdown and recent activity.
 */
exports.instructor = asyncHandler(async (req, res) => {
  const program = req.query.program || req.user.program || 'CWTS';
  const traineeRole = program === 'ROTC' ? 'cadet' : 'student';

  const [
    modules,
    enrolled,
    statusRows,
    announcements,
    recentSubmissions,
    trend,
  ] = await Promise.all([
    ModuleModel.countDocuments({ program, status: { $ne: 'Archived' } }),
    User.countDocuments({ role: traineeRole, program, status: 'Active' }),
    Attendance.aggregate([
      { $match: { program } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Announcement.countDocuments({
      status: 'Published',
      program: { $in: [program, 'All'] },
    }),
    Submission.find()
      .populate('studentId', 'name studentId program')
      .populate('moduleId', 'title program')
      .sort({ submittedAt: -1 })
      .limit(10),
    attendanceTrend(program),
  ]);

  const status = toMap(statusRows);
  const present = status.Present || 0;
  const late = status.Late || 0;
  const excused = status.Excused || 0;
  const absent = status.Absent || 0;
  const total = present + late + excused + absent;

  const profile = await profileFor(req.user);

  res.json({
    success: true,
    data: {
      user: req.user.toPublic(),
      profile,
      program,
      overview: {
        modules,
        enrolledStudents: enrolled,
        attendanceRate: total ? Math.round(((present + late + excused) / total) * 100) : 0,
        announcements,
      },
      classOverview: { present, absent, late, excused, total },
      trend,
      recentActivities: recentSubmissions
        .filter((s) => !s.moduleId || s.moduleId.program === program)
        .slice(0, 5)
        .map((s) => ({
          _id: s._id,
          title: s.moduleId
            ? `${s.studentId?.name || 'A trainee'} submitted ${s.moduleId.title}`
            : `${s.studentId?.name || 'A trainee'} submitted an activity`,
          date: s.submittedAt,
          status: s.status,
        })),
    },
  });
});

/**
 * GET /api/dashboard/admin
 * Every admin-managed count in one payload — users by role, per-program
 * trainee counts, and content totals.
 */
exports.admin = asyncHandler(async (req, res) => {
  const today = new Date();

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
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { role: { $in: ['student', 'cadet'] } } },
      { $group: { _id: '$program', count: { $sum: 1 } } },
    ]),
    Activity.countDocuments(),
    Announcement.countDocuments(),
    ModuleModel.countDocuments(),
    Submission.countDocuments(),
    Attendance.countDocuments({
      date: { $gte: startOfDay(today), $lte: endOfDay(today) },
    }),
    Grade.aggregate([{ $group: { _id: '$remarks', count: { $sum: 1 } } }]),
  ]);

  const byRole = toMap(roleRows);

  res.json({
    success: true,
    data: {
      users: {
        total: Object.values(byRole).reduce((a, b) => a + b, 0),
        students: byRole.student || 0,
        cadets: byRole.cadet || 0,
        officers: byRole.officer || 0,
        instructors: byRole.instructor || 0,
        admins: byRole.admin || 0,
      },
      programs: toMap(programRows),
      content: { activities, announcements, modules, submissions },
      attendanceToday,
      grades: toMap(grades),
    },
  });
});
