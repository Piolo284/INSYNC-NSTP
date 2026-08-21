const mongoose = require('mongoose');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Announcement = require('../models/Announcement');
const ModuleModel = require('../models/Module');
const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertSelfOrStaff } = require('../middleware/auth');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { ADMIN_ROLES } = require('../config/constants');
const { requireFields, isValidEmail } = require('../utils/validate');
const { assertProgramAccess, scopeFilterToProgram } = require('../utils/programScope');

/**
 * Resolves ":id" against either the User _id, the Student _id, or the human
 * student number, so screens can pass whichever identifier they hold.
 */
async function resolveStudent(idOrNumber) {
  const or = [{ studentId: idOrNumber }];
  if (mongoose.isValidObjectId(idOrNumber)) {
    or.push({ _id: idOrNumber }, { userId: idOrNumber });
  }
  const student = await Student.findOne({ $or: or }).populate('userId');
  if (!student) throw ApiError.notFound('Student not found.');
  return student;
}

function searchFilter(query, extra = {}) {
  const filter = { ...extra };
  if (query.status) filter.status = query.status;
  if (query.section) filter.section = query.section;
  if (query.brigade) filter.brigade = query.brigade;
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { course: rx }];
  }
  return filter;
}

/** GET /api/students */
exports.list = asyncHandler(async (req, res) => {
  const filter = scopeFilterToProgram(searchFilter(req.query), req.user, req.query.program);
  const students = await Student.find(filter).sort({ fullName: 1 });

  const countScope = filter.program ? { program: filter.program } : {};
  const [total, active] = await Promise.all([
    Student.countDocuments(countScope),
    Student.countDocuments({ ...countScope, status: 'Active' }),
  ]);

  res.json({
    success: true,
    count: students.length,
    stats: { total, active, inactive: total - active },
    data: students,
  });
});

/** GET /api/students/:id */
exports.get = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }
  res.json({ success: true, data: student });
});

/** PUT /api/students/:id */
exports.update = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }

  const fields = [
    'fullName',
    'email',
    'course',
    'yearLevel',
    'section',
    'brigade',
    'contactNumber',
    'address',
    'emergencyContact',
    'profileImage',
  ];
  if (ADMIN_ROLES.includes(req.user.role) || req.user.role === 'officer') fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = req.body[f];
  });
  await student.save();

  res.json({ success: true, data: student });
});

/**
 * GET /api/students/:id/dashboard
 * One call that fills the whole trainee home screen: to-do count, absences,
 * lates, recent announcements, upcoming activities, and recent grades.
 */
exports.dashboard = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }

  const program = student.program || 'CWTS';
  const now = new Date();

  const [attendance, announcements, modules, submissions, upcoming, grade] =
    await Promise.all([
      Attendance.find({ studentId: userId, program }).sort({ date: -1 }),
      Announcement.find({
        status: 'Published',
        program: { $in: [program, 'All'] },
        targetAudience: { $in: ['All', 'Students'] },
      })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(5),
      ModuleModel.find({ program, deadline: { $ne: null }, status: { $ne: 'Archived' } })
        .sort({ deadline: 1 })
        .limit(20),
      Submission.find({ studentId: userId }),
      Activity.find({ program, date: { $gte: now } }).sort({ date: 1 }).limit(5),
      Grade.findOne({ studentId: userId, program }),
    ]);

  const submissionByModule = new Map(
    submissions.filter((s) => s.moduleId).map((s) => [String(s.moduleId), s])
  );

  const toDo = modules
    .map((m) => {
      const sub = submissionByModule.get(String(m._id));
      let status = 'To Do';
      if (sub) status = sub.status;
      else if (m.deadline && m.deadline < now) status = 'Missing';

      return {
        _id: m._id,
        title: m.title,
        deadline: m.deadline,
        totalPoints: m.totalPoints,
        status,
        score: sub ? sub.score : null,
      };
    })
    .filter((t) => t.status === 'To Do' || t.status === 'Missing');

  const recentScores = submissions
    .filter((s) => s.status === 'Graded')
    .sort((a, b) => new Date(b.gradedAt || 0) - new Date(a.gradedAt || 0))
    .slice(0, 5)
    .map((s) => ({
      _id: s._id,
      moduleId: s.moduleId,
      score: s.score,
      totalPoints: s.totalPoints,
      gradedAt: s.gradedAt,
    }));

  res.json({
    success: true,
    data: {
      student,
      overview: {
        tasks: toDo.length,
        activities: attendance.length,
        present: attendance.filter((a) => a.status === 'Present').length,
        absents: attendance.filter((a) => a.status === 'Absent').length,
        late: attendance.filter((a) => a.status === 'Late').length,
        excused: attendance.filter((a) => a.status === 'Excused').length,
      },
      announcements,
      toDo,
      upcomingActivities: upcoming,
      recentScores,
      grade,
    },
  });
});

/** GET /api/students/:id/attendance */
exports.attendance = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }

  const filter = { studentId: userId };
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;

  const records = await Attendance.find(filter)
    .populate('activityId', 'title location')
    .populate('sessionId', 'title brigade')
    .sort({ date: -1 });

  res.json({ success: true, count: records.length, data: records });
});

/** GET /api/students/:id/submissions */
exports.submissions = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }

  const records = await Submission.find({ studentId: userId })
    .populate('moduleId', 'title deadline totalPoints moduleCode')
    .populate('activityId', 'title date')
    .sort({ submittedAt: -1 });

  res.json({ success: true, count: records.length, data: records });
});

/** GET /api/students/:id/grades — recomputes so the figure is never stale. */
exports.grades = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, student.program);
  }

  const grade = await recalculateGrade(userId, student.program || 'CWTS');
  res.json({ success: true, data: grade });
});

/**
 * POST /api/students — admin_cwts/super_admin only. Creates the User (role
 * 'student') and its Student profile together, mirroring authController.register.
 */
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    studentId,
    course = '',
    yearLevel = '',
    section = '',
    brigade = '',
    contactNumber = '',
    address = '',
    emergencyContact = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'studentId']);

  if (!isValidEmail(email)) {
    throw ApiError.badRequest('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }

  const existing = await User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { studentId }],
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === String(email).toLowerCase()
        ? 'That email address is already registered.'
        : 'That student ID is already registered.'
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'student',
    studentId,
    program: 'CWTS',
    yearLevel,
    section,
    contactNumber,
    status: 'Active',
  });

  const student = await Student.create({
    userId: user._id,
    studentId,
    fullName: name,
    email: String(email).toLowerCase(),
    program: 'CWTS',
    course,
    yearLevel,
    section,
    brigade,
    contactNumber,
    address,
    emergencyContact,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: { user: user.toPublic(), student } });
});

exports.resolveStudent = resolveStudent;
exports.searchFilter = searchFilter;

/** Shared by the officer "students near absence limit" widget. */
exports.atRisk = asyncHandler(async (req, res) => {
  const program =
    req.user.role === 'super_admin' ? req.query.program || 'CWTS' : req.user.program;
  const threshold = Number(req.query.threshold) || 3;

  const rows = await Attendance.aggregate([
    { $match: { program, status: 'Absent' } },
    { $group: { _id: '$studentId', absents: { $sum: 1 } } },
    { $match: { absents: { $gte: threshold } } },
    { $sort: { absents: -1 } },
    { $limit: 50 },
  ]);

  const userIds = rows.map((r) => r._id);
  const [users, totals] = await Promise.all([
    User.find({ _id: { $in: userIds } }),
    Attendance.aggregate([
      { $match: { program, studentId: { $in: userIds } } },
      { $group: { _id: '$studentId', total: { $sum: 1 } } },
    ]),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const totalMap = new Map(totals.map((t) => [String(t._id), t.total]));

  res.json({
    success: true,
    data: rows.map((r) => {
      const u = userMap.get(String(r._id));
      return {
        userId: r._id,
        name: u ? u.name : 'Unknown',
        studentId: u ? u.studentId : '',
        absents: r.absents,
        totalSessions: totalMap.get(String(r._id)) || r.absents,
      };
    }),
  });
});
