const mongoose = require('mongoose');
const { TRAINEE_STATUSES, SPECIAL_CATEGORIES, CAMPUSES } = require('../config/constants');

const cadetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cadetId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    program: { type: String, enum: ['ROTC'], default: 'ROTC' },
    course: { type: String, trim: true, default: '' },
    // Source of truth for brigade assignment — resolved from `course` via
    // utils/brigadeAssignment.js. `course`/`brigade` strings stay in sync as
    // a denormalized display cache for existing read paths.
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    platoon: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    brigade: { type: String, trim: true, default: '' },
    yearLevel: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    // MARSU campus the cadet is enrolled at, collected at registration.
    campus: { type: String, enum: CAMPUSES, default: null },
    contactNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    // Collected on the "Additional Information" registration step — drives
    // which requirement documents the cadet is asked to submit.
    specialCategory: { type: String, enum: SPECIAL_CATEGORIES, default: 'None' },
    status: { type: String, enum: TRAINEE_STATUSES, default: 'Active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cadet', cadetSchema);
