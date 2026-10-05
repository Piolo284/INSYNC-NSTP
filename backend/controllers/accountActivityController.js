const AccountActivityLog = require('../models/AccountActivityLog');
const { ACCOUNT_ACTIVITY_ACTIONS } = require('../models/AccountActivityLog');
const asyncHandler = require('../utils/asyncHandler');
const { assertEnum } = require('../utils/validate');

/**
 * GET /api/account-activity — system_maintenance_admin's read-only audit
 * view of every self-service account-security action (email/contact number
 * changes, two-factor toggles, device logouts) across the whole system.
 * These actions are never admin-approved (see controllers/accountController.js
 * and sessionController.js) — this is visibility only, not a gate.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) {
    assertEnum(req.query.action, ACCOUNT_ACTIVITY_ACTIONS, 'action');
    filter.action = req.query.action;
  }

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await AccountActivityLog.find(filter)
    .populate('userId', 'name email studentId role')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ success: true, count: logs.length, data: logs });
});
