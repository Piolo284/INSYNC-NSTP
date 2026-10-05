const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

/**
 * Which trainee/request fields the auto-generation step can place onto a
 * template — kept in one place so the admin designer UI and the actual
 * generation logic (see utils/certificateGenerator on the frontend, which
 * composites this via canvas) always agree on the same key set.
 */
const CERTIFICATE_FIELD_KEYS = [
  'studentName',
  'studentId',
  'program',
  'course',
  'yearLevel',
  'sectionOrCompany',
  'campus',
  'certificateType',
  'purpose',
  'dateIssued',
];

const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: CERTIFICATE_FIELD_KEYS, required: true },
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
 * One sample certificate design per program — the NSTP Head uploads a
 * template image and marks where each trainee detail goes; approving a
 * certificate request composites the real trainee's data onto this layout
 * client-side (see admin/src/utils/certificateGenerator.js) instead of
 * requiring a manually-attached file.
 */
const certificateTemplateSchema = new mongoose.Schema(
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

module.exports = mongoose.model('CertificateTemplate', certificateTemplateSchema);
module.exports.CERTIFICATE_FIELD_KEYS = CERTIFICATE_FIELD_KEYS;
