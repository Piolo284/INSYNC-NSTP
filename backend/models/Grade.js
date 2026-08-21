const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

const scoreLineSchema = new mongoose.Schema(
  {
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, default: '' },
    score: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
  },
  { _id: false }
);

const gradeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    moduleScores: { type: [scoreLineSchema], default: [] },
    activityScores: { type: [scoreLineSchema], default: [] },
    attendanceScore: { type: Number, default: 0 },
    attendanceSummary: {
      present: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      excused: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    totalScore: { type: Number, default: 0 },
    finalGrade: { type: Number, default: 0 },
    remarks: {
      type: String,
      enum: ['Passed', 'Warning', 'Failed', 'Incomplete'],
      default: 'Incomplete',
    },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

gradeSchema.index({ studentId: 1, program: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
