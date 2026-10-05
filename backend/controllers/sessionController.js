const LoginSession = require('../models/LoginSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logAccountActivity } = require('../utils/accountActivity');

/**
 * GET /api/auth/sessions
 * Backs both "Login Devices" and "Active Sessions" in the mobile app — the
 * same underlying list (there's no meaningful difference between the two
 * for this app, which has no per-device permission scoping), so both rows
 * point at this one endpoint.
 */
exports.list = asyncHandler(async (req, res) => {
  const sessions = await LoginSession.find({ userId: req.user._id, revokedAt: null }).sort({ lastSeenAt: -1 });

  res.json({
    success: true,
    data: sessions.map((s) => ({
      _id: s._id,
      deviceLabel: s.deviceLabel,
      platform: s.platform,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: req.sessionId === String(s._id),
    })),
  });
});

/** DELETE /api/auth/sessions/:id — "log out" one specific device. */
exports.revoke = asyncHandler(async (req, res) => {
  const session = await LoginSession.findOne({ _id: req.params.id, userId: req.user._id });
  if (!session) throw ApiError.notFound('Session not found.');
  if (session.revokedAt) {
    return res.json({ success: true, message: 'Already logged out.' });
  }

  session.revokedAt = new Date();
  await session.save();
  await logAccountActivity(req.user._id, 'session_revoked', `Logged out "${session.deviceLabel}".`);

  res.json({ success: true, message: 'That device has been logged out.' });
});

/** POST /api/auth/sessions/logout-all — revokes every session, including
 * the one making this request; the client is expected to clear its own
 * stored token and return to the login screen right after. */
exports.revokeAll = asyncHandler(async (req, res) => {
  const result = await LoginSession.updateMany(
    { userId: req.user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  await logAccountActivity(req.user._id, 'logout_all_devices', `Logged out ${result.modifiedCount} device(s).`);

  res.json({ success: true, message: 'You have been logged out of every device.' });
});
