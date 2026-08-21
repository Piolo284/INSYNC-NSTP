const mongoose = require('mongoose');
const { USER_STATUSES, SPECIAL_CATEGORIES } = require('../config/constants');

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
    platoon: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    brigade: { type: String, trim: true, default: '' },
    yearLevel: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    // Collected on the "Additional Information" registration step — drives
    // which requirement documents the cadet is asked to submit.
    specialCategory: { type: String, enum: SPECIAL_CATEGORIES, default: 'None' },
    status: { type: String, enum: USER_STATUSES, default: 'Active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cadet', cadetSchema);
