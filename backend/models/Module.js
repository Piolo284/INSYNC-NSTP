const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

const rubricSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    points: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * A Module is both the learning material shown in the "Modules" tab and the
 * graded task shown in the "Activities" tab of the trainee app. `deadline`
 * is what makes a module appear as a to-do item; `rubrics` drive the officer
 * grading screen (which already totals rubric points into a final grade).
 */
const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    /** Class/section code shown in the officer submissions filter, e.g. "CWTS - A". */
    moduleCode: { type: String, default: '', index: true },
    section: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    instructions: { type: [String], default: [] },
    deadline: { type: Date, default: null, index: true },
    totalPoints: { type: Number, default: 100 },
    rubrics: { type: [rubricSchema], default: [] },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Completed', 'Archived'],
      default: 'Open',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

moduleSchema.index({ program: 1, createdAt: -1 });

module.exports = mongoose.model('Module', moduleSchema);
