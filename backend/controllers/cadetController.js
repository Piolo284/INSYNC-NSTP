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
const { ADMIN_ROLES, STAFF_ROLES, ROTC_RESTRICTED_CAMPUSES, SPECIAL_CLASS_CATEGORIES } = require('../config/constants');
const { assertSpecialClassManager, isSpecialClassManager } = require('../utils/specialClass');
const { requireFields, isMarsuEmail, assertContactNumber } = require('../utils/validate');
const { assertProgramAccess, scopeFilterToProgram } = require('../utils/programScope');
const { assertBrigadeAccess, scopeFilterToBrigade } = require('../utils/brigadeScope');
const Brigade = require('../models/Brigade');
const {
  resolveBrigadeForCourse,
  applyBrigadeFields,
  assignCadetToBrigade,
} = require('../utils/brigadeAssignment');

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
  if (req.query.brigadeId) filter.brigadeId = req.query.brigadeId;
  if (req.query.yearLevel) filter.yearLevel = req.query.yearLevel;
  if (req.query.course) filter.course = req.query.course;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { cadetId: rx }, { email: rx }];
  }
  scopeFilterToProgram(filter, req.user, req.query.program);

  // The assigned Special Class officer has no separate "Special" tab — this
  // roster IS their Cadets tab, cutting across every company instead of
  // being locked to their own the way a regular officer is.
  const isOfficerSpecial =
    req.user.role === 'officer' && filter.program && (await isSpecialClassManager(req.user, filter.program));
  if (isOfficerSpecial) {
    delete filter.platoon;
    delete filter.company;
    delete filter.brigadeId;
    filter.specialCategory = { $in: SPECIAL_CLASS_CATEGORIES };
  } else {
    scopeFilterToBrigade(filter, req.user, req.query.brigadeId);
  }

  const cadets = await Cadet.find(filter).sort({ fullName: 1 });

  // Stat cards must match the same scope as the roster above — an officer's
  // "Total"/"Active" counts otherwise silently included every company in
  // the program instead of just what they actually manage.
  const countScope = {};
  if (filter.program) countScope.program = filter.program;
  if (isOfficerSpecial) {
    countScope.specialCategory = { $in: SPECIAL_CLASS_CATEGORIES };
  } else if (filter.brigadeId !== undefined) {
    countScope.brigadeId = filter.brigadeId;
  }
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

/**
 * GET /api/cadets/special-class — the ROTC Special Class roster (every
 * Active PWD/Medical-Condition cadet, cutting across brigades/companies).
 * Only the assigned Special Class officer or an admin_rotc/super_admin may
 * view it — not any random officer.
 */
exports.specialClassRoster = asyncHandler(async (req, res) => {
  await assertSpecialClassManager(req.user, 'ROTC');

  const cadets = await Cadet.find({
    program: 'ROTC',
    specialCategory: { $in: SPECIAL_CLASS_CATEGORIES },
    status: 'Active',
  }).sort({ fullName: 1 });

  res.json({ success: true, count: cadets.length, data: cadets });
});

/** GET /api/cadets/:id */
exports.get = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);
  if (String(req.user._id) !== String(userId)) {
    assertProgramAccess(req.user, cadet.program);
    assertBrigadeAccess(req.user, cadet.brigadeId);
  }
  res.json({ success: true, data: cadet });
});

/**
 * PUT /api/cadets/:id — admins (admin_cwts/admin_rotc/super_admin) have no
 * authority to edit a trainee's record; enrollment data comes from the
 * masterlist, and status changes are automatic (see gradeCalculator.js).
 * Only the cadet themselves (self-service) or an officer may edit here.
 */
exports.update = asyncHandler(async (req, res) => {
  const cadet = await resolveCadet(req.params.id);
  const userId = cadet.userId?._id || cadet.userId;
  assertSelfOrStaff(req, userId);

  const isSelf = String(req.user._id) === String(userId);
  if (!isSelf) {
    if (ADMIN_ROLES.includes(req.user.role)) {
      throw ApiError.forbidden('Admins do not have permission to edit trainee records.');
    }
    assertProgramAccess(req.user, cadet.program);
    assertBrigadeAccess(req.user, cadet.brigadeId);
  }

  assertContactNumber(req.body.contactNumber);

  // A trainee editing their own record may only change their contact
  // details — enrollment data (name, course, year/section...) comes from
  // the masterlist and the photo goes through PUT /api/users/me/avatar.
  const fields = isSelf && !STAFF_ROLES.includes(req.user.role)
    ? ['contactNumber', 'address', 'emergencyContact']
    : [
        'fullName',
        'email',
        'course',
        'platoon',
        'company',
        'yearLevel',
        'section',
        'contactNumber',
        'address',
        'emergencyContact',
        'profileImage',
      ];
  if (req.user.role === 'officer') fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) cadet[f] = req.body[f];
  });
  const traineeSelf = isSelf && !STAFF_ROLES.includes(req.user.role);

  if (!traineeSelf && req.body.campus !== undefined) {
    const nextCampus = req.body.campus || null;
    if (nextCampus && ROTC_RESTRICTED_CAMPUSES.includes(nextCampus)) {
      throw ApiError.badRequest(
        `ROTC is not offered at ${nextCampus}. Only CWTS is available at this campus.`
      );
    }
    cadet.campus = nextCampus;
  }

  // A cadet's company comes from their handling officer, not their course,
  // so a course change only refreshes program/campus.
  if (!traineeSelf && req.body.course !== undefined) {
    const resolved = await resolveBrigadeForCourse(cadet.course, cadet.program);
    applyBrigadeFields(cadet, resolved, { assignBrigade: false });
    await User.findByIdAndUpdate(userId, {
      programId: cadet.programId,
      campus: cadet.campus,
    });
  }

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
    assertBrigadeAccess(req.user, cadet.brigadeId);
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
    assertBrigadeAccess(req.user, cadet.brigadeId);
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
    assertBrigadeAccess(req.user, cadet.brigadeId);
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
    yearLevel = '',
    section = '',
    contactNumber = '',
    address = '',
    emergencyContact = '',
    campus = '',
  } = req.body;
  assertContactNumber(contactNumber);

  requireFields(req.body, ['name', 'email', 'password', 'cadetId']);

  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }
  if (campus && ROTC_RESTRICTED_CAMPUSES.includes(campus)) {
    throw ApiError.badRequest(
      `ROTC is not offered at ${campus}. Only CWTS is available at this campus.`
    );
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

  const resolved = await resolveBrigadeForCourse(course, 'ROTC');

  const user = await User.create(
    applyBrigadeFields(
      {
        name,
        email,
        password,
        role: 'cadet',
        studentId: cadetId,
        program: 'ROTC',
        yearLevel,
        section,
        campus: campus || null,
        contactNumber,
        status: 'Active',
      },
      resolved,
      { assignBrigade: false }
    )
  );

  const cadet = await Cadet.create(
    applyBrigadeFields(
      {
        userId: user._id,
        cadetId,
        fullName: name,
        email: String(email).toLowerCase(),
        program: 'ROTC',
        course,
        platoon,
        company,
        yearLevel,
        section,
        campus: campus || null,
        contactNumber,
        address,
        emergencyContact,
        status: 'Active',
      },
      resolved,
      { assignBrigade: false }
    )
  );

  res.status(201).json({ success: true, data: { user: user.toPublic(), cadet } });
});

/**
 * Throws unless `user` is a ROTC officer with a company, and returns that
 * company (Brigade doc) — the one their handled cadets get put under.
 */
async function officerCompany(user) {
  if (user.role !== 'officer' || user.program !== 'ROTC') {
    throw ApiError.forbidden('Only ROTC officers can add cadets to their company.');
  }
  const brigade = user.brigadeId ? await Brigade.findById(user.brigadeId) : null;
  if (!brigade) {
    throw ApiError.badRequest(
      'Your officer account has no company assigned yet. Contact your administrator.'
    );
  }
  return brigade;
}

/**
 * GET /api/cadets/unassigned — registered ROTC cadets no officer has handled
 * yet (no company). Special Class cadets are left out: the Special Class
 * officer already handles them program-wide.
 */
exports.unassigned = asyncHandler(async (req, res) => {
  await officerCompany(req.user);

  const filter = {
    program: 'ROTC',
    status: 'Active',
    specialCategory: { $nin: SPECIAL_CLASS_CATEGORIES },
    $or: [{ brigadeId: null }, { brigadeId: { $exists: false } }],
  };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ fullName: rx }, { cadetId: rx }, { email: rx }] }];
  }

  const cadets = await Cadet.find(filter).sort({ fullName: 1 });
  res.json({ success: true, count: cadets.length, data: cadets });
});

/**
 * POST /api/cadets/:id/assign — the signed-in ROTC officer adds an
 * unassigned cadet to their handled cadets; the cadet automatically gets
 * the officer's company.
 */
exports.assignToMe = asyncHandler(async (req, res) => {
  const brigade = await officerCompany(req.user);
  const cadet = await resolveCadet(req.params.id);

  if (cadet.brigadeId) {
    if (String(cadet.brigadeId) === String(brigade._id)) {
      throw ApiError.conflict(`${cadet.fullName} is already in ${brigade.name}.`);
    }
    throw ApiError.conflict(
      `${cadet.fullName} is already handled by another company (${cadet.company || cadet.brigade}).`
    );
  }

  await assignCadetToBrigade(cadet, brigade);
  await cadet.save();

  res.json({ success: true, message: `${cadet.fullName} added to ${brigade.name}.`, data: cadet });
});

exports.resolveCadet = resolveCadet;
