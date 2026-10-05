const mongoose = require('mongoose');
const { PROGRAMS } = require('../config/constants');

/**
 * The operational unit officers and students actually belong to. Strictly
 * one-per-Program (see the unique index on `programId`) — a program never
 * splits across two brigades, and a brigade is never shared by two programs.
 * `nstpProgram` is denormalized from the owning Program purely so brigade
 * lists can be filtered/queried without a join.
 */
const brigadeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Brigade Makakalikasan"
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      unique: true,
    },
    nstpProgram: { type: String, enum: PROGRAMS, required: true, index: true },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Brigade', brigadeSchema);
