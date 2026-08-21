const mongoose = require('mongoose');
const { PROGRAMS, SESSION_STATUSES } = require('../config/constants');

/**
 * Created by the "Create QR Code" officer flow. `sessionCode` is exactly what
 * gets encoded in the QR image and what the trainee scanner posts back.
 */
const attendanceSessionSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    brigade: { type: String, default: '' },
    title: { type: String, default: '' },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true }, // "08:30"
    /** ISO instants derived from date + start/end time; used for validity checks. */
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    sessionCode: { type: String, required: true, unique: true, index: true },
    notes: { type: String, default: '' },
    status: { type: String, enum: SESSION_STATUSES, default: 'Active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSessionSchema.methods.isOpenAt = function isOpenAt(when = new Date()) {
  return this.status === 'Active' && when >= this.startsAt && when <= this.endsAt;
};

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
