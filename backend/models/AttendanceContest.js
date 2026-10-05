const mongoose = require('mongoose');
const { PROGRAMS, CONTEST_STATUSES } = require('../config/constants');

/**
 * A trainee's dispute of one Absent attendance record. Kept as its own
 * collection (not a sub-document on Attendance) so the officer-side review
 * list/queries are simple and so `program`/`brigadeId` can be denormalized
 * for the same scopeFilterToProgram/scopeFilterToBrigade pattern used
 * everywhere else.
 */
const attendanceContestSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    reason: { type: String, required: true, trim: true },
    attachmentUrl: { type: String, default: '' },
    attachmentName: { type: String, default: '' },
    attachmentSize: { type: Number, default: 0 },
    status: { type: String, enum: CONTEST_STATUSES, default: 'Pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One PENDING contest per attendance record at a time — a trainee may file
// again after a Rejected decision (e.g. with better evidence), but can't
// stack multiple pending disputes on the same record.
attendanceContestSchema.index(
  { attendanceId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

module.exports = mongoose.model('AttendanceContest', attendanceContestSchema);
