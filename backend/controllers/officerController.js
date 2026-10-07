const mongoose = require('mongoose');
const Officer = require('../models/Officer');
const User = require('../models/User');
const Brigade = require('../models/Brigade');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, isMarsuEmail, assertEnum, assertContactNumber } = require('../utils/validate');
const { ADMIN_ROLES, PROGRAMS, OFFICER_POSITIONS } = require('../config/constants');
const {
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
} = require('../utils/programScope');

/** Validates a brigadeId belongs to an Active brigade in `program`; returns the brigade or throws. */
async function resolveAssignedBrigade(brigadeId, program) {
  if (!brigadeId) return null;
  const brigade = await Brigade.findOne({ _id: brigadeId, nstpProgram: program, status: 'Active' });
  if (!brigade) throw ApiError.badRequest('That brigade does not exist for this program.');
  return brigade;
}

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

/**
 * GET /api/officers/special-class?program=CWTS|ROTC — who currently handles
 * that program's Inclusive Learning Section, if anyone. This track only
 * exists for ROTC (see utils/specialClass.js), so CWTS always resolves to
 * no officer. Defaults to the caller's own program (a trainee/officer never
 * needs to pass it); super_admin should pass it explicitly. Open to any
 * authenticated user (not just staff) so an Inclusive Learning Section
 * cadet's own dashboard can show their officer's contact info without
 * needing a staff-only endpoint.
 */
exports.specialClassOfficer = asyncHandler(async (req, res) => {
  const program = req.query.program || req.user.program || 'CWTS';
  assertEnum(program, PROGRAMS, 'program');
  if (program !== 'ROTC') {
    return res.json({ success: true, data: null });
  }
  const officer = await Officer.findOne({ program: 'ROTC', isSpecialClassOfficer: true });
  res.json({ success: true, data: officer });
});

/**
 * PUT /api/officers/:id/special-class — admin_rotc/super_admin only. The
 * Inclusive Learning Section only exists for ROTC, so a CWTS officer can
 * never be assigned it. Assigns or clears this officer as ROTC's single
 * handler for the track; at most one officer holds it at a time, so
 * assigning a new one automatically clears whoever held it before.
 */
exports.assignSpecialClass = asyncHandler(async (req, res) => {
  const officer = await resolveOfficer(req.params.id);
  assertProgramAccess(req.user, officer.program);

  if (officer.program !== 'ROTC') {
    throw ApiError.badRequest('The Inclusive Learning Section only exists for ROTC.');
  }

  const isSpecialClassOfficer = Boolean(req.body.isSpecialClassOfficer);
  if (isSpecialClassOfficer) {
    await Officer.updateMany(
      { program: officer.program, isSpecialClassOfficer: true },
      { $set: { isSpecialClassOfficer: false } }
    );
  }
  officer.isSpecialClassOfficer = isSpecialClassOfficer;
  await officer.save();

  res.json({ success: true, data: officer });
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
    position,
    brigadeId = null,
    contactNumber = '',
  } = req.body;

  requireFields(req.body, ['name', 'email', 'password', 'officerId', 'position']);
  assertContactNumber(contactNumber);

  if (!isMarsuEmail(email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long.');
  }

  // admin_cwts/admin_rotc are forced onto their own program; super_admin must
  // supply one explicitly.
  const program = resolveProgramForCreate(req.user, req.body.program);
  if (!OFFICER_POSITIONS[program].includes(position)) {
    throw ApiError.badRequest(`position must be one of: ${OFFICER_POSITIONS[program].join(', ')}.`);
  }
  const brigade = await resolveAssignedBrigade(brigadeId, program);

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
    brigadeId: brigade ? brigade._id : null,
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
    brigadeId: brigade ? brigade._id : null,
    brigade: brigade ? brigade.name : '',
    contactNumber,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: { user: user.toPublic(), officer } });
});

/**
 * POST /api/officers/promote — admin_cwts/admin_rotc/super_admin only.
 * Converts an existing student/cadet into an officer instead of creating a
 * brand-new account: the trainee's User keeps its login (name/email/
 * password unchanged) but its role flips to 'officer', its Student/Cadet
 * profile is removed, and a new Officer profile is created in its place.
 * The officer ID is simply the trainee's existing student/cadet ID — it is
 * never re-entered or changed by the promotion.
 */
exports.promote = asyncHandler(async (req, res) => {
  const {
    studentUserId,
    position,
    brigadeId,
    contactNumber = '',
  } = req.body;

  requireFields(req.body, ['studentUserId', 'brigadeId', 'position']);
  assertContactNumber(contactNumber);

  const program = resolveProgramForCreate(req.user, req.body.program);
  if (!OFFICER_POSITIONS[program].includes(position)) {
    throw ApiError.badRequest(`position must be one of: ${OFFICER_POSITIONS[program].join(', ')}.`);
  }
  const brigade = await resolveAssignedBrigade(brigadeId, program);
  if (!brigade) throw ApiError.badRequest('Select a brigade first.');

  const sourceUser = await User.findById(studentUserId);
  if (!sourceUser) throw ApiError.notFound('That trainee account was not found.');

  const expectedRole = program === 'ROTC' ? 'cadet' : 'student';
  if (sourceUser.role !== expectedRole) {
    throw ApiError.badRequest(`Selected account is not a ${expectedRole}.`);
  }
  if (sourceUser.program !== program) {
    throw ApiError.badRequest('Selected trainee does not belong to this program.');
  }

  const officerId = sourceUser.studentId;

  const ProfileModel = program === 'ROTC' ? Cadet : Student;
  await ProfileModel.deleteOne({ userId: sourceUser._id });

  sourceUser.role = 'officer';
  sourceUser.brigadeId = brigade._id;
  if (contactNumber) sourceUser.contactNumber = contactNumber;
  sourceUser.status = 'Active';
  await sourceUser.save();

  const officer = await Officer.create({
    userId: sourceUser._id,
    officerId,
    fullName: sourceUser.name,
    email: sourceUser.email,
    program,
    position,
    brigadeId: brigade._id,
    brigade: brigade.name,
    contactNumber: contactNumber || sourceUser.contactNumber,
    status: 'Active',
  });

  res.status(201).json({ success: true, data: { user: sourceUser.toPublic(), officer } });
});

/**
 * PUT /api/officers/:id — edits profile fields; admins may also change
 * status (use status: 'Inactive' to deactivate rather than hard-deleting).
 */
exports.update = asyncHandler(async (req, res) => {
  const officer = await resolveOfficer(req.params.id);
  assertProgramAccess(req.user, officer.program);

  const userId = officer.userId?._id || officer.userId;
  const isAdmin = ADMIN_ROLES.includes(req.user.role);
  // A plain officer may only edit their own profile — closes the previous
  // gap where any officer could edit any other officer's record.
  if (!isAdmin && String(req.user._id) !== String(userId)) {
    throw ApiError.forbidden('You can only edit your own profile.');
  }

  // Only enforce the MARSU domain when the email is actually being changed —
  // an officer whose email predates this rule must stay editable for every
  // other field without being forced to also fix their email in the same save.
  if (req.body.email !== undefined && req.body.email !== officer.email && !isMarsuEmail(req.body.email)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }

  if (req.body.position !== undefined) {
    assertEnum(req.body.position, OFFICER_POSITIONS[officer.program], 'position');
  }

  assertContactNumber(req.body.contactNumber);
  const fields = ['fullName', 'email', 'position', 'contactNumber', 'profileImage'];
  // Brigade assignment is admin-only, never self-service — an officer
  // cannot reassign themselves to a different brigade's students.
  if (isAdmin) fields.push('status');

  fields.forEach((f) => {
    if (req.body[f] !== undefined) officer[f] = req.body[f];
  });

  const userUpdate = {};
  if (req.body.name !== undefined) userUpdate.name = req.body.name;
  if (isAdmin && req.body.status !== undefined) userUpdate.status = req.body.status;

  if (isAdmin && req.body.brigadeId !== undefined) {
    const brigade = await resolveAssignedBrigade(req.body.brigadeId, officer.program);
    officer.brigadeId = brigade ? brigade._id : null;
    officer.brigade = brigade ? brigade.name : '';
    userUpdate.brigadeId = officer.brigadeId;
  }

  await officer.save();
  if (Object.keys(userUpdate).length) {
    await User.findByIdAndUpdate(userId, userUpdate);
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
