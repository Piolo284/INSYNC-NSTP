const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');
const { gradePointFrom } = require('../utils/gradeScale');

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
      enum: ['Passed', 'Failed', 'Incomplete'],
      default: 'Incomplete',
    },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

gradeSchema.index({ studentId: 1, program: 1 }, { unique: true });

/**
 * College grading scale (1.00 highest, 5.00 lowest) equivalent of finalGrade.
 * Derived on the fly instead of stored, so it can never drift out of sync
 * with finalGrade for a document that hasn't been recalculated recently.
 */
gradeSchema.virtual('gradePoint').get(function () {
  return gradePointFrom(this.finalGrade);
});

module.exports = mongoose.model('Grade', gradeSchema);
