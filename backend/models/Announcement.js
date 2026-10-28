const mongoose = require('mongoose');
const {
  PROGRAMS,
  TARGET_AUDIENCES,
  CAMPUSES,
  ANNOUNCEMENT_LINK_TYPES,
} = require('../config/constants');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    program: { type: String, enum: [...PROGRAMS, 'All'], default: 'All', index: true },
    targetAudience: { type: String, enum: TARGET_AUDIENCES, default: 'All' },
    /** 'All' reaches every campus; a specific value narrows it to just that
     * one (matched against the trainee's own User.campus in list()). */
    campus: { type: String, enum: [...CAMPUSES, 'All'], default: 'All', index: true },
    /** When set, only these users receive it (the "send to selected users" flow). */
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    date: { type: Date, default: Date.now, index: true },
    time: { type: String, default: '' },
    location: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
    /** Optional deep link — tapping the announcement in the app opens this
     * item (quiz/assignment/module, activity, or attendance) directly. Set
     * automatically when a module or activity is posted. */
    linkType: { type: String, enum: ['', ...ANNOUNCEMENT_LINK_TYPES], default: '' },
    linkId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    /** What the link opens, for the app's button text: 'Quiz', 'Assignment',
     * 'Module', 'Activity' or 'Attendance'. */
    linkLabel: { type: String, default: '' },
    // Auto-composed from this program's AnnouncementTemplate (if one exists)
    // at post time, or left blank if no template is configured — see
    // admin/src/utils/announcementGenerator.js.
    imageUrl: { type: String, default: '' },
    imageName: { type: String, default: '' },
    /** Optional — once past, the announcement stops appearing in list()
     * immediately and MongoDB's TTL monitor purges the document itself
     * within about a minute (no cron/scheduler needed). Left null, an
     * announcement never expires. */
    expiresAt: { type: Date, default: null },
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
// TTL index — MongoDB deletes the document once `expiresAt` is in the past;
// documents with expiresAt: null are never matched, so they never expire.
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Announcement', announcementSchema);
