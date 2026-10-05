const ApiError = require('./ApiError');
const { ADMIN_ROLES } = require('../config/constants');

/**
 * The brigade-dimension counterpart to programScope.js. Admin roles
 * (admin_cwts/admin_rotc/super_admin) manage their whole program and are
 * never brigade-restricted; the plain 'officer' role is locked to
 * `user.brigadeId`. Every other role (student/cadet) isn't brigade-scoped by
 * this helper at all — trainees are restricted to their own record elsewhere
 * (assertSelfOrStaff), not by brigade.
 */
function isBrigadeRestricted(user) {
  return user.role === 'officer';
}

/**
 * Throws 403 unless `user` is allowed to touch a document/resource that
 * belongs to `targetBrigadeId`. No-op for admin roles.
 */
function assertBrigadeAccess(user, targetBrigadeId) {
  if (!isBrigadeRestricted(user)) return;
  if (!user.brigadeId || !targetBrigadeId || String(user.brigadeId) !== String(targetBrigadeId)) {
    throw ApiError.forbidden('You are not authorized to access this brigade.');
  }
}

/**
 * Applies brigade scoping to a Mongo filter object for list/collection
 * endpoints. An officer is unconditionally forced onto their own brigade
 * (ignoring any client-supplied brigade value); admin roles are unrestricted
 * unless they explicitly pass one via `requestedBrigadeId`.
 */
function scopeFilterToBrigade(filter, user, requestedBrigadeId) {
  if (!isBrigadeRestricted(user)) {
    if (requestedBrigadeId) filter.brigadeId = requestedBrigadeId;
    return filter;
  }
  if (!user.brigadeId) {
    // An officer with no brigade assigned yet sees nothing rather than
    // everything — fail closed, not open. `$in: []` never matches any
    // document, which is exactly the "return zero rows" we want here.
    filter.brigadeId = { $in: [] };
    return filter;
  }
  filter.brigadeId = user.brigadeId;
  return filter;
}

/**
 * Resolves what `brigadeId` a create-endpoint (attendance session, activity)
 * should use. An officer is always forced onto their own brigade regardless
 * of what the client sent (the system "automatically knows the officer's
 * brigade" — spec §8); an admin may optionally pass one explicitly (e.g. to
 * create a program-wide activity with no brigade at all).
 */
function resolveBrigadeForCreate(user, requestedBrigadeId) {
  if (!isBrigadeRestricted(user)) {
    return requestedBrigadeId || null;
  }
  if (!user.brigadeId) {
    throw ApiError.badRequest(
      'Your officer account has no brigade assigned yet. Contact your administrator.'
    );
  }
  return user.brigadeId;
}

module.exports = {
  isBrigadeRestricted,
  assertBrigadeAccess,
  scopeFilterToBrigade,
  resolveBrigadeForCreate,
};
