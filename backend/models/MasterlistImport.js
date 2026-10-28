const mongoose = require('mongoose');

const MASTERLIST_IMPORT_STATUSES = ['Pending', 'Processing', 'Completed', 'Cancelled', 'Failed'];

/** One parsed, validated roster row waiting for the admin to confirm. */
const pendingRowSchema = new mongoose.Schema(
  {
    rowNumber: Number,
    studentNumber: String,
    fullName: String,
    email: String,
    courseProgram: String,
    campus: String,
    academicYear: String,
  },
  { _id: false }
);

const invalidRowSchema = new mongoose.Schema(
  {
    rowNumber: Number,
    studentNumber: { type: String, default: '' },
    fullName: { type: String, default: '' },
    reason: String,
  },
  { _id: false }
);

/**
 * One Master List file uploaded by the system_maintenance_admin — both the
 * import history and the staging area for the preview -> confirm flow
 * (controllers/masterlistController.js). An upload first lands here as
 * `Pending` with its validated rows in `rows`; confirming applies them to the
 * `masterlist` collection, marks this import `Completed` + `isCurrent`, and
 * drops `rows` (the applied data lives in the masterlist itself).
 *
 * Exactly one Completed import is `isCurrent` — the latest valid Master List.
 */
const masterlistImportSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, enum: ['csv', 'xlsx'], required: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: MASTERLIST_IMPORT_STATUSES, default: 'Pending', index: true },
    isCurrent: { type: Boolean, default: false, index: true },
    counts: {
      totalRows: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      invalid: { type: Number, default: 0 },
      added: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      unchanged: { type: Number, default: 0 },
      // On the previous current list but not in this file — flagged
      // "Not in current list", never deleted.
      notInList: { type: Number, default: 0 },
    },
    rows: { type: [pendingRowSchema], default: [], select: false },
    invalidRows: { type: [invalidRowSchema], default: [] },
    confirmedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

masterlistImportSchema.index({ createdAt: -1 });

const MasterlistImport = mongoose.model('MasterlistImport', masterlistImportSchema);
MasterlistImport.STATUSES = MASTERLIST_IMPORT_STATUSES;

module.exports = MasterlistImport;
