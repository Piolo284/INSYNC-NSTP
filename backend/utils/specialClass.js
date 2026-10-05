const Officer = require('../models/Officer');
const Cadet = require('../models/Cadet');
const ApiError = require('./ApiError');
const { SPECIAL_CLASS_CATEGORIES } = require('../config/constants');

/**
 * The Inclusive Learning Section (formerly "Special Class") track exists
 * for ROTC only — a PWD/Medical-Condition cadet is exempt from field
 * training/drills and placed on their own alternative track. CWTS has no
 * equivalent physically-demanding requirement that this track was designed
 * to exempt someone from, so every function below is a no-op for CWTS.
 *
 * True if `user` is allowed to manage `program`'s Inclusive Learning Section
 * — the single officer assigned to that track, or the admin who outranks
 * them (admin_rotc, or super_admin).
 */
async function isSpecialClassManager(user, program) {
  if (program !== 'ROTC') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin_rotc') return true;
  if (user.role !== 'officer') return false;
  const officer = await Officer.findOne({ userId: user._id }).select('isSpecialClassOfficer program');
  return Boolean(officer?.isSpecialClassOfficer && officer.program === 'ROTC');
}

async function assertSpecialClassManager(user, program) {
  if (!(await isSpecialClassManager(user, program))) {
    throw ApiError.forbidden(`You are not the assigned ${program} Inclusive Learning Section officer.`);
  }
}

/**
 * True if the given trainee belongs to the PWD/Medical-Condition Inclusive
 * Learning Section. ROTC (cadet) only — a CWTS student is never in it,
 * regardless of their specialCategory.
 */
async function isSpecialClassTrainee(userId, role) {
  if (role !== 'cadet') return false;
  const profile = await Cadet.findOne({ userId }).select('specialCategory');
  return Boolean(profile && SPECIAL_CLASS_CATEGORIES.includes(profile.specialCategory));
}

/**
 * The userIds of every active Inclusive Learning Section cadet in `program`
 * — the roster the assigned officer manages, cutting across every company.
 * Used to scope attendance-derived queries (list, at-risk) for that officer
 * instead of the normal single-brigade `scopeFilterToBrigade`, which would
 * wrongly force them onto their own personal brigade and never match these
 * records (whose `brigadeId` is always null). Always empty for CWTS.
 */
async function specialClassTraineeIds(program) {
  if (program !== 'ROTC') return [];
  const profiles = await Cadet.find({
    program: 'ROTC',
    specialCategory: { $in: SPECIAL_CLASS_CATEGORIES },
    status: 'Active',
  }).select('userId');
  return profiles.map((p) => p.userId);
}

module.exports = {
  isSpecialClassManager,
  assertSpecialClassManager,
  isSpecialClassTrainee,
  specialClassTraineeIds,
};
