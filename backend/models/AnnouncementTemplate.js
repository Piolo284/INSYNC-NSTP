const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

/**
 * Which announcement fields the auto-generation step can place onto a
 * template — kept in one place so the admin designer UI and the actual
 * generation logic (see admin/src/utils/announcementGenerator.js, which
 * composites this via canvas) always agree on the same key set. Mirrors
 * CertificateTemplate.CERTIFICATE_FIELD_KEYS' pattern exactly.
 */
const ANNOUNCEMENT_FIELD_KEYS = ['title', 'content', 'date', 'time', 'location', 'postedBy'];

const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ANNOUNCEMENT_FIELD_KEYS, required: true },
    // Position as a percentage of the template image's natural width/height
    // (0-100) — resolution-independent, so the layout survives re-rendering
    // at any display size.
    x: { type: Number, required: true, min: 0, max: 100 },
    y: { type: Number, required: true, min: 0, max: 100 },
    fontSize: { type: Number, default: 24 },
    color: { type: String, default: '#000000' },
    fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  },
  { _id: false }
);

/**
 * One sample announcement poster design per program — an admin uploads a
 * branded background image and marks where each announcement detail goes;
 * posting a new announcement composites that announcement's own title/
 * content/date/etc. onto this layout client-side (see
 * admin/src/utils/announcementGenerator.js) instead of requiring a manually
 * designed image every time. Mirrors CertificateTemplate exactly.
 */
const announcementTemplateSchema = new mongoose.Schema(
  {
    program: { type: String, enum: PROGRAMS, required: true, unique: true, index: true },
    imageUrl: { type: String, default: '' },
    imageName: { type: String, default: '' },
    imageWidth: { type: Number, default: 0 },
    imageHeight: { type: Number, default: 0 },
    fields: { type: [fieldSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AnnouncementTemplate', announcementTemplateSchema);
module.exports.ANNOUNCEMENT_FIELD_KEYS = ANNOUNCEMENT_FIELD_KEYS;
