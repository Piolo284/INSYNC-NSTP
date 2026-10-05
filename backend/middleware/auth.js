const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginSession = require('../models/LoginSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLES } = require('../config/constants');

/** `jti` is a LoginSession document's _id — omitted for any caller that
 * hasn't been updated to create one first, so older call sites keep working
 * (protect() below treats a missing jti as "not session-tracked", not invalid). */
function signToken(user, jti) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, program: user.program || null, jti: jti ? String(jti) : undefined },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** Rejects the request unless a valid Bearer token maps to an active user. */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication required. Please log in again.');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists.');
  }
  if (user.status === 'Dropped') {
    throw ApiError.forbidden(
      'This account has been dropped for exceeding the maximum allowed absences. Please contact your program administrator to have your account reviewed.'
    );
  }
  if (user.status === 'Inactive') {
    throw ApiError.forbidden('This account is no longer active. Please contact your program administrator.');
  }

  // Session revocation ("Logout All Devices" / removing one device) only
  // works because of this lookup — a JWT is normally stateless and would
  // otherwise stay valid until it expires no matter what. A token with no
  // jti (issued before this feature, or by a call site that hasn't been
  // updated) skips the check entirely rather than being rejected.
  if (payload.jti) {
    const session = await LoginSession.findById(payload.jti);
    if (!session || session.revokedAt) {
      throw ApiError.unauthorized('This session has been logged out. Please log in again.');
    }
    session.lastSeenAt = new Date();
    session.save().catch(() => {}); // best-effort — never block the request on this
    req.sessionId = String(session._id);
  }

  req.user = user;
  next();
});

/** Usage: router.post('/', protect, authorize('officer', 'admin_cwts'), handler) */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('Your role does not have access to this action.')
      );
    }
    next();
  };
}

/** Trainees may only read their own records; staff may read anyone's. */
function assertSelfOrStaff(req, targetUserId) {
  const isSelf = String(req.user._id) === String(targetUserId);
  const isStaff = STAFF_ROLES.includes(req.user.role);
  if (!isSelf && !isStaff) {
    throw ApiError.forbidden('You can only view your own records.');
  }
}

module.exports = { protect, authorize, signToken, assertSelfOrStaff };
