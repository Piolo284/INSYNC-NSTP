const mongoose = require('mongoose');
const { PROGRAMS, TARGET_AUDIENCES } = require('../config/constants');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    program: { type: String, enum: [...PROGRAMS, 'All'], default: 'All', index: true },
    targetAudience: { type: String, enum: TARGET_AUDIENCES, default: 'All' },
    /** When set, only these users receive it (the "send to selected users" flow). */
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    date: { type: Date, default: Date.now, index: true },
    time: { type: String, default: '' },
    location: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Published', 'Draft', 'Archived'],
      default: 'Published',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

announcementSchema.index({ program: 1, isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
