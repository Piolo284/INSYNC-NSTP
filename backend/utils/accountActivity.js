const AccountActivityLog = require('../models/AccountActivityLog');

/** Records one self-service account-security event. Never throws into the
 * caller's happy path — a logging failure shouldn't block the actual action
 * (same convention as utils/notify.js). */
async function logAccountActivity(userId, action, detail = '') {
  try {
    return await AccountActivityLog.create({ userId, action, detail });
  } catch (err) {
    console.error('[accountActivity] failed:', err.message);
    return null;
  }
}

module.exports = { logAccountActivity };
