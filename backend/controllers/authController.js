const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const { requireFields, requireOneOf, isValidEmail } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');

/** Loads the role-specific profile that goes with a User document. */
async function profileFor(user) {
  switch (user.role) {
    case 'student':
      return Student.findOne({ userId: user._id });
    case 'cadet':
      return Cadet.findOne({ userId: user._id });
    case 'officer':
      return Officer.findOne({ userId: user._id });
    default:
      return null;
  }
}

async function authResponse(res, user, status = 200) {
  const profile = await profileFor(user);
  res.status(status).json({
    success: true,
    data: {
      token: signToken(user),
      user: user.toPublic(),
      profile,
    },
  });
}

/**
 * POST /api/auth/login
 * Accepts { email | studentId, password }. The trainee login screen sends a
 * student ID, the officer/admin screens send an email — both land here.
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, studentId, identifier, password, role } = req.body;
  requireFields(req.body, ['password']);
  requireOneOf(req.body, ['email', 'studentId', 'identifier']);

  const raw = String(email || studentId || identifier).trim();
  const query = raw.includes('@')
    ? { email: raw.toLowerCase() }
    : { studentId: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };

  const user = await User.findOne(query).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Incorrect ID/email or password.');
  }

  if (user.status === 'Inactive' || user.status === 'Dropped') {
    throw ApiError.forbidden('This account is no longer active.');
  }

  // Role hint from the login screen (e.g. officer portal) — reject mismatches so
  // a trainee cannot sign into the officer shell with valid trainee credentials.
  if (role && user.role !== role) {
    throw ApiError.forbidden(
      `This account is registered as a ${user.role}. Please use the ${user.role} login.`
    );
  }

  user.password = undefined;
  await authResponse(res, user);
});

/**
 * POST /api/auth/register
 * Used by the trainee/cadet registration screen.
 */
exports.register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    studentId,
    program = 'CWTS',
    course = '',
    yearLevel = '',
    section = '',
    contactNumber = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'studentId']);

  if (!isValidEmail(email)) {
    throw ApiError.badRequest('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }
  if (!PROGRAMS.includes(program)) {
    throw ApiError.badRequest(`Program must be one of: ${PROGRAMS.join(', ')}.`);
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

  const role = program === 'ROTC' ? 'cadet' : 'student';

  const user = await User.create({
    name,
    email,
    password,
    role,
    studentId,
    program,
    yearLevel,
    section,
    contactNumber,
    status: 'Active',
  });

  const common = {
    userId: user._id,
    fullName: name,
    email: String(email).toLowerCase(),
    program,
    course,
    yearLevel,
    section,
    contactNumber,
    status: 'Active',
  };

  if (role === 'cadet') {
    await Cadet.create({ ...common, cadetId: studentId });
  } else {
    await Student.create({ ...common, studentId });
  }

  await authResponse(res, user, 201);
});

/** GET /api/auth/me */
exports.me = asyncHandler(async (req, res) => {
  const profile = await profileFor(req.user);
  res.json({ success: true, data: { user: req.user.toPublic(), profile } });
});

/** PUT /api/auth/password */
exports.changePassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const { currentPassword, newPassword } = req.body;

  if (String(newPassword).length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters long.');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated.' });
});

exports.profileFor = profileFor;
