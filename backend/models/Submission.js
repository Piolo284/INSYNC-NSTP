const mongoose = require('mongoose');
const { SUBMISSION_STATUSES } = require('../config/constants');

const rubricScoreSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    points: { type: Number, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      default: null,
      index: true,
    },
    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Activity',
      default: null,
      index: true,
    },
    /** User document of the trainee/cadet who submitted. */
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    comment: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: 'Submitted',
      index: true,
    },
    score: { type: Number, default: null },
    totalPoints: { type: Number, default: 100 },
    rubricScores: { type: [rubricScoreSchema], default: [] },
    feedback: { type: String, default: '' },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One submission per trainee per module (re-submitting updates the same row).
submissionSchema.index(
  { moduleId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { moduleId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Submission', submissionSchema);
