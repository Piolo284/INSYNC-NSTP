const mongoose = require('mongoose');
const { PASSWORD_RESET_STATUSES } = require('../config/constants');

/**
 * A trainee's request to reset a forgotten password. Unlike a typical
 * self-service "email me a reset link" flow, every request here is routed to
 * a system_maintenance_admin for manual identity verification — a reset
 * code is only generated and emailed once that admin approves it (see
 * controllers/passwordResetController.js), so a stolen email/Student ID
 * alone is never enough to reset someone else's password.
 */
const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    reason: { type: String, trim: true, default: '' },
    status: { type: String, enum: PASSWORD_RESET_STATUSES, default: 'Pending', index: true },
    resetCode: { type: String, select: false, default: null },
    resetCodeExpiresAt: { type: Date, default: null },
    resetCodeUsedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One PENDING request per trainee at a time — they can file again after a
// Rejected decision, but can't stack multiple pending requests.
passwordResetRequestSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
