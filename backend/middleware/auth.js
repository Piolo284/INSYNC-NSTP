const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLES } = require('../config/constants');

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, program: user.program || null },
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
  if (user.status === 'Inactive' || user.status === 'Dropped') {
    throw ApiError.forbidden('This account is no longer active.');
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
