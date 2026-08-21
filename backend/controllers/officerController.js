const mongoose = require('mongoose');
const Officer = require('../models/Officer');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, isValidEmail } = require('../utils/validate');
const { ADMIN_ROLES } = require('../config/constants');
const {
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
} = require('../utils/programScope');

/**
 * Resolves ":id" against either the User _id, the Officer _id, or the human
 * officer number, mirroring resolveStudent/resolveCadet.
 */
async function resolveOfficer(idOrNumber) {
  const or = [{ officerId: idOrNumber }];
  if (mongoose.isValidObjectId(idOrNumber)) {
    or.push({ _id: idOrNumber }, { userId: idOrNumber });
  }
  const officer = await Officer.findOne({ $or: or }).populate('userId');
  if (!officer) throw ApiError.notFound('Officer not found.');
  return officer;
}

/** GET /api/officers — program-scoped, staff-only (route-guarded). */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { officerId: rx }, { email: rx }];
  }
  scopeFilterToProgram(filter, req.user, req.query.program);

  const officers = await Officer.find(filter).sort({ fullName: 1 });
  const countScope = filter.program ? { program: filter.program } : {};
  const [total, active] = await Promise.all([
    Officer.countDocuments(countScope),
    Officer.countDocuments({ ...countScope, status: 'Active' }),
  ]);

  res.json({
    success: true,
    count: officers.length,
    stats: { total, active, inactive: total - active },
    data: officers,
  });
});

/** GET /api/officers/:id */
exports.get = asyncHandler(async (req, res) => {
  const officer = await resolveOfficer(req.params.id);
  assertProgramAccess(req.user, officer.program);
  res.json({ success: true, data: officer });
});

/**
 * POST /api/officers — admin_cwts/admin_rotc/super_admin only. Creates the
 * User (role 'officer') and its Officer profile together.
 */
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    officerId,
    position = 'Officer',
    brigade = '',
    contactNumber = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'officerId']);

  if (!isValidEmail(email)) {
    throw ApiError.badRequest('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }

  // admin_cwts/admin_rotc are forced onto their own program; super_admin must
  // supply one explicitly.
  const program = resolveProgramForCreate(req.user, req.body.program);

  const existing = await User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { studentId: officerId }],
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === String(email).toLowerCase()
        ? 'That email address is already registered.'
        : 'That officer ID is already registered.'
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'officer',
    studentId: officerId,
    program,
    contactNumber,
    status: 'Active',
  });

  const officer = await Officer.create({
    userId: user._id,
    officerId,
    fullName: name,
    email: String(email).toLowerCase(),
    program,
    position,
    brigade,
    contactNumber,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: { user: user.toPublic(), officer } });
});

/**
 * PUT /api/officers/:id — edits profile fields; admins may also change
 * status (use status: 'Inactive' to deactivate rather than hard-deleting).
 */
exports.update = asyncHandler(async (req, res) => {
  const officer = await resolveOfficer(req.params.id);
  assertProgramAccess(req.user, officer.program);

  const fields = ['fullName', 'email', 'position', 'brigade', 'contactNumber', 'profileImage'];
  if (ADMIN_ROLES.includes(req.user.role)) fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) officer[f] = req.body[f];
  });
  await officer.save();

  if (req.body.name !== undefined || req.body.status !== undefined) {
    const userId = officer.userId?._id || officer.userId;
    const update = {};
    if (req.body.name !== undefined) update.name = req.body.name;
    if (ADMIN_ROLES.includes(req.user.role) && req.body.status !== undefined) {
      update.status = req.body.status;
    }
    if (Object.keys(update).length) {
      await User.findByIdAndUpdate(userId, update);
    }
  }

  res.json({ success: true, data: officer });
});

/** DELETE /api/officers/:id — super_admin only (route-guarded), hard delete. */
exports.remove = asyncHandler(async (req, res) => {
  const officer = await resolveOfficer(req.params.id);
  const userId = officer.userId?._id || officer.userId;

  await officer.deleteOne();
  if (userId) await User.findByIdAndDelete(userId);

  res.json({ success: true, message: 'Officer deleted.' });
});

exports.resolveOfficer = resolveOfficer;
