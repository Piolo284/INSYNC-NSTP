const ApiError = require('./ApiError');
const Masterlist = require('../models/Masterlist');
const { resolveBrigadeForCourse } = require('./brigadeAssignment');

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

/** Case/whitespace/punctuation-insensitive full-name comparison. */
function namesMatch(masterlistName, typedName) {
  return normalizeName(masterlistName) === normalizeName(typedName);
}

/**
 * True if the masterlist's `courseProgram` and the trainee's typed `course`
 * refer to the same course. Tries a direct case-insensitive string match
 * first (handles a masterlist CSV and the registration form agreeing on the
 * same text verbatim), then falls back to resolving both through the same
 * Program lookup the rest of the app already uses (utils/brigadeAssignment)
 * so "BSIT" (a registrar's short code) still matches "BS Information
 * Technology" (what the registration dropdown actually sends).
 */
async function courseProgramMatches(masterlistCourse, typedCourse, nstpProgram) {
  const normalize = (v) => String(v || '').trim().toLowerCase();
  if (normalize(masterlistCourse) === normalize(typedCourse)) return true;
  if (!masterlistCourse || !typedCourse) return false;

  const [resolvedMaster, resolvedTyped] = await Promise.all([
    resolveBrigadeForCourse(masterlistCourse, nstpProgram),
    resolveBrigadeForCourse(typedCourse, nstpProgram),
  ]);
  if (!resolvedMaster || !resolvedTyped) return false;
  return String(resolvedMaster.program._id) === String(resolvedTyped.program._id);
}

/**
 * Runs the full masterlist check (existence -> name -> course) and throws
 * the matching ApiError on the first failure. Shared by the Step-1 "can I
 * even proceed" pre-check (authController.validateEnrollment) and the final
 * registration gate (authController.register) so both agree on exactly the
 * same rule and wording. There is no enrollment-status check — being on the
 * masterlist at all is the only bar; see models/Masterlist.js.
 */
async function assertMasterlistMatch({ studentId, name, course, program }) {
  const masterRecord = await Masterlist.findOne({
    studentNumber: String(studentId).trim().toUpperCase(),
  });
  if (!masterRecord) {
    throw ApiError.forbidden(
      'You are not in the list of enrolled student in NSTP, Please contact the Administrator if you believe this is a mistake.'
    );
  }
  if (!namesMatch(masterRecord.fullName, name)) {
    throw ApiError.forbidden(
      'The name you entered does not match the official student record.'
    );
  }
  if (!(await courseProgramMatches(masterRecord.courseProgram, course, program))) {
    throw ApiError.forbidden(
      'The program entered does not match the official student record.'
    );
  }
  return masterRecord;
}

module.exports = { namesMatch, courseProgramMatches, assertMasterlistMatch };
