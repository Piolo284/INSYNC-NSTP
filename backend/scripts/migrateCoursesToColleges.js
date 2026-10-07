/* eslint-disable no-console */
/**
 * One-time migration: course-level programs → the official college list
 * (config/colleges.js). Keeps every account, attendance record and grade.
 *
 *  - Programs: replaced by one CWTS program per college (campus-fixed) and
 *    one ROTC program per college at an ROTC campus.
 *  - CWTS brigades: one per college. The course brigades of a college are
 *    merged into the first one; students, attendance and sessions move with
 *    them, and same-day sessions of the merged brigades become one session.
 *  - ROTC companies: unchanged (cadets keep company/platoon), re-paired to
 *    college programs.
 *  - Students, cadets, users and the masterlist: `course` → college name.
 *
 * Usage (from backend/):  node scripts/migrateCoursesToColleges.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Manila';
const { connectDatabase } = require('../config/database');
const { COLLEGES, collegeFor } = require('../config/colleges');
const { ROTC_RESTRICTED_CAMPUSES } = require('../config/constants');
const Program = require('../models/Program');
const Brigade = require('../models/Brigade');
const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const Masterlist = require('../models/Masterlist');
const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');

async function main() {
  await connectDatabase();
  const oldPrograms = await Program.find({});
  const oldProgramIds = oldPrograms.map((p) => p._id);
  const unknown = [
    ...new Set([
      ...oldPrograms.map((p) => p.name),
      ...(await Masterlist.distinct('courseProgram')),
      ...(await Student.distinct('course')),
      ...(await Cadet.distinct('course')),
    ]),
  ].filter((name) => name && !collegeFor(name));
  if (unknown.length) throw new Error(`No college mapping for: ${unknown.join(', ')}`);

  // ---- CWTS: college programs + merged brigades ----
  const cwtsByCollege = {};
  for (const college of COLLEGES) {
    const program = await Program.create({
      name: college.name, code: college.code, nstpProgram: 'CWTS', campus: college.campus, status: 'Active',
    }).catch(async (err) => {
      if (err.code !== 11000) throw err; // already migrated earlier → reuse
      return Program.findOne({ code: college.code, nstpProgram: 'CWTS' });
    });
    // Brigades currently paired with this college's course programs.
    const coursePrograms = oldPrograms.filter((p) => p.nstpProgram === 'CWTS' && collegeFor(p.name)?.code === college.code);
    const brigades = await Brigade.find({ _id: { $in: coursePrograms.map((p) => p.brigadeId).filter(Boolean) } }).sort({ createdAt: 1 });
    let keep = brigades[0] || (program.brigadeId ? await Brigade.findById(program.brigadeId) : null);
    if (!keep) keep = await Brigade.create({ name: `Brigade ${college.code}`, programId: program._id, nstpProgram: 'CWTS', status: 'Active' });
    const merged = brigades.slice(1);
    cwtsByCollege[college.code] = { program, brigade: keep, merged };
  }

  // Re-pair every kept CWTS brigade to its college program (programId is unique,
  // so detach first).
  for (const { program, brigade } of Object.values(cwtsByCollege)) {
    await Brigade.updateOne({ _id: brigade._id }, { $set: { programId: program._id } });
    program.brigadeId = brigade._id;
    await program.save();
  }

  // Move everything from merged brigades into the kept one.
  for (const { brigade, merged } of Object.values(cwtsByCollege)) {
    const mergedIds = merged.map((b) => b._id);
    if (!mergedIds.length) continue;
    await User.updateMany({ brigadeId: { $in: mergedIds } }, { $set: { brigadeId: brigade._id } });
    await Student.updateMany({ brigadeId: { $in: mergedIds } }, { $set: { brigadeId: brigade._id, brigade: brigade.name } });
    await Officer.updateMany({ brigadeId: { $in: mergedIds } }, { $set: { brigadeId: brigade._id, brigade: brigade.name } });
    await Attendance.updateMany({ brigadeId: { $in: mergedIds } }, { $set: { brigadeId: brigade._id } });
    await AttendanceSession.updateMany({ brigadeId: { $in: mergedIds } }, { $set: { brigadeId: brigade._id, brigade: brigade.name } });
    await Brigade.deleteMany({ _id: { $in: mergedIds } });
  }

  // One session per brigade per day+time: fold duplicates (from merged
  // brigades) into the first, moving their attendance rows over.
  let foldedSessions = 0;
  for (const { brigade } of Object.values(cwtsByCollege)) {
    const sessions = await AttendanceSession.find({ brigadeId: brigade._id }).sort({ createdAt: 1 });
    const byKey = new Map();
    for (const s of sessions) {
      const key = `${s.date.toISOString()}|${s.startTime}|${s.endTime}|${s.checkType}|${s.subgroup || ''}`;
      const first = byKey.get(key);
      if (!first) {
        byKey.set(key, s);
        if (/ — CWTS Training Day \d+$/.test(s.title)) {
          s.title = s.title.replace(/^.* — /, `${brigade.name} — `);
          s.brigade = brigade.name;
          await s.save();
        }
        continue;
      }
      await Attendance.updateMany({ sessionId: s._id }, { $set: { sessionId: first._id, title: first.title } });
      await AttendanceSession.deleteOne({ _id: s._id });
      foldedSessions += 1;
    }
    await Attendance.updateMany(
      { brigadeId: brigade._id, title: / — CWTS Training Day \d+$/ },
      [{ $set: { title: { $concat: [brigade.name, ' — CWTS Training Day ', { $arrayElemAt: [{ $split: ['$title', 'Day '] }, 1] }] } } }]
    );
  }

  // ---- ROTC: college programs, companies re-paired ----
  const rotcByCollege = {};
  const rotcColleges = COLLEGES.filter((c) => !ROTC_RESTRICTED_CAMPUSES.includes(c.campus));
  for (const college of rotcColleges) {
    rotcByCollege[college.code] = await Program.create({
      name: college.name, code: college.code, nstpProgram: 'ROTC', campus: null, status: 'Active',
    }).catch(async (err) => {
      if (err.code !== 11000) throw err;
      return Program.findOne({ code: college.code, nstpProgram: 'ROTC' });
    });
  }
  const companies = await Brigade.find({ nstpProgram: 'ROTC' }).sort({ name: 1 });
  const rotcPrograms = Object.values(rotcByCollege);
  for (const [i, company] of companies.entries()) {
    const program = rotcPrograms[i];
    if (!program) break;
    await Brigade.updateOne({ _id: company._id }, { $set: { programId: program._id } });
    program.brigadeId = company._id;
    await program.save();
  }

  // ---- Records: course → college ----
  let students = 0;
  for (const s of await Student.find({})) {
    const college = collegeFor(s.course);
    const { program, brigade } = cwtsByCollege[college.code];
    s.course = college.name;
    s.programId = program._id;
    s.brigadeId = brigade._id;
    s.brigade = brigade.name;
    s.campus = college.campus;
    await s.save();
    await User.updateOne({ _id: s.userId }, { $set: { programId: program._id, brigadeId: brigade._id, campus: college.campus } });
    students += 1;
  }
  let cadets = 0;
  for (const c of await Cadet.find({})) {
    const college = collegeFor(c.course);
    const program = rotcByCollege[college.code];
    c.course = college.name;
    c.programId = program ? program._id : null;
    await c.save();
    await User.updateOne({ _id: c.userId }, { $set: { programId: c.programId } });
    cadets += 1;
  }
  let masterRows = 0;
  for (const m of await Masterlist.find({})) {
    const college = collegeFor(m.courseProgram);
    if (m.courseProgram !== college.name) {
      m.courseProgram = college.name;
      await m.save();
      masterRows += 1;
    }
  }

  // ---- Old course-level programs ----
  const keepIds = new Set([...Object.values(cwtsByCollege).map((x) => String(x.program._id)), ...rotcPrograms.map((p) => String(p._id))]);
  const removed = await Program.deleteMany({ _id: { $in: oldProgramIds.filter((id) => !keepIds.has(String(id))) } });

  console.log(`Programs: ${COLLEGES.length} CWTS + ${rotcPrograms.length} ROTC colleges (removed ${removed.deletedCount} course programs).`);
  console.log(`Brigades: ${await Brigade.countDocuments({ nstpProgram: 'CWTS' })} CWTS, ${await Brigade.countDocuments({ nstpProgram: 'ROTC' })} ROTC companies. Same-day sessions merged: ${foldedSessions}.`);
  console.log(`Updated ${students} students, ${cadets} cadets, ${masterRows} masterlist rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exit(1);
  });
