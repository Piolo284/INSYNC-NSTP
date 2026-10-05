const mongoose = require('mongoose');

const ACCOUNT_ACTIVITY_ACTIONS = [
  'email_changed',
  'contact_number_changed',
  'password_changed',
  'two_factor_enabled',
  'two_factor_disabled',
  'session_revoked',
  'logout_all_devices',
];

/**
 * Audit trail for the mobile app's self-service "Account & Security"
 * actions (change email, change contact number, two-factor toggle, device/
 * session revocation). These changes are never admin-approved — the user
 * makes them directly, confirmed by an emailed code — but every one is
 * logged here so system_maintenance_admin has visibility into account
 * security activity across the system (see routes/accountActivityRoutes.js).
 */
const accountActivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: ACCOUNT_ACTIVITY_ACTIONS, required: true, index: true },
    detail: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('AccountActivityLog', accountActivityLogSchema);
module.exports.ACCOUNT_ACTIVITY_ACTIONS = ACCOUNT_ACTIVITY_ACTIONS;
