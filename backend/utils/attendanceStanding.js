const Attendance = require('../models/Attendance');
const ApiError = require('./ApiError');
const asyncHandler = require('./asyncHandler');
const { attendanceRules, TRAINEE_ROLES } = require('../config/constants');

/**
 * A trainee's attendance standing, always computed live from their
 * Attendance rows so it can never drift from the source data — the moment an
 * officer turns an Absent into Excused/Present (attendanceContestController,
 * attendanceController.update) the next request already sees the new count.
 *
 * Only `Absent` counts. Excused and Present (including absences approved
 * through a contest) never do; Late is attendance, not an absence.
 *
 *   atRisk     — at/over `absenceWarningAt` (default 3): home-screen warning
 *   restricted — at/over the limit (`maxAbsencesBeforeDrop`, default 5):
 *                the RESTRICTED_FEATURES below are locked server-side until
 *                an officer/admin corrects the record
 */
const RESTRICTED_FEATURES = ['Learning modules and activities', 'Attendance check-in/check-out'];

const RESTRICTION_CODE = 'ATTENDANCE_RESTRICTED';

function standingFrom(countedAbsences) {
  const { maxAbsencesBeforeDrop: limit, absenceWarningAt } = attendanceRules();
  const warnAt = Math.min(Math.max(1, absenceWarningAt), limit);
  const restricted = countedAbsences >= limit;
  const atRisk = countedAbsences >= warnAt;

  let status = 'Good Standing';
  let message = '';
  if (restricted) {
    status = 'At Risk / Restricted';
    message =
      `You have reached ${countedAbsences} counted absences (limit: ${limit}). ` +
      'You can no longer scan attendance. Please see your NSTP officer or the NSTP admin for assistance. ' +
      'If an absence was a mistake, you can still contest it from your attendance history.';
  } else if (atRisk) {
    status = 'At Risk for Dropping';
    message =
      `Attendance Warning: You already have ${countedAbsences} counted absences. ` +
      `At ${limit} absences you will no longer be able to scan attendance. ` +
      'Please coordinate with your NSTP officer.';
  }

  return {
    countedAbsences,
    limit,
    warnAt,
    remaining: Math.max(0, limit - countedAbsences),
    atRisk,
    restricted,
    status,
    message,
    restrictedFeatures: restricted ? RESTRICTED_FEATURES : [],
  };
}

async function countedAbsencesFor(userId, program) {
  return Attendance.countDocuments({ studentId: userId, program, status: 'Absent' });
}

/** Standing for one trainee user document (null for staff roles). */
async function standingForUser(user) {
  if (!user || !TRAINEE_ROLES.includes(user.role)) return null;
  const program = user.program || (user.role === 'cadet' ? 'ROTC' : 'CWTS');
  return standingFrom(await countedAbsencesFor(user._id, program));
}

/**
 * Throws a 403 if `user` is a trainee whose standing is restricted. Staff are
 * never restricted. `details.code` lets the mobile app show its
 * "Feature Locked" view instead of a generic error.
 */
async function assertNotRestricted(user, feature) {
  const standing = await standingForUser(user);
  if (!standing || !standing.restricted) return;
  throw new ApiError(
    403,
    `Access Restricted: ${feature} is currently restricted because you have reached ` +
      `${standing.limit} counted absences.`,
    { code: RESTRICTION_CODE, standing }
  );
}

/** Route middleware form of assertNotRestricted — place after protect(). */
function requireUnrestricted(feature) {
  return asyncHandler(async (req, _res, next) => {
    await assertNotRestricted(req.user, feature);
    next();
  });
}

module.exports = {
  RESTRICTED_FEATURES,
  RESTRICTION_CODE,
  standingFrom,
  standingForUser,
  countedAbsencesFor,
  assertNotRestricted,
  requireUnrestricted,
};
