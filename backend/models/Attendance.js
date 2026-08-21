const mongoose = require('mongoose');
const {
  PROGRAMS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS,
} = require('../config/constants');

/**
 * One row per trainee/cadet per session. `studentId` points at the User
 * document, so the same collection serves both CWTS students and ROTC cadets.
 */
const attendanceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
      index: true,
    },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    title: { type: String, default: '' },
    date: { type: Date, required: true, index: true },
    time: { type: String, default: '' }, // "10:20 AM"
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: 'Present',
      index: true,
    },
    attendanceMethod: { type: String, enum: ATTENDANCE_METHODS, default: 'QR' },
    verificationCode: { type: String, default: null, select: false },
    verificationExpiresAt: { type: Date, default: null },
    verified: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// One attendance record per trainee per session — this is what makes duplicate
// QR scans impossible even under concurrent requests.
attendanceSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
