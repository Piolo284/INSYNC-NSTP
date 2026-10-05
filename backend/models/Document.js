const mongoose = require('mongoose');

/** Backs the trainee "Documents" screen (uploaded + pending requirements). */
const documentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    isUploaded: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Uploaded', 'Under Review', 'Awaiting Approval', 'Approved', 'Rejected', 'Missing'],
      default: 'Missing',
    },
    uploadedAt: { type: Date, default: null },
    // Who approved/rejected it — lets an admin see which officer reviewed a
    // given requirement instead of only the resulting status.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
