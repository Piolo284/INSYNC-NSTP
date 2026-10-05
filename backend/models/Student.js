const mongoose = require('mongoose');
const { TRAINEE_STATUSES, SPECIAL_CATEGORIES, CAMPUSES } = require('../config/constants');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    studentId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    program: { type: String, enum: ['CWTS'], default: 'CWTS' },
    course: { type: String, trim: true, default: '' }, // e.g. BSIT
    // Source of truth for brigade assignment — resolved from `course` via
    // utils/brigadeAssignment.js. `course`/`brigade` strings stay in sync as
    // a denormalized display cache for existing read paths.
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    yearLevel: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    brigade: { type: String, trim: true, default: '' },
    // MARSU campus the trainee is enrolled at, collected at registration.
    campus: { type: String, enum: CAMPUSES, default: null },
    contactNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    // Collected on the "Additional Information" registration step — drives
    // which requirement documents the trainee is asked to submit.
    specialCategory: { type: String, enum: SPECIAL_CATEGORIES, default: 'None' },
    status: { type: String, enum: TRAINEE_STATUSES, default: 'Active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
