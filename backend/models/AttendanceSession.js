const mongoose = require('mongoose');
const { PROGRAMS, SESSION_STATUSES, SESSION_CHECK_TYPES } = require('../config/constants');

/**
 * Created by the "Create QR Code" officer flow. `sessionCode` is exactly what
 * gets encoded in the QR image and what the trainee scanner posts back.
 */
const attendanceSessionSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    // Auto-set to the creating officer's brigade — this is what a scanning
    // trainee's own brigade is checked against (see attendanceController.scan).
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    brigade: { type: String, default: '' },
    // Optional further narrowing within the brigade — a ROTC platoon name
    // (matched against the scanning cadet's Cadet.platoon) or a CWTS
    // section/task-force label (matched against the scanning student's own
    // User.section). Left blank (the default), a session is open to the
    // whole brigade exactly as it always was.
    subgroup: { type: String, trim: true, default: '' },
    // Opt-in: when true, scanning is rejected once `endsAt` passes instead of
    // staying open until the officer manually closes the session. Defaults
    // to false so every session created before this existed keeps behaving
    // exactly as before.
    autoCloseAtEnd: { type: Boolean, default: false },
    // Mirrors Activity.isSpecialClass when this session is for the ROTC
    // Special Class track — its roster is every eligible cadet ROTC-wide
    // (by specialCategory), not by brigadeId. See attendanceController.
    isSpecialClass: { type: Boolean, default: false, index: true },
    title: { type: String, default: '' },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true }, // "08:30"
    /** ISO instants derived from date + start/end time; used for validity checks. */
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    sessionCode: { type: String, required: true, unique: true, index: true },
    // Whether this QR checks trainees IN or OUT. Defaults to 'IN' so every
    // session created before this existed keeps behaving exactly as before —
    // a lone check-in session with no OUT counterpart never requires one.
    checkType: { type: String, enum: SESSION_CHECK_TYPES, default: 'IN' },
    // Only set (and only meaningful) when checkType is 'OUT' — the IN session
    // this one closes out. Closing an OUT session marks Absent anyone who
    // has an Attendance row for pairedSessionId but never checked out here.
    pairedSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
    },
    notes: { type: String, default: '' },
    status: { type: String, enum: SESSION_STATUSES, default: 'Active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// A session accepts scans for as long as it's Active and has started — there
// is no upper time bound here, since the officer closing it (not the
// scheduled endsAt) is what actually cuts scanning off.
attendanceSessionSchema.methods.isOpenAt = function isOpenAt(when = new Date()) {
  if (this.autoCloseAtEnd && when > this.endsAt) return false;
  return this.status === 'Active' && when >= this.startsAt;
};

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
