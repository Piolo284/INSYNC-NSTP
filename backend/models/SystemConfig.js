const mongoose = require('mongoose');

/**
 * A single, always-upserted configuration document (never queried by id —
 * always `findOne({ singleton: 1 })`) holding the handful of runtime
 * settings the System Maintenance Administrator can change without a
 * redeploy. Read through utils/systemConfigCache.js, not this model
 * directly, everywhere except the settings controller that writes it.
 */
const systemConfigSchema = new mongoose.Schema(
  {
    singleton: { type: Number, default: 1, unique: true },
    general: {
      orgName: { type: String, default: 'MARSU NSTP Portal' },
      supportEmail: { type: String, default: '' },
    },
    maintenance: {
      enabled: { type: Boolean, default: false },
      message: {
        type: String,
        default: 'iNSync is currently undergoing scheduled maintenance. Please try again later.',
      },
      scheduledStart: { type: Date, default: null },
      scheduledEnd: { type: Date, default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date, default: null },
    },
    qr: {
      // When set, overrides ATTENDANCE_CODE_TTL_MINUTES from .env without a restart.
      codeTtlMinutesOverride: { type: Number, default: null },
    },
    email: {
      // Display-only contact info — never SMTP credentials.
      supportContactName: { type: String, default: '' },
      supportContactEmail: { type: String, default: '' },
    },
    // Per-program grade-computation weights (modules/activities/attendance,
    // must total 100) — overrides the GRADE_WEIGHT_* .env defaults in
    // config/constants.js without a redeploy. Left null, a program falls
    // back to the shared .env values exactly as before this existed.
    grading: {
      CWTS: {
        weights: {
          modules: { type: Number, default: null },
          activities: { type: Number, default: null },
          attendance: { type: Number, default: null },
        },
      },
      ROTC: {
        weights: {
          modules: { type: Number, default: null },
          activities: { type: Number, default: null },
          attendance: { type: Number, default: null },
        },
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
