const ApiError = require('./ApiError');
const { PROGRAMS } = require('../config/constants');

/**
 * super_admin has no single program (sees both CWTS + ROTC); everyone else —
 * admin_cwts, admin_rotc, officer, student, cadet — is locked to req.user.program.
 * Returns null for super_admin (meaning "no filter"), otherwise the program string.
 */
function effectiveProgram(user) {
  return user.role === 'super_admin' ? null : user.program;
}

/**
 * Throws 403 unless `user` is allowed to touch a document/resource that
 * belongs to `targetProgram`. This is what closes the "edit the ID/program in
 * the request" attack for admin_cwts/admin_rotc/officer/student/cadet.
 */
function assertProgramAccess(user, targetProgram) {
  if (user.role === 'super_admin') return;
  if (!targetProgram || user.program !== targetProgram) {
    throw ApiError.forbidden('You are not authorized to access this program.');
  }
}

/**
 * Applies program scoping to a Mongo filter object for list/collection
 * endpoints. Non-super_admin roles are forced onto their own program
 * (ignoring any client-supplied `program` query value); super_admin may
 * optionally filter by `?program=CWTS|ROTC`, defaulting to no filter.
 */
function scopeFilterToProgram(filter, user, requestedProgram) {
  if (user.role === 'super_admin') {
    if (requestedProgram && PROGRAMS.includes(requestedProgram)) {
      filter.program = requestedProgram;
    }
    return filter;
  }
  filter.program = user.program;
  return filter;
}

/**
 * Resolves what `program` a create-endpoint should use. super_admin must
 * supply a valid program explicitly; every other role is forced onto their
 * own program regardless of what the client sent.
 */
function resolveProgramForCreate(user, requestedProgram) {
  if (user.role === 'super_admin') {
    if (!requestedProgram || !PROGRAMS.includes(requestedProgram)) {
      throw ApiError.badRequest(`program must be one of: ${PROGRAMS.join(', ')}.`);
    }
    return requestedProgram;
  }
  return user.program;
}

module.exports = {
  effectiveProgram,
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
};
