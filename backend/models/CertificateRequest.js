const mongoose = require('mongoose');
const { PROGRAMS, CERTIFICATE_STATUSES } = require('../config/constants');

/**
 * A trainee's request for the office to issue a certificate (e.g.
 * Certificate of Completion). Reviewed by program staff, who may attach the
 * signed certificate file when approving.
 */
const certificateRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null, index: true },
    type: { type: String, required: true, trim: true },
    purpose: { type: String, default: '', trim: true },
    status: { type: String, enum: CERTIFICATE_STATUSES, default: 'Pending', index: true },
    certificateUrl: { type: String, default: '' },
    certificateName: { type: String, default: '' },
    certificateSize: { type: Number, default: 0 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One PENDING request per (trainee, certificate type) at a time — a trainee
// may request again after a Rejected decision, but can't stack duplicates.
certificateRequestSchema.index(
  { studentId: 1, type: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

module.exports = mongoose.model('CertificateRequest', certificateRequestSchema);
