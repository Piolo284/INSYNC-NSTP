const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const LoginSession = require('../models/LoginSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const { requireFields, requireOneOf, isMarsuEmail, assertContactNumber } = require('../utils/validate');
const { assertStrongPassword } = require('../utils/passwordStrength');
const { resolveBrigadeForCourse, applyBrigadeFields } = require('../utils/brigadeAssignment');
const { assertMasterlistMatch } = require('../utils/masterlistMatch');
const { sendVerificationCode } = require('../utils/mailer');
const { PROGRAMS, SPECIAL_CATEGORIES, CAMPUSES, ROTC_RESTRICTED_CAMPUSES } = require('../config/constants');

const { sixDigit, codeSentMessage, checkCode } = require('../utils/verificationCode');
const TWO_FACTOR_CODE_TTL_MINUTES = 10;

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

/** Creates the LoginSession this token will be tied to, so it shows up in
 * "Login Devices" and can be revoked individually or via "Logout All
 * Devices" — see middleware/auth.js's protect() and controllers/
 * sessionController.js. `device` is whatever the client sent (optional). */
async function authResponse(res, user, status = 200, device = {}) {
  const profile = await profileFor(user);
  const session = await LoginSession.create({
    userId: user._id,
    deviceLabel: device.deviceLabel || 'Unknown device',
    platform: device.platform || '',
    userAgent: device.userAgent || '',
  });
  res.status(status).json({
    success: true,
    data: {
      token: signToken(user, session._id),
      user: user.toPublic(),
      profile,
    },
  });
}

function deviceFromRequest(req) {
  return {
    deviceLabel: req.body.deviceLabel,
    platform: req.body.platform,
    userAgent: req.headers['user-agent'] || '',
  };
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

  if (user.status === 'Dropped') {
    throw ApiError.forbidden(
      'This account has been dropped for exceeding the maximum allowed absences. Please contact your program administrator to have your account reviewed.'
    );
  }
  if (user.status === 'Inactive') {
    throw ApiError.forbidden('This account is no longer active. Please contact your program administrator.');
  }

  // Role hint from the login screen (e.g. officer portal) — reject mismatches so
  // a trainee cannot sign into the officer shell with valid trainee credentials.
  if (role && user.role !== role) {
    throw ApiError.forbidden(
      `This account is registered as a ${user.role}. Please use the ${user.role} login.`
    );
  }

  // Two-factor login: the password alone isn't enough — hold off on issuing
  // a token until exports.verifyTwoFactor confirms the emailed code too.
  // (Deliberately checked before `user.password = undefined` below —
  // explicitly touching a `select: false, required` path and then calling
  // .save() makes Mongoose re-validate it as "missing".)
  if (user.twoFactorEnabled) {
    const code = sixDigit();
    user.twoFactorCode = code;
    user.twoFactorCodeExpiresAt = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MINUTES * 60000);
    user.twoFactorCodeAttempts = 0;
    await user.save();

    const mail = await sendVerificationCode({
      to: user.email,
      name: user.name,
      code,
      purpose: 'log in to your NSTP Portal account',
      minutes: TWO_FACTOR_CODE_TTL_MINUTES,
    });

    res.json({
      success: true,
      message: `${codeSentMessage(mail)} Enter it to finish logging in.`,
      data: { requiresTwoFactor: true, identifier: raw },
    });
    return;
  }

  await authResponse(res, user, 200, deviceFromRequest(req));
});

/**
 * POST /api/auth/2fa/verify
 * Second step of a two-factor login — the code exports.login just emailed.
 * Deliberately doesn't re-check the password: exports.login already did,
 * and this endpoint's whole job is confirming the *second* factor.
 */
exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  requireFields(req.body, ['identifier', 'code']);

  const raw = String(req.body.identifier).trim();
  const query = raw.includes('@')
    ? { email: raw.toLowerCase() }
    : { studentId: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  const user = await User.findOne(query).select('+twoFactorCode +twoFactorCodeExpiresAt +twoFactorCodeAttempts');

  if (!user || !user.twoFactorCode) {
    throw ApiError.badRequest('No login in progress for that account. Please log in again.');
  }
  await checkCode(user, {
    codeField: 'twoFactorCode',
    expiresField: 'twoFactorCodeExpiresAt',
    attemptsField: 'twoFactorCodeAttempts',
    input: req.body.code,
    restartHint: 'Please log in again to get a new code.',
  });
  await user.save();

  await authResponse(res, user, 200, deviceFromRequest(req));
});

/**
 * POST /api/auth/validate-enrollment
 * Step-1 "can this person even register" pre-check — the registration
 * screen calls this before letting the trainee move on to Step 2, so a
 * masterlist mismatch is caught immediately instead of only surfacing after
 * they've filled in every other step. Runs the exact same check register()
 * itself re-verifies at the end; this never creates an account.
 */
exports.validateEnrollment = asyncHandler(async (req, res) => {
  const { studentId, name, course, program = 'CWTS' } = req.body;
  requireFields(req.body, ['studentId', 'name', 'course']);
  if (!PROGRAMS.includes(program)) {
    throw ApiError.badRequest(`program must be one of: ${PROGRAMS.join(', ')}.`);
  }

  await assertMasterlistMatch({ studentId, name, course, program });

  res.json({ success: true, message: 'You are verified as an enrolled NSTP student.' });
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
    specialCategory = 'None',
    campus = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'studentId']);
  assertContactNumber(contactNumber);

  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use your official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  assertStrongPassword(password, [name, email, studentId]);
  if (!PROGRAMS.includes(program)) {
    throw ApiError.badRequest(`Program must be one of: ${PROGRAMS.join(', ')}.`);
  }
  if (!SPECIAL_CATEGORIES.includes(specialCategory)) {
    throw ApiError.badRequest(`specialCategory must be one of: ${SPECIAL_CATEGORIES.join(', ')}.`);
  }

  // Gate registration on the official NSTP masterlist — one shared roster
  // that only verifies the person is an enrolled NSTP student; it does not
  // pre-assign them to CWTS or ROTC (that choice is the trainee's, made on
  // the first screen). Same check the Step-1 pre-check already ran
  // (exports.validateEnrollment below) — re-run here too since the backend,
  // not the app screen, is the actual source of truth.
  await assertMasterlistMatch({ studentId, name, course, program });

  const existing = await User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { studentId }],
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === String(email).toLowerCase()
        ? 'That email address is already registered.'
        : 'This Student Number is already registered. Please log in using your existing account.'
    );
  }

  const role = program === 'ROTC' ? 'cadet' : 'student';

  // A CWTS student's brigade is never typed by hand — it's derived from the
  // college course they picked, matched against the configured Program list.
  // A ROTC cadet starts with no company: it's set when an officer adds them
  // to their handled cadets (cadetController.assignToMe).
  const resolved = await resolveBrigadeForCourse(course, program);
  const brigadeOpts = { assignBrigade: role !== 'cadet' };

  // Some colleges only exist at one MARSU campus (see models/Program.js) —
  // for those, campus is derived below via applyBrigadeFields and the
  // trainee never has to (or gets to) pick one. Everyone else still must.
  const campusIsFixedByProgram = Boolean(resolved && resolved.program.campus);
  if (!campusIsFixedByProgram) {
    if (!campus) throw ApiError.badRequest('campus is required.');
    if (!CAMPUSES.includes(campus)) {
      throw ApiError.badRequest(`campus must be one of: ${CAMPUSES.join(', ')}.`);
    }
  }
  const effectiveCampus = campusIsFixedByProgram ? resolved.program.campus : campus;
  if (program === 'ROTC' && ROTC_RESTRICTED_CAMPUSES.includes(effectiveCampus)) {
    throw ApiError.badRequest(
      `ROTC is not offered at ${effectiveCampus}. Only CWTS is available at this campus — please register through the CWTS portal instead.`
    );
  }

  const user = await User.create(
    applyBrigadeFields(
      {
        name,
        email,
        password,
        role,
        studentId,
        program,
        yearLevel,
        section,
        campus: effectiveCampus,
        contactNumber,
        status: 'Active',
      },
      resolved,
      brigadeOpts
    )
  );

  const common = applyBrigadeFields(
    {
      userId: user._id,
      fullName: name,
      email: String(email).toLowerCase(),
      program,
      course,
      yearLevel,
      section,
      campus: effectiveCampus,
      contactNumber,
      specialCategory,
      status: 'Active',
    },
    resolved,
    brigadeOpts
  );

  if (role === 'cadet') {
    await Cadet.create({ ...common, cadetId: studentId });
  } else {
    await Student.create({ ...common, studentId });
  }

  await authResponse(res, user, 201, deviceFromRequest(req));
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

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  assertStrongPassword(newPassword, [user.name, user.email, user.studentId]);

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated.' });
});

exports.profileFor = profileFor;
