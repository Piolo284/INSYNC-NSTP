const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, PROGRAMS, USER_STATUSES } = require('../config/constants');

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
    yearLevel: { type: String, trim: true },
    section: { type: String, trim: true },
    profileImage: { type: String, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active', index: true },
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

userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
