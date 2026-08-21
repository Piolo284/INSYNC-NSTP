const mongoose = require('mongoose');
const { USER_STATUSES } = require('../config/constants');

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
    yearLevel: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    brigade: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
