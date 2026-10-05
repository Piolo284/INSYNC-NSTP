const mongoose = require('mongoose');

/**
 * One row per issued login token — backs the "Login Devices" / "Active
 * Sessions" list and "Logout All Devices" in the mobile app's Account &
 * Security screen. The JWT carries this document's _id as its `jti` claim;
 * middleware/auth.js's `protect` looks it up on every request and rejects
 * the token once `revokedAt` is set, which is what makes revocation actually
 * take effect immediately instead of waiting for the token to expire.
 */
const loginSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Free-text label the client supplies at login (e.g. "Android Device");
    // falls back to a generic label when the client doesn't send one (older
    // app builds, or a login from the web admin panel).
    deviceLabel: { type: String, trim: true, default: 'Unknown device' },
    platform: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('LoginSession', loginSessionSchema);
