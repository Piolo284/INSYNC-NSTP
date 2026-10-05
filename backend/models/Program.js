const mongoose = require('mongoose');
const { PROGRAMS, CAMPUSES } = require('../config/constants');

/**
 * A college course/degree program (BSIT, BSED, ...) scoped to one NSTP
 * program (CWTS or ROTC). This is the single source of truth `course` used
 * to be free-typed text against — every student's brigade is now derived by
 * matching their typed/selected course against `name`/`code` here, instead
 * of being assigned by hand. See `utils/brigadeAssignment.js`.
 */
const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "BS Information Technology"
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "BSIT"
    nstpProgram: { type: String, enum: PROGRAMS, required: true, index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    // One brigade per program (enforced by the unique index on Brigade.programId).
    brigadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brigade', default: null },
    // Set when every trainee in this program is only ever at one physical
    // campus (e.g. a college that's only offered at one MARSU campus) — a
    // trainee's own `campus` is then auto-derived from this instead of typed
    // by hand at registration. Left null for a program with no such fixed
    // campus (e.g. most ROTC courses, offered across several campuses), in
    // which case the trainee still picks their campus manually. See
    // `applyBrigadeFields` in `utils/brigadeAssignment.js`.
    campus: { type: String, enum: CAMPUSES, default: null },
  },
  { timestamps: true }
);

programSchema.index({ code: 1, nstpProgram: 1 }, { unique: true });

module.exports = mongoose.model('Program', programSchema);
