const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { assertStrongPassword } = require('../utils/passwordStrength');
const { sendPasswordResetCode } = require('../utils/mailer');
const { notifyUser } = require('../utils/notify');
const { PASSWORD_RESET_STATUSES, PASSWORD_RESET_CODE_TTL_MINUTES } = require('../config/constants');

const sixDigit = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function findUserByIdentifier(identifier) {
  const raw = String(identifier).trim();
  const query = raw.includes('@')
    ? { email: raw.toLowerCase() }
    : { studentId: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  return User.findOne(query);
}

/**
 * POST /api/auth/forgot-password
 * A locked-out trainee submits their email/Student ID plus a short reason.
 * This never resets anything by itself — it only files a request that a
 * system_maintenance_admin manually reviews and approves (see approve()
 * below) before any reset code is ever issued.
 */
exports.request = asyncHandler(async (req, res) => {
  requireFields(req.body, ['identifier', 'reason']);

  const user = await findUserByIdentifier(req.body.identifier);
  if (!user) throw ApiError.notFound('No account found with that email or Student/Cadet ID.');

  const existingPending = await PasswordResetRequest.findOne({ userId: user._id, status: 'Pending' });
  if (existingPending) {
    throw ApiError.conflict('You already have a pending password reset request. Please wait for it to be reviewed.');
  }

  const request = await PasswordResetRequest.create({
    userId: user._id,
    email: user.email,
    reason: String(req.body.reason).trim(),
  });

  res.status(201).json({
    success: true,
    message: 'Your request has been submitted. A system administrator will review it and email you a reset code once verified.',
    data: { id: request._id, status: request.status },
  });
});

/**
 * GET /api/password-reset-requests — system_maintenance_admin's review queue.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    assertEnum(req.query.status, PASSWORD_RESET_STATUSES, 'status');
    filter.status = req.query.status;
  }

  const requests = await PasswordResetRequest.find(filter)
    .populate('userId', 'name email studentId role program')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: requests.length, data: requests });
});

/**
 * POST /api/password-reset-requests/:id/approve
 * Generates a one-time 6-digit code, emails it to the trainee's registered
 * address, and marks the request Approved. The code alone resets nothing —
 * exports.reset below still re-checks it matches, is unexpired, and unused.
 */
exports.approve = asyncHandler(async (req, res) => {
  const request = await PasswordResetRequest.findById(req.params.id).populate('userId', 'name email');
  if (!request) throw ApiError.notFound('Request not found.');
  if (request.status !== 'Pending') {
    throw ApiError.conflict('This request has already been reviewed.');
  }

  const code = sixDigit();
  request.status = 'Approved';
  request.resetCode = code;
  request.resetCodeExpiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MINUTES * 60000);
  request.reviewNote = req.body.reviewNote || '';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  const mail = await sendPasswordResetCode({
    to: request.userId.email,
    name: request.userId.name,
    code,
    minutes: PASSWORD_RESET_CODE_TTL_MINUTES,
  });

  await notifyUser(request.userId._id, {
    title: 'Password reset approved',
    message: 'Your password reset request was approved. Check your email for the reset code.',
    type: 'system',
    data: { requestId: request._id },
  });

  res.json({
    success: true,
    message: mail.devMode
      ? `Approved. SMTP is not configured (DEV mode) — the code is ${code}.`
      : 'Approved. A reset code has been emailed to the student.',
    // resetCode is select:false in the schema, but a document just saved in
    // memory still carries it — strip it here so it never leaves the server
    // once real delivery has happened (DEV mode surfaces it via `message`
    // above instead, since there's no real inbox to check it comes through).
    data: { ...request.toObject(), resetCode: undefined },
  });
});

/** POST /api/password-reset-requests/:id/reject */
exports.reject = asyncHandler(async (req, res) => {
  requireFields(req.body, ['reviewNote']);

  const request = await PasswordResetRequest.findById(req.params.id).populate('userId', 'name');
  if (!request) throw ApiError.notFound('Request not found.');
  if (request.status !== 'Pending') {
    throw ApiError.conflict('This request has already been reviewed.');
  }

  request.status = 'Rejected';
  request.reviewNote = req.body.reviewNote;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  await notifyUser(request.userId._id, {
    title: 'Password reset request rejected',
    message: `Your password reset request was rejected. Reason: ${request.reviewNote}`,
    type: 'system',
    data: { requestId: request._id },
  });

  res.json({ success: true, data: request });
});

/**
 * POST /api/auth/reset-password
 * Final step: the trainee submits the emailed code plus a new password.
 */
exports.reset = asyncHandler(async (req, res) => {
  requireFields(req.body, ['identifier', 'resetCode', 'newPassword']);

  const user = await findUserByIdentifier(req.body.identifier);
  if (!user) throw ApiError.badRequest('Invalid request.');

  assertStrongPassword(req.body.newPassword, [user.name, user.email, user.studentId]);

  const request = await PasswordResetRequest.findOne({
    userId: user._id,
    status: 'Approved',
    resetCodeUsedAt: null,
  })
    .select('+resetCode')
    .sort({ createdAt: -1 });

  if (!request || !request.resetCode) {
    throw ApiError.badRequest('No approved reset request found. Please submit a new request.');
  }
  if (request.resetCodeExpiresAt && request.resetCodeExpiresAt < new Date()) {
    throw ApiError.badRequest('This reset code has expired. Please submit a new request.');
  }
  if (request.resetCode !== String(req.body.resetCode).trim()) {
    throw ApiError.badRequest('Incorrect reset code.');
  }

  user.password = req.body.newPassword;
  await user.save();

  request.resetCodeUsedAt = new Date();
  await request.save();

  res.json({ success: true, message: 'Password reset. You can now log in with your new password.' });
});
