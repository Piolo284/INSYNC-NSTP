const User = require('../models/User');
const LoginSession = require('../models/LoginSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, isMarsuEmail, assertContactNumber } = require('../utils/validate');
const { assertStrongPassword } = require('../utils/passwordStrength');
const { ADMIN_ROLES } = require('../config/constants');

/**
 * The three admin positions the System Maintenance admin assigns. The
 * super_admin role is shown everywhere as the "NSTP Head". Each is
 * held by ONE active account at a time: assigning a new person to a
 * position deactivates whoever held it before (after the maintenance admin
 * confirms). admin_cwts/admin_rotc are tied to their program.
 */
const POSITIONS = {
  super_admin: { label: 'NSTP Head', program: undefined },
  admin_cwts: { label: 'CWTS Admin', program: 'CWTS' },
  admin_rotc: { label: 'ROTC Admin', program: 'ROTC' },
};

const publicAdmin = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  roleLabel: POSITIONS[u.role]?.label || u.role,
  program: u.program || null,
  status: u.status,
  contactNumber: u.contactNumber || '',
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

/** GET /api/admin-accounts — every admin account, current holders first. */
exports.list = asyncHandler(async (_req, res) => {
  const admins = await User.find({ role: { $in: ADMIN_ROLES } }).sort({ status: 1, updatedAt: -1 });
  res.json({ success: true, data: admins.map(publicAdmin) });
});

/**
 * POST /api/admin-accounts
 * Body: { name, email, password, role, contactNumber?, confirmReplace? }
 *
 * If the position already has an active holder and `confirmReplace` isn't
 * true, nothing is changed — a 409 comes back listing who would be
 * deactivated, so the panel can ask for confirmation first. With
 * `confirmReplace: true` the new admin is created and the previous holder(s)
 * are deactivated (status Inactive) and logged out of every device.
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password', 'role']);
  const { role } = req.body;
  const position = POSITIONS[role];
  if (!position) {
    throw ApiError.badRequest('Position must be NSTP Head, CWTS Admin, or ROTC Admin.');
  }

  const name = String(req.body.name).trim();
  const email = String(req.body.email).trim().toLowerCase();
  const contactNumber = String(req.body.contactNumber || '').trim();
  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  assertContactNumber(contactNumber);
  assertStrongPassword(req.body.password, [name, email]);
  if (await User.findOne({ email })) {
    throw ApiError.conflict('That email address is already registered to another account.');
  }

  const current = await User.find({ role, status: 'Active' });
  if (current.length && req.body.confirmReplace !== true) {
    return res.status(409).json({
      success: false,
      requiresConfirmation: true,
      message: `The ${position.label} position is currently held by ${current.map((u) => u.name).join(', ')}. ` +
        'Assigning a new admin will deactivate that account.',
      data: { position: position.label, current: current.map(publicAdmin) },
    });
  }

  // Create first, so a failure here never leaves the position empty.
  const admin = await User.create({
    name,
    email,
    password: req.body.password,
    role,
    program: position.program,
    contactNumber,
    status: 'Active',
  });

  let deactivated = [];
  if (current.length) {
    const ids = current.map((u) => u._id);
    await User.updateMany({ _id: { $in: ids } }, { $set: { status: 'Inactive' } });
    // Log them out everywhere right away, not just at their next login.
    await LoginSession.updateMany({ userId: { $in: ids }, revokedAt: null }, { $set: { revokedAt: new Date() } });
    deactivated = current.map((u) => publicAdmin({ ...u.toObject(), status: 'Inactive' }));
  }

  res.status(201).json({
    success: true,
    message: deactivated.length
      ? `${admin.name} is now the ${position.label}. ${deactivated.map((u) => u.name).join(', ')} has been deactivated.`
      : `${admin.name} is now the ${position.label}.`,
    data: { admin: publicAdmin(admin), deactivated },
  });
});
