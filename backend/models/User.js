const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, PROGRAMS, USER_STATUSES, CAMPUSES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },

    // Shared identifier: student number for trainees, cadet number for ROTC,
    // employee/officer number for staff. Unique when present.
    studentId: { type: String, trim: true },

    program: { type: String, enum: PROGRAMS, index: true },
    // Denormalized from the role profile (Student/Cadet/Officer) so
    // brigade-scoped authorization (utils/brigadeScope.js) can read it
    // straight off req.user with no extra lookup.
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    yearLevel: { type: String, trim: true },
    section: { type: String, trim: true },
    // MARSU campus the trainee is enrolled at, collected at registration.
    campus: { type: String, enum: CAMPUSES, default: null },
    profileImage: { type: String, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active', index: true },

    // Email-code two-factor login (see controllers/authController.js login/
    // verifyTwoFactor) — not TOTP/authenticator-app based, same "email a
    // 6-digit code" pattern already used for attendance and password reset.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCode: { type: String, select: false, default: null },
    twoFactorCodeExpiresAt: { type: Date, select: false, default: null },

    // Self-service "change email" / "change contact number" — a code is
    // emailed to confirm before the change actually takes effect (see
    // controllers/accountController.js). Never applied until confirmed.
    pendingEmail: { type: String, select: false, default: null },
    pendingEmailCode: { type: String, select: false, default: null },
    pendingEmailCodeExpiresAt: { type: Date, select: false, default: null },
    pendingContactNumber: { type: String, select: false, default: null },
    pendingContactNumberCode: { type: String, select: false, default: null },
    pendingContactNumberCodeExpiresAt: { type: Date, select: false, default: null },
    // Self-service "change password" (trainee/officer mobile app only) — the
    // new password is hashed immediately and held here, never in plaintext,
    // until the emailed code confirms it (see controllers/accountController.js).
    pendingPasswordHash: { type: String, select: false, default: null },
    pendingPasswordCode: { type: String, select: false, default: null },
    pendingPasswordCodeExpiresAt: { type: Date, select: false, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

userSchema.index({ studentId: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

const SENSITIVE_FIELDS = [
  'password',
  'twoFactorCode',
  'twoFactorCodeExpiresAt',
  'pendingEmail',
  'pendingEmailCode',
  'pendingEmailCodeExpiresAt',
  'pendingContactNumber',
  'pendingContactNumberCode',
  'pendingContactNumberCodeExpiresAt',
  'pendingPasswordHash',
  'pendingPasswordCode',
  'pendingPasswordCodeExpiresAt',
];

userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ versionKey: false });
  // select: false only hides these on a fresh query — a document just
  // created/modified in this same request still carries them in memory, so
  // strip them explicitly rather than relying on the schema option alone.
  SENSITIVE_FIELDS.forEach((field) => delete obj[field]);
  return obj;
};

module.exports = mongoose.model('User', userSchema);
