const mongoose = require('mongoose');
const { PROGRAMS, USER_STATUSES } = require('../config/constants');

const instructorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    department: { type: String, trim: true, default: 'NSTP Office' },
    /** Sections handled, e.g. ["CWTS 1 - A", "CWTS 1 - B"]. */
    sections: { type: [String], default: [] },
    contactNumber: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Instructor', instructorSchema);
