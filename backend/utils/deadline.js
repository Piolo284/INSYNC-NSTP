const ApiError = require('./ApiError');

// MARSU is in the Philippines (UTC+8, no DST).
const PH_OFFSET = '+08:00';

/**
 * Turns the officer's due date into the exact cutoff instant. The officer app
 * sends a bare "YYYY-MM-DD"; `new Date()` would read that as midnight UTC
 * (8 AM in PH), making work "Missing" on the morning of its own due date. A
 * bare date therefore means the END of that day, Philippine time. A full
 * timestamp is kept as-is. Empty → null (no deadline).
 */
function parseDeadline(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59.999${PH_OFFSET}`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('deadline is not a valid date.');
  return date;
}

function isPastDeadline(module, now = new Date()) {
  return Boolean(module && module.deadline && module.deadline < now);
}

/**
 * Throws once the module's due date has passed — the trainee's work is then
 * Missing (or locked in, if already turned in) and can't be turned in,
 * replaced or withdrawn anymore.
 */
function assertBeforeDeadline(module) {
  if (isPastDeadline(module)) {
    throw ApiError.forbidden(
      'The due date has passed. This activity can no longer be turned in. ' +
        'Use the private comments to reach your officer about it.'
    );
  }
}

module.exports = { parseDeadline, isPastDeadline, assertBeforeDeadline };
