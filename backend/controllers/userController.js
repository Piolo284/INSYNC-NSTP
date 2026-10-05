const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { destroy } = require('../middleware/upload');
const { assertSelfOrStaff } = require('../middleware/auth');
const { profileFor } = require('./authController');
const { requireFields, isMarsuEmail } = require('../utils/validate');
const { ADMIN_ROLES, PROGRAM_ADMIN_ROLES } = require('../config/constants');
const { assertProgramAccess } = require('../utils/programScope');

function buildUserQuery(query, req) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { studentId: rx }];
  }

  // Program-scoped admins/officers only ever see users in their own program;
  // super_admin may optionally filter by ?program=.
  if (req.user.role === 'super_admin') {
    if (query.program) filter.program = query.program;
  } else {
    filter.program = req.user.program;
  }
  return filter;
}

/** GET /api/users */
exports.list = asyncHandler(async (req, res) => {
  const users = await User.find(buildUserQuery(req.query, req)).sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, data: users });
});

/** GET /api/users/:id */
exports.get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  assertSelfOrStaff(req, user._id);
  if (String(req.user._id) !== String(user._id) && user.program) {
    assertProgramAccess(req.user, user.program);
  }
  const profile = await profileFor(user);
  res.json({ success: true, data: { user, profile } });
});

const PROFILE_MODELS = {
  student: Student,
  cadet: Cadet,
  officer: Officer,
};

/** PUT /api/users/:id — updates the User plus its role profile in one call. */
exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  const isSelf = String(req.user._id) === String(user._id);
  const isAdmin = ADMIN_ROLES.includes(req.user.role);
  if (!isSelf && !isAdmin) {
    throw ApiError.forbidden('You can only update your own profile.');
  }
  // A program-scoped admin may only touch users in their own program.
  if (!isSelf && isAdmin && user.program) {
    assertProgramAccess(req.user, user.program);
  }
  // A program-scoped admin may never move a user to the other program or
  // promote them into an admin role outside their remit.
  if (isAdmin && req.user.role !== 'super_admin') {
    if (req.body.program !== undefined && req.body.program !== req.user.program) {
      throw ApiError.forbidden('You are not authorized to access this program.');
    }
    if (req.body.role !== undefined && ADMIN_ROLES.includes(req.body.role)) {
      throw ApiError.forbidden('You are not authorized to assign that role.');
    }
  }

  const userFields = ['name', 'email', 'profileImage', 'contactNumber', 'yearLevel', 'section'];
  if (isAdmin) userFields.push('status', 'role', 'program', 'studentId');

  userFields.forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f];
  });
  await user.save();

  const Model = PROFILE_MODELS[user.role];
  let profile = null;

  if (Model) {
    const profileFields = [
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
      'platoon',
      'company',
      'position',
      'department',
    ];
    if (isAdmin) profileFields.push('status');

    const updates = {};
    profileFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (req.body.name !== undefined) updates.fullName = req.body.name;

    profile = await Model.findOneAndUpdate({ userId: user._id }, updates, { new: true });
  }

  res.json({ success: true, data: { user: user.toPublic(), profile } });
});

/**
 * PUT /api/users/me/avatar — the logged-in admin/user replaces their own
 * profile picture. File already streamed into GridFS by the `uploader()`
 * middleware; this just points the User doc at it and cleans up the old one.
 */
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file was uploaded.');

  const user = await User.findById(req.user._id);
  const previousImage = user.profileImage;
  user.profileImage = req.file.path;
  await user.save();

  const previousFileId = previousImage && previousImage.match(/\/files\/([a-f0-9]{24})$/i);
  if (previousFileId) await destroy(previousFileId[1]);

  res.json({ success: true, data: user.toPublic() });
});

/** DELETE /api/users/:id — removes the user and its role profile. */
exports.remove = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  if (String(user._id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }

  const Model = PROFILE_MODELS[user.role];
  if (Model) await Model.deleteOne({ userId: user._id });
  await user.deleteOne();

  res.json({ success: true, message: 'User deleted.' });
});

/** GET /api/users/stats/overview — powers admin/staff dashboard counters. */
exports.stats = asyncHandler(async (req, res) => {
  const scope = req.user.role === 'super_admin' ? {} : { program: req.user.program };

  const [byRole, byProgram, total, active] = await Promise.all([
    User.aggregate([{ $match: scope }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.aggregate([{ $match: scope }, { $group: { _id: '$program', count: { $sum: 1 } } }]),
    User.countDocuments(scope),
    User.countDocuments({ ...scope, status: 'Active' }),
  ]);

  const toMap = (rows) =>
    Object.fromEntries(rows.filter((r) => r._id).map((r) => [r._id, r.count]));

  res.json({
    success: true,
    data: {
      total,
      active,
      inactive: total - active,
      byRole: toMap(byRole),
      byProgram: toMap(byProgram),
    },
  });
});

/**
 * POST /api/users — super_admin only. Creates admin_cwts / admin_rotc /
 * super_admin accounts (plain User documents; no profile model needed).
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password', 'role']);
  const { name, email, password, role, contactNumber = '' } = req.body;

  if (!ADMIN_ROLES.includes(role)) {
    throw ApiError.badRequest(`role must be one of: ${ADMIN_ROLES.join(', ')}.`);
  }
  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }

  let program;
  if (PROGRAM_ADMIN_ROLES.includes(role)) {
    if (!req.body.program || !['CWTS', 'ROTC'].includes(req.body.program)) {
      throw ApiError.badRequest('program must be CWTS or ROTC for this role.');
    }
    program = req.body.program;
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    throw ApiError.conflict('That email address is already registered.');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    program,
    contactNumber,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: user.toPublic() });
});
