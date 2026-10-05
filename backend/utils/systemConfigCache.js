const SystemConfig = require('../models/SystemConfig');

/**
 * In-memory mirror of the single SystemConfig document — read on the hot
 * path (the maintenance-mode gate runs on every request; attendanceRules()
 * runs on every QR-code generation) without hitting Mongo each time.
 * load() runs once at server startup; refresh() is called by
 * systemConfigController after every write, and is also what the
 * "Clear Cache" maintenance tool calls.
 */
let cached = null;

const DEFAULTS = {
  general: { orgName: 'MARSU NSTP Portal', supportEmail: '' },
  maintenance: {
    enabled: false,
    message: 'iNSync is currently undergoing scheduled maintenance. Please try again later.',
    scheduledStart: null,
    scheduledEnd: null,
  },
  qr: { codeTtlMinutesOverride: null },
  email: { supportContactName: '', supportContactEmail: '' },
  grading: {
    CWTS: { weights: { modules: null, activities: null, attendance: null } },
    ROTC: { weights: { modules: null, activities: null, attendance: null } },
  },
};

async function load() {
  const doc = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    { $setOnInsert: { singleton: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  cached = doc;
  return cached;
}

/** Sync getter — always returns something usable, even before load() has run. */
function get() {
  return cached || DEFAULTS;
}

function getQrTtlOverride() {
  const value = get().qr && get().qr.codeTtlMinutesOverride;
  return value === undefined ? null : value;
}

/**
 * `{ modules, activities, attendance }` or null if this program has no
 * override on file yet (or only some of the three are set) — callers fall
 * back to the .env defaults in that case rather than using a partial set.
 */
function getGradingWeightsOverride(program) {
  const weights = get().grading && get().grading[program] && get().grading[program].weights;
  if (!weights) return null;
  const { modules, activities, attendance } = weights;
  if (modules == null || activities == null || attendance == null) return null;
  return { modules, activities, attendance };
}

async function refresh() {
  return load();
}

module.exports = { load, get, getQrTtlOverride, getGradingWeightsOverride, refresh };
