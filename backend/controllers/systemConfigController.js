const SystemConfig = require('../models/SystemConfig');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const systemConfigCache = require('../utils/systemConfigCache');
const { assertEnum } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');

async function logMaintenanceToggle(userId, enabled) {
  const mongoose = require('mongoose');
  const TechnicalActivityLog = mongoose.models.TechnicalActivityLog;
  if (!TechnicalActivityLog) return; // Phase C model not installed yet
  await TechnicalActivityLog.create({
    action: enabled ? 'maintenance_mode_enabled' : 'maintenance_mode_disabled',
    performedBy: userId,
  });
}

/** GET /api/system/config */
exports.get = asyncHandler(async (req, res) => {
  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    { $setOnInsert: { singleton: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: config });
});

/** PUT /api/system/config/general — { orgName, supportEmail } */
exports.updateGeneral = asyncHandler(async (req, res) => {
  const { orgName, supportEmail } = req.body;
  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    {
      $set: {
        ...(orgName !== undefined ? { 'general.orgName': orgName } : {}),
        ...(supportEmail !== undefined ? { 'general.supportEmail': supportEmail } : {}),
        updatedBy: req.user._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await systemConfigCache.refresh();
  res.json({ success: true, data: config });
});

/** PUT /api/system/config/maintenance — { enabled, message, scheduledStart, scheduledEnd } */
exports.updateMaintenance = asyncHandler(async (req, res) => {
  const { enabled, message, scheduledStart, scheduledEnd } = req.body;

  if (scheduledStart && scheduledEnd && new Date(scheduledStart) >= new Date(scheduledEnd)) {
    throw ApiError.badRequest('Maintenance start must be before the end.');
  }

  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    {
      $set: {
        ...(enabled !== undefined ? { 'maintenance.enabled': Boolean(enabled) } : {}),
        ...(message !== undefined ? { 'maintenance.message': message } : {}),
        'maintenance.scheduledStart': scheduledStart ? new Date(scheduledStart) : null,
        'maintenance.scheduledEnd': scheduledEnd ? new Date(scheduledEnd) : null,
        'maintenance.updatedBy': req.user._id,
        'maintenance.updatedAt': new Date(),
        updatedBy: req.user._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await systemConfigCache.refresh();
  if (enabled !== undefined) await logMaintenanceToggle(req.user._id, Boolean(enabled));
  res.json({ success: true, data: config });
});

/** PUT /api/system/config/qr — { codeTtlMinutesOverride } */
exports.updateQr = asyncHandler(async (req, res) => {
  const { codeTtlMinutesOverride } = req.body;
  if (codeTtlMinutesOverride !== null && codeTtlMinutesOverride !== undefined) {
    const n = Number(codeTtlMinutesOverride);
    if (!Number.isFinite(n) || n <= 0) {
      throw ApiError.badRequest('codeTtlMinutesOverride must be a positive number, or null to use the .env default.');
    }
  }
  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    {
      $set: {
        'qr.codeTtlMinutesOverride':
          codeTtlMinutesOverride === undefined || codeTtlMinutesOverride === '' ? null : Number(codeTtlMinutesOverride),
        updatedBy: req.user._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await systemConfigCache.refresh();
  res.json({ success: true, data: config });
});

/** PUT /api/system/config/email — { supportContactName, supportContactEmail } (display-only, never SMTP secrets) */
exports.updateEmail = asyncHandler(async (req, res) => {
  const { supportContactName, supportContactEmail } = req.body;
  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    {
      $set: {
        ...(supportContactName !== undefined ? { 'email.supportContactName': supportContactName } : {}),
        ...(supportContactEmail !== undefined ? { 'email.supportContactEmail': supportContactEmail } : {}),
        updatedBy: req.user._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await systemConfigCache.refresh();
  res.json({ success: true, data: config });
});

/**
 * PUT /api/system/config/grading — { program, weights: { modules, activities, attendance } }
 * Overrides the GRADE_WEIGHT_* .env defaults for one program at a time.
 * Passing `weights: null` clears that program's override, reverting it to
 * the shared .env default.
 */
exports.updateGrading = asyncHandler(async (req, res) => {
  const { program, weights } = req.body;
  assertEnum(program, PROGRAMS, 'program');

  let setOp;
  if (weights === null) {
    setOp = {
      [`grading.${program}.weights.modules`]: null,
      [`grading.${program}.weights.activities`]: null,
      [`grading.${program}.weights.attendance`]: null,
    };
  } else {
    const { modules, activities, attendance } = weights || {};
    const nums = [modules, activities, attendance].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
      throw ApiError.badRequest('modules, activities, and attendance must each be a non-negative number.');
    }
    if (nums[0] + nums[1] + nums[2] !== 100) {
      throw ApiError.badRequest('modules + activities + attendance must total exactly 100.');
    }
    setOp = {
      [`grading.${program}.weights.modules`]: nums[0],
      [`grading.${program}.weights.activities`]: nums[1],
      [`grading.${program}.weights.attendance`]: nums[2],
    };
  }

  const config = await SystemConfig.findOneAndUpdate(
    { singleton: 1 },
    { $set: { ...setOp, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await systemConfigCache.refresh();
  res.json({ success: true, data: config });
});
