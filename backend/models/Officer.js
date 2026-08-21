const mongoose = require('mongoose');
const { PROGRAMS, USER_STATUSES } = require('../config/constants');

const officerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    officerId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    position: { type: String, trim: true, default: 'Officer' },
    brigade: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Officer', officerSchema);
