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
    // Snapshotted at creation time (from the session, or the recording
    // officer for manual marks) — never rewritten if the student's own
    // brigade later changes, so historical records stay accurate to when
    // they actually happened.
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    title: { type: String, default: '' },
    date: { type: Date, required: true, index: true },
    time: { type: String, default: '' }, // "10:20 AM" — check-in time
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: 'Present',
      index: true,
    },
    attendanceMethod: { type: String, enum: ATTENDANCE_METHODS, default: 'QR' },
    verificationCode: { type: String, default: null, select: false },
    verificationExpiresAt: { type: Date, default: null },
    verificationAttempts: { type: Number, default: 0, select: false },
    verified: { type: Boolean, default: false },
    // Check-out side of the same day's attendance — set once the trainee (or
    // officer, manually) checks out. Left null means "checked in but never
    // checked out", which is what makes closeSession()/finalizeDay() flip
    // this row to Absent once the officer finalizes the day.
    checkOutTime: { type: String, default: '' },
    checkOutAt: { type: Date, default: null },
    outSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
    },
    checkOutVerificationCode: { type: String, default: null, select: false },
    checkOutVerificationExpiresAt: { type: Date, default: null },
    checkOutVerificationAttempts: { type: Number, default: 0, select: false },
    remarks: { type: String, default: '' },
    // True for an Absent row the system wrote on its own because the trainee
    // never scanned before the session's end time (utils/attendanceSweep.js).
    // While the officer still leaves that session open, a later scan replaces
    // it under the normal late policy instead of being blocked as a duplicate.
    autoAbsent: { type: Boolean, default: false },
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
