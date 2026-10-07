const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, isMarsuEmail, assertContactNumber } = require('../utils/validate');
const { assertStrongPassword } = require('../utils/passwordStrength');
const { sendVerificationCode } = require('../utils/mailer');
const { logAccountActivity } = require('../utils/accountActivity');

const { sixDigit, codeSentMessage, checkCode } = require('../utils/verificationCode');
const CODE_TTL_MINUTES = 15;

/**
 * POST /api/auth/email/request-change
 * The code is emailed to the NEW address (not the current one) — the whole
 * point is proving the trainee actually controls the inbox they're moving
 * to, same reasoning any "change your email" flow uses.
 */
exports.requestEmailChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['newEmail']);
  const newEmail = String(req.body.newEmail).trim().toLowerCase();

  if (!isMarsuEmail(newEmail)) {
    throw ApiError.badRequest('Please use an official MARSU email address (e.g. juandelacruz@marsu.edu.ph).');
  }
  if (newEmail === req.user.email) {
    throw ApiError.badRequest('That is already your current email address.');
  }
  const existing = await User.findOne({ email: newEmail });
  if (existing) {
    throw ApiError.conflict('That email address is already in use by another account.');
  }

  const code = sixDigit();
  const user = await User.findById(req.user._id);
  user.pendingEmail = newEmail;
  user.pendingEmailCode = code;
  user.pendingEmailCodeExpiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60000);
  user.pendingEmailCodeAttempts = 0;
  await user.save();

  const mail = await sendVerificationCode({
    to: newEmail,
    name: user.name,
    code,
    purpose: 'confirm this as your new NSTP Portal email address',
    minutes: CODE_TTL_MINUTES,
  });

  res.json({
    success: true,
    message: codeSentMessage(mail, newEmail),
  });
});

/** POST /api/auth/email/confirm */
exports.confirmEmailChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['code']);

  const user = await User.findById(req.user._id).select(
    '+pendingEmail +pendingEmailCode +pendingEmailCodeExpiresAt +pendingEmailCodeAttempts'
  );
  if (!user.pendingEmail || !user.pendingEmailCode) {
    throw ApiError.badRequest('No email change is in progress. Please request one first.');
  }
  await checkCode(user, {
    codeField: 'pendingEmailCode',
    expiresField: 'pendingEmailCodeExpiresAt',
    attemptsField: 'pendingEmailCodeAttempts',
    input: req.body.code,
  });

  // Re-check uniqueness — someone else may have claimed it while this code
  // was outstanding.
  const existing = await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
  if (existing) {
    throw ApiError.conflict('That email address is already in use by another account.');
  }

  const oldEmail = user.email;
  user.email = user.pendingEmail;
  user.pendingEmail = null;
  user.pendingEmailCode = null;
  user.pendingEmailCodeExpiresAt = null;
  await user.save();

  await logAccountActivity(user._id, 'email_changed', `Email changed from ${oldEmail} to ${user.email}.`);

  res.json({ success: true, message: 'Your email address has been updated.', data: { user: user.toPublic() } });
});

/**
 * POST /api/auth/contact-number/request-change
 * There's no SMS provider in this app, so the new number itself can't be
 * verified — the code instead goes to the trainee's CURRENT email, proving
 * it's really the account owner making the request.
 */
exports.requestContactNumberChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['newContactNumber']);
  const newContactNumber = String(req.body.newContactNumber).trim();
  assertContactNumber(newContactNumber, { required: true });

  const code = sixDigit();
  const user = await User.findById(req.user._id);
  user.pendingContactNumber = newContactNumber;
  user.pendingContactNumberCode = code;
  user.pendingContactNumberCodeExpiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60000);
  user.pendingContactNumberCodeAttempts = 0;
  await user.save();

  const mail = await sendVerificationCode({
    to: user.email,
    name: user.name,
    code,
    purpose: 'confirm your new contact number',
    minutes: CODE_TTL_MINUTES,
  });

  res.json({
    success: true,
    message: codeSentMessage(mail),
  });
});

/** POST /api/auth/contact-number/confirm */
exports.confirmContactNumberChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['code']);

  const user = await User.findById(req.user._id).select(
    '+pendingContactNumber +pendingContactNumberCode +pendingContactNumberCodeExpiresAt +pendingContactNumberCodeAttempts'
  );
  if (!user.pendingContactNumber || !user.pendingContactNumberCode) {
    throw ApiError.badRequest('No contact number change is in progress. Please request one first.');
  }
  await checkCode(user, {
    codeField: 'pendingContactNumberCode',
    expiresField: 'pendingContactNumberCodeExpiresAt',
    attemptsField: 'pendingContactNumberCodeAttempts',
    input: req.body.code,
  });

  const oldNumber = user.contactNumber;
  user.contactNumber = user.pendingContactNumber;
  user.pendingContactNumber = null;
  user.pendingContactNumberCode = null;
  user.pendingContactNumberCodeExpiresAt = null;
  await user.save();

  await logAccountActivity(
    user._id,
    'contact_number_changed',
    `Contact number changed from ${oldNumber || '(none)'} to ${user.contactNumber}.`
  );

  res.json({ success: true, message: 'Your contact number has been updated.', data: { user: user.toPublic() } });
});

/**
 * POST /api/auth/password/request-change
 * Self-service "change password" for the mobile app, mirroring the email/
 * contact-number change flow: the current password is checked up front,
 * then a code is emailed to the trainee's own registered address before the
 * new password actually takes effect. The new password is hashed
 * immediately and held pending confirmation — it is never stored in
 * plaintext, even during this waiting window.
 */
exports.requestPasswordChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  assertStrongPassword(newPassword, [user.name, user.email, user.studentId]);

  const code = sixDigit();
  user.pendingPasswordHash = await bcrypt.hash(newPassword, 10);
  user.pendingPasswordCode = code;
  user.pendingPasswordCodeExpiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60000);
  user.pendingPasswordCodeAttempts = 0;
  await user.save();

  const mail = await sendVerificationCode({
    to: user.email,
    name: user.name,
    code,
    purpose: 'confirm your new NSTP Portal password',
    minutes: CODE_TTL_MINUTES,
  });

  res.json({
    success: true,
    message: codeSentMessage(mail),
  });
});

/** POST /api/auth/password/confirm */
exports.confirmPasswordChange = asyncHandler(async (req, res) => {
  requireFields(req.body, ['code']);

  const user = await User.findById(req.user._id).select(
    '+pendingPasswordHash +pendingPasswordCode +pendingPasswordCodeExpiresAt +pendingPasswordCodeAttempts'
  );
  if (!user.pendingPasswordHash || !user.pendingPasswordCode) {
    throw ApiError.badRequest('No password change is in progress. Please request one first.');
  }
  await checkCode(user, {
    codeField: 'pendingPasswordCode',
    expiresField: 'pendingPasswordCodeExpiresAt',
    attemptsField: 'pendingPasswordCodeAttempts',
    input: req.body.code,
  });

  // Written via updateOne (not save()) so the User model's pre-save hashing
  // hook does not re-hash a value that is already a bcrypt hash.
  await User.updateOne(
    { _id: user._id },
    {
      $set: { password: user.pendingPasswordHash },
      $unset: {
        pendingPasswordHash: '',
        pendingPasswordCode: '',
        pendingPasswordCodeExpiresAt: '',
        pendingPasswordCodeAttempts: '',
      },
    }
  );

  await logAccountActivity(user._id, 'password_changed', 'Password changed.');

  res.json({ success: true, message: 'Your password has been updated.' });
});

/**
 * PUT /api/auth/2fa
 * Toggling this security-sensitive setting re-checks the current password,
 * same as changing it — a stolen unlocked phone shouldn't be enough on its
 * own to turn two-factor off.
 */
exports.toggleTwoFactor = asyncHandler(async (req, res) => {
  requireFields(req.body, ['enable', 'currentPassword']);

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  const enable = Boolean(req.body.enable);
  user.twoFactorEnabled = enable;
  await user.save();

  await logAccountActivity(user._id, enable ? 'two_factor_enabled' : 'two_factor_disabled');

  res.json({
    success: true,
    message: enable ? 'Two-factor authentication is now on.' : 'Two-factor authentication is now off.',
    data: { user: user.toPublic() },
  });
});
