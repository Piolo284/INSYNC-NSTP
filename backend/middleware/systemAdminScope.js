const jwt = require('jsonwebtoken');

/**
 * Defense-in-depth for system_maintenance_admin: several existing NSTP
 * routes (e.g. /modules, /attendance, /attendance/summary, /grades,
 * /announcements, /documents) only require *some* authenticated user
 * (`router.use(protect)` with no per-route `authorize()` allow-list) and
 * rely on each controller's own program/role filtering to scope results —
 * fine for the app's existing six roles, but this role has no program and
 * isn't meant to reach any of them at all, allow-list or not.
 *
 * Rather than retrofit an authorize() call onto every such route (risking
 * behavior changes for the existing roles that legitimately use them), this
 * is a single global gate: for this one role only, every /api/* request
 * must fall under an explicit allow-list of path prefixes, or it's 403'd
 * here before it ever reaches a controller. Every other role is untouched —
 * `next()` fires immediately if the token's role isn't this one, so this
 * can never change behavior for a trainee/officer/program-admin/super_admin
 * request.
 *
 * Mounted before the main router in server.js. Does its own lightweight JWT
 * decode (same approach as middleware/maintenanceMode.js) instead of the
 * full `protect` (DB lookup) — if the token is missing/invalid, this simply
 * lets the request through so whichever route's own `protect` can issue the
 * real 401.
 */
const ALLOWED_PATH_PREFIXES = ['/auth', '/notifications', '/system', '/certificate-templates', '/announcement-templates', '/master-enrollment', '/password-reset-requests', '/programs', '/brigades', '/account-activity', '/admin-accounts'];

function systemAdminScope(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next();
  }

  if (payload.role !== 'system_maintenance_admin') return next();

  const allowed = ALLOWED_PATH_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
  if (allowed) return next();

  return res.status(403).json({ success: false, message: 'Your role does not have access to this action.' });
}

module.exports = systemAdminScope;
