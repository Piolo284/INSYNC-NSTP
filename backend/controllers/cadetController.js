const mongoose = require('mongoose');
const Cadet = require('../models/Cadet');
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

async function resolveCadet(idOrNumber) {
  const or = [{ cadetId: idOrNumber }];
  if (mongoose.isValidObjectId(idOrNumber)) {
    or.push({ _id: idOrNumber }, { userId: idOrNumber });
  }
  const cadet = await Cadet.findOne({ $or: or }).populate('userId');
  if (!cadet) throw ApiError.notFound('Cadet not found.');
  return cadet;
}

/** GET /api/cadets */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.platoon) filter.platoon = req.query.platoon;
  if (req.query.company) filter.company = req.query.company;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { cadetId: rx }, { email: rx }];
  }
  scopeFilterToProgram(filter, req.user, req.query.program);

  const cadets = await Cadet.find(filter).sort({ fullName: 1 });
  const countScope = filter.program ? { program: filter.program } : {};
  const [total, active] = await Promise.all([
    Cadet.countDocuments(countScope),
    Cadet.countDocuments({ ...countScope, status: 'Active' }),
  ]);

  res.json({
    success: true,
    count: cadets.length,
    stats: { total, active, inactive: total - active },
    data: cadets,
  });
});

/** GET /api/cadets/:id */
exports.get = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
  }
  res.json({ success: true, data: cadet });
});

/** PUT /api/cadets/:id */
exports.update = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
  }

  const fields = [
    'fullName',
    'email',
    'course',
    'platoon',
    'company',
    'brigade',
    'yearLevel',
    'section',
    'contactNumber',
    'address',
    'emergencyContact',
    'profileImage',
  ];
  if (ADMIN_ROLES.includes(req.user.role) || req.user.role === 'officer') fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) cadet[f] = req.body[f];
  });
  await cadet.save();

  res.json({ success: true, data: cadet });
});

/** GET /api/cadets/:id/dashboard — same shape as the student dashboard. */
exports.dashboard = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
  }

  const program = 'ROTC';
  const now = new Date();

  const [attendance, announcements, modules, submissions, upcoming, grade] =
    await Promise.all([
      Attendance.find({ studentId: userId, program }).sort({ date: -1 }),
      Announcement.find({
        status: 'Published',
        program: { $in: [program, 'All'] },
        targetAudience: { $in: ['All', 'Cadets'] },
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

  res.json({
    success: true,
    data: {
      cadet,
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
      grade,
    },
  });
});

/** GET /api/cadets/:id/attendance */
exports.attendance = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
  }

  const filter = { studentId: userId };
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;

  const records = await Attendance.find(filter)
    .populate('activityId', 'title location')
    .populate('sessionId', 'title brigade')
    .sort({ date: -1 });

  res.json({ success: true, count: records.length, data: records });
});

/** GET /api/cadets/:id/grades */
exports.grades = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
  }

  const grade = await recalculateGrade(userId, 'ROTC');
  res.json({ success: true, data: grade });
});

/**
 * POST /api/cadets — admin_rotc/super_admin only. Creates the User (role
 * 'cadet') and its Cadet profile together, mirroring authController.register.
 */
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    cadetId,
    course = '',
    platoon = '',
    company = '',
    brigade = '',
    yearLevel = '',
    section = '',
    contactNumber = '',
    address = '',
    emergencyContact = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'cadetId']);

  if (!isValidEmail(email)) {
    throw ApiError.badRequest('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }

  const existing = await User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { studentId: cadetId }],
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === String(email).toLowerCase()
        ? 'That email address is already registered.'
        : 'That cadet ID is already registered.'
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'cadet',
    studentId: cadetId,
    program: 'ROTC',
    yearLevel,
    section,
    contactNumber,
    status: 'Active',
  });

  const cadet = await Cadet.create({
    userId: user._id,
    cadetId,
    fullName: name,
    email: String(email).toLowerCase(),
    program: 'ROTC',
    course,
    platoon,
    company,
    brigade,
    yearLevel,
    section,
    contactNumber,
    address,
    emergencyContact,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: { user: user.toPublic(), cadet } });
});

exports.resolveCadet = resolveCadet;
