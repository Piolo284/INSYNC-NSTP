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
    // Admin-assigned (not derived) — determines which brigade's students,
    // attendance, activities, and submissions this officer may manage. See
    // utils/brigadeScope.js.
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    brigade: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    status: { type: String, enum: USER_STATUSES, default: 'Active' },
    // Admin_rotc-assigned — at most one ROTC officer holds this at a time
    // (enforced in officerController.assignSpecialClass, not a schema
    // constraint). That officer handles every PWD/Medical-Condition cadet
    // ROTC-wide, regardless of the cadet's own brigade. See utils/specialClass.js.
    isSpecialClassOfficer: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Officer', officerSchema);
