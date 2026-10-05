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
const { ADMIN_ROLES, attendanceRules, SPECIAL_CLASS_CATEGORIES } = require('../config/constants');
const { requireFields, isMarsuEmail } = require('../utils/validate');
const { assertProgramAccess, scopeFilterToProgram } = require('../utils/programScope');
const { assertBrigadeAccess, scopeFilterToBrigade } = require('../utils/brigadeScope');
const { resolveBrigadeForCourse, applyBrigadeFields } = require('../utils/brigadeAssignment');
const {
  isSpecialClassManager,
  specialClassTraineeIds,
} = require('../utils/specialClass');

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
  if (query.brigadeId) filter.brigadeId = query.brigadeId;
  else if (query.brigade) filter.brigade = query.brigade;
  if (query.yearLevel) filter.yearLevel = query.yearLevel;
  if (query.course) filter.course = query.course;
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { course: rx }];
  }
  return filter;
}

/** GET /api/students */
exports.list = asyncHandler(async (req, res) => {
  const filter = scopeFilterToProgram(searchFilter(req.query), req.user, req.query.program);

  // The assigned Special Class officer has no separate "Special" tab — this
  // roster IS their Students tab, cutting across every brigade instead of
  // being locked to their own the way a regular officer is.
  const isOfficerSpecial =
    req.user.role === 'officer' && filter.program && (await isSpecialClassManager(req.user, filter.program));
  if (isOfficerSpecial) {
    delete filter.brigadeId;
    delete filter.brigade;
    filter.specialCategory = { $in: SPECIAL_CLASS_CATEGORIES };
  } else {
    scopeFilterToBrigade(filter, req.user, req.query.brigadeId);
  }

  const students = await Student.find(filter).sort({ fullName: 1 });

  // Stat cards must match the same scope as the roster above — an officer's
  // "Total"/"Active" counts otherwise silently included every brigade in
  // the program instead of just what they actually manage.
  const countScope = {};
  if (filter.program) countScope.program = filter.program;
  if (isOfficerSpecial) {
    countScope.specialCategory = { $in: SPECIAL_CLASS_CATEGORIES };
  } else if (filter.brigadeId !== undefined) {
    countScope.brigadeId = filter.brigadeId;
  }
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
    assertBrigadeAccess(req.user, student.brigadeId);
  }
  res.json({ success: true, data: student });
});

/**
 * PUT /api/students/:id — admins (admin_cwts/admin_rotc/super_admin) have no
 * authority to edit a trainee's record; enrollment data comes from the
 * masterlist, and status changes are automatic (see gradeCalculator.js).
 * Only the trainee themselves (self-service) or an officer may edit here.
 */
exports.update = asyncHandler(async (req, res) => {
  const student = await resolveStudent(req.params.id);
  const userId = student.userId?._id || student.userId;
  assertSelfOrStaff(req, userId);

  const isSelf = String(req.user._id) === String(userId);
  if (!isSelf) {
    if (ADMIN_ROLES.includes(req.user.role)) {
      throw ApiError.forbidden('Admins do not have permission to edit trainee records.');
    }
    assertProgramAccess(req.user, student.program);
    assertBrigadeAccess(req.user, student.brigadeId);
  }

  const fields = [
    'fullName',
    'email',
    'course',
    'yearLevel',
    'section',
    'contactNumber',
    'address',
    'emergencyContact',
    'profileImage',
  ];
  if (req.user.role === 'officer') fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = req.body[f];
  });

  if (req.body.campus !== undefined) student.campus = req.body.campus || null;

  // Brigade is never hand-edited — if the course changed, re-derive it
  // (e.g. a program change like BSIT → BSBA moves the student to the new
  // brigade going forward; past attendance/session records keep their own
  // brigadeId snapshot untouched).
  if (req.body.course !== undefined) {
    const resolved = await resolveBrigadeForCourse(student.course, student.program);
    applyBrigadeFields(student, resolved);
    await User.findByIdAndUpdate(userId, {
      programId: student.programId,
      brigadeId: student.brigadeId,
      campus: student.campus,
    });
  }

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
    assertBrigadeAccess(req.user, student.brigadeId);
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
    assertBrigadeAccess(req.user, student.brigadeId);
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
    assertBrigadeAccess(req.user, student.brigadeId);
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
    assertBrigadeAccess(req.user, student.brigadeId);
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
    contactNumber = '',
    address = '',
    emergencyContact = '',
    campus = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'studentId']);

  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
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

  const resolved = await resolveBrigadeForCourse(course, 'CWTS');

  const user = await User.create(
    applyBrigadeFields(
      {
        name,
        email,
        password,
        role: 'student',
        studentId,
        program: 'CWTS',
        yearLevel,
        section,
        campus: campus || null,
        contactNumber,
        status: 'Active',
      },
      resolved
    )
  );

  const student = await Student.create(
    applyBrigadeFields(
      {
        userId: user._id,
        studentId,
        fullName: name,
        email: String(email).toLowerCase(),
        program: 'CWTS',
        course,
        yearLevel,
        section,
        campus: campus || null,
        contactNumber,
        address,
        emergencyContact,
        status: 'Active',
      },
      resolved
    )
  );

  res.status(201).json({ success: true, data: { user: user.toPublic(), student } });
});

exports.resolveStudent = resolveStudent;
exports.searchFilter = searchFilter;

/** Shared by the officer "students near absence limit" widget. */
exports.atRisk = asyncHandler(async (req, res) => {
  const program =
    req.user.role === 'super_admin' ? req.query.program || 'CWTS' : req.user.program;
  const threshold = Number(req.query.threshold) || 3;
  const { maxAbsencesBeforeDrop } = attendanceRules();
  // Special Class attendance is always program-wide (brigadeId: null), so
  // the assigned Special Class officer is scoped by their trainee roster
  // instead of the usual single-brigade filter, which would never match.
  const brigadeFilter = {};
  if (req.user.role === 'officer' && (await isSpecialClassManager(req.user, program))) {
    brigadeFilter.studentId = { $in: await specialClassTraineeIds(program) };
  } else {
    scopeFilterToBrigade(brigadeFilter, req.user, req.query.brigadeId);
  }

  const rows = await Attendance.aggregate([
    { $match: { program, ...brigadeFilter, status: 'Absent' } },
    { $group: { _id: '$studentId', absents: { $sum: 1 } } },
    { $match: { absents: { $gte: threshold } } },
    { $sort: { absents: -1 } },
    { $limit: 50 },
  ]);

  // Already-Dropped trainees belong in the Dropouts tab, not At Risk.
  const userIds = rows.map((r) => r._id);
  const users = await User.find({ _id: { $in: userIds }, status: { $ne: 'Dropped' } });
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  res.json({
    success: true,
    data: rows
      .filter((r) => userMap.has(String(r._id)))
      .map((r) => {
        const u = userMap.get(String(r._id));
        return {
          userId: r._id,
          name: u.name,
          studentId: u.studentId,
          absents: r.absents,
          // Shown as "absents / totalSessions" client-side — this is the
          // 4-absence drop limit, not the trainee's actual session count, so
          // the widget reads as progress toward the automatic-drop cutoff.
          totalSessions: maxAbsencesBeforeDrop,
        };
      }),
  });
});
