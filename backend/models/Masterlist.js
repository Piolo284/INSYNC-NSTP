const mongoose = require('mongoose');

/**
 * The official roster of students enrolled in NSTP this term, imported from
 * a registrar CSV export by an admin. One shared list — a real NSTP
 * enrollee picks CWTS or ROTC on the app's first screen, but the registrar
 * doesn't pre-split the roster by component, so the same entry here is
 * checked no matter which program the trainee registers under (see
 * authController.register / utils/masterlistMatch.js). A trainee is only
 * allowed to self-register when their Student Number, Full Name, and
 * Course/Program all match a row here.
 *
 * Every field below is required — Name, Student ID, Email, Course, Campus,
 * and Year must all be present for a row to be on the masterlist
 * at all; controllers/masterlistController.js enforces this at upload time
 * by skipping any row missing even one of them, and this schema backs that
 * up for the single-entry `create` path too. There is deliberately no
 * enrollment-status field — every row on the current list is simply
 * enrolled. Rows a newer import leaves out are kept with `inCurrentList:
 * false` (see models/MasterlistImport.js) rather than deleted.
 */
const masterlistSchema = new mongoose.Schema(
  {
    studentNumber: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    courseProgram: { type: String, required: true, trim: true },
    // Free text, not enum-restricted — a registrar export's exact campus
    // spelling won't always match the app's own CAMPUSES list verbatim, and
    // the rule here is presence, not matching that specific format.
    campus: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Legacy: older imports set this to false for students missing from a
    // newer file (new self-registration refused). Imports no longer do that;
    // re-importing or editing the student sets it back to true. Missing
    // counts as true (queries use `$ne: false`).
    inCurrentList: { type: Boolean, default: true, index: true },
    lastImportId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterlistImport', default: null },
    removedFromListAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'masterlist' }
);

module.exports = mongoose.model('Masterlist', masterlistSchema);
