const Program = require('../models/Program');
const User = require('../models/User');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The single place a student/cadet's brigade gets decided. Matches the
 * typed/selected course against an active Program's `name` or `code`
 * (case-insensitive) scoped to the trainee's NSTP program, and returns the
 * paired Program + Brigade — or null if the course doesn't map to any
 * configured program yet (the trainee is still created; an admin can
 * configure the missing program later and re-save the record to pick it up).
 */
async function resolveBrigadeForCourse(courseInput, nstpProgram) {
  const raw = String(courseInput || '').trim();
  if (!raw) return null;

  const rx = new RegExp(`^${escapeRegex(raw)}$`, 'i');
  const program = await Program.findOne({
    nstpProgram,
    status: 'Active',
    $or: [{ name: rx }, { code: rx }],
  }).populate('brigadeId');

  if (!program || !program.brigadeId) return null;
  return { program, brigade: program.brigadeId };
}

/**
 * Writes the resolved program/brigade (or clears them, if `resolved` is
 * null) onto a Student/Cadet-shaped plain object, keeping the denormalized
 * `course`/`brigade` display strings in sync with the canonical `programId`/
 * `brigadeId` refs. Does not save — caller owns persistence.
 *
 * Also mirrors the brigade name onto `company` (ROTC's own name for the
 * same grouping — every roster/admin screen displays a cadet's `company`,
 * not `brigade`) whenever the caller hasn't already put a value there, so a
 * cadet's course always maps to a visible company regardless of how mixed
 * their cohort's courses are or whether they're on the Special Class track.
 * A caller that wants a custom company label can still set `target.company`
 * before calling this — an existing non-empty value is left alone.
 *
 * When the resolved Program has its own fixed `campus` (see models/
 * Program.js — some colleges are only offered at one MARSU campus),
 * `target.campus` is overwritten with it, taking priority over whatever the
 * trainee typed/picked — the whole point being campus is no longer a free
 * choice for that program. A program with no fixed campus (most ROTC
 * courses) leaves `target.campus` exactly as the caller set it.
 *
 * Pass `{ assignBrigade: false }` to apply only the program/campus side and
 * leave brigade/company untouched — ROTC cadets don't get a company from
 * their course; they get their handling officer's company when that officer
 * adds them (see assignCadetToBrigade below).
 */
function applyBrigadeFields(target, resolved, { assignBrigade = true } = {}) {
  if (resolved) {
    target.programId = resolved.program._id;
    if (assignBrigade) {
      target.brigadeId = resolved.brigade._id;
      target.brigade = resolved.brigade.name;
      if (!target.company) target.company = resolved.brigade.name;
    }
    if (resolved.program.campus) target.campus = resolved.program.campus;
  } else {
    target.programId = null;
    if (assignBrigade) {
      target.brigadeId = null;
      target.brigade = '';
    }
  }
  return target;
}

/**
 * Puts a ROTC cadet under an officer's company: copies the officer's brigade
 * onto the cadet (brigadeId/brigade/company) and its User, so every
 * brigade-scoped screen (roster, attendance, grades) picks the cadet up.
 * Does not save the cadet — caller owns persistence.
 */
async function assignCadetToBrigade(cadet, brigade) {
  cadet.brigadeId = brigade._id;
  cadet.brigade = brigade.name;
  cadet.company = brigade.name;
  await User.findByIdAndUpdate(cadet.userId?._id || cadet.userId, { brigadeId: brigade._id });
  return cadet;
}

module.exports = { resolveBrigadeForCourse, applyBrigadeFields, assignCadetToBrigade };
