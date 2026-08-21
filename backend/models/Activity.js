const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

/**
 * An Activity is a real-world event (seminar, clean-up, drill) that officers
 * create, students attend, and attendance sessions attach to.
 */
const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, default: '' }, // "08:00"
    endTime: { type: String, default: '' }, // "11:30"
    location: { type: String, default: '' },
    image: { type: String, default: '' },
    photos: { type: [String], default: [] },
    objectives: { type: [String], default: [] },
    brigade: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'],
      default: 'Upcoming',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

activitySchema.index({ program: 1, date: -1 });

module.exports = mongoose.model('Activity', activitySchema);
