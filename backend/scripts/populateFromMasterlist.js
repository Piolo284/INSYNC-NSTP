/* eslint-disable no-console */
/**
 * Builds the NSTP rosters from the masterlist, following the system's own
 * rules (same as a real registration + officer assignment), then adds past
 * training attendance.
 *
 *  1. Programs & brigades — one Program per masterlist course. CWTS: each
 *     program gets its own brigade and is fixed to the campus that offers it.
 *     ROTC: a program per course offered at an ROTC campus, plus 6 companies.
 *  2. Trainees — every masterlist student gets a User + Student (CWTS) or
 *     User + Cadet (ROTC) record. ROTC is not offered at Gasan/Torrijos, so
 *     those students are CWTS. A CWTS student's brigade comes from their course;
 *     a cadet's company comes from their handling officer (round-robin here),
 *     and cadets are split into 1st/2nd/3rd Platoon within their company.
 *  3. Attendance — closed Saturday training sessions per brigade/company with
 *     Present / Late (after the grace period) / Absent / Excused records, then
 *     the system's grade calculation (which auto-drops at the absence limit).
 *
 * Usage (from backend/):  node scripts/populateFromMasterlist.js
 * Refuses to run if students/cadets already exist (pass --force to add anyway).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Manila';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { COLLEGES } = require('../config/colleges');
const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Program = require('../models/Program');
const Brigade = require('../models/Brigade');
const Masterlist = require('../models/Masterlist');
const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const { ROTC_RESTRICTED_CAMPUSES, attendanceRules } = require('../config/constants');
const { startOfDay, combineDateAndTime, formatTime12h, addMinutes } = require('../utils/datetime');
const { recalculateGrade } = require('../utils/gradeCalculator');
const systemConfigCache = require('../utils/systemConfigCache');

/** Initial password for every created trainee account (they should change it). */
const DEFAULT_PASSWORD = 'Marsu@2026';

// Program (college) name → code, from the official list in config/colleges.js.
const COURSE_CODES = Object.fromEntries(COLLEGES.map((c) => [c.name, c.code]));

const CWTS_BRIGADE_NAMES = [
  'Makakalikasan', 'Mapagmalasakit', 'Matatag', 'Masigasig', 'Makabayan', 'Makabansa',
  'Maka-Diyos', 'Maka-Pilipino', 'Makatao', 'Matapat', 'Magiting', 'Mapagkalinga',
  'Masipag', 'Malikhain', 'Mahinahon', 'Mapagbigay', 'Matulungin', 'Marangal',
  'Matiyaga', 'Mapayapa', 'Malaya', 'Maunlad',
].map((n) => `Brigade ${n}`);
const ROTC_COMPANIES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map((n) => `${n} Company`);
const PLATOONS = ['1st Platoon', '2nd Platoon', '3rd Platoon'];

/** Past Saturday training days of AY 2026-2027 (1st semester so far). */
const TRAINING_DAYS = ['2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03'];
const START = '07:30';
const END = '11:30';

// Deterministic PRNG — the same masterlist always produces the same data.
let seed = 20262027;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

async function main() {
  await connectDatabase();
  await systemConfigCache.load();
  const force = process.argv.includes('--force');

  const [existingStudents, existingCadets] = await Promise.all([Student.countDocuments(), Cadet.countDocuments()]);
  if ((existingStudents || existingCadets) && !force) {
    throw new Error(`There are already ${existingStudents} students and ${existingCadets} cadets. Re-run with --force to add anyway.`);
  }

  const masterlist = await Masterlist.find({}).sort({ studentNumber: 1 }).lean();
  if (!masterlist.length) throw new Error('The masterlist is empty — upload it first.');
  const creator = await User.findOne({ role: 'super_admin', status: 'Active' }).select('_id name');
  console.log(`Masterlist: ${masterlist.length} students. Sessions created by: ${creator ? creator.name : '(none)'}`);

  // ---- 1. Programs & brigades ----
  const campusOfCourse = {};
  masterlist.forEach((m) => { campusOfCourse[m.courseProgram] ||= m.campus; });
  const courses = Object.keys(campusOfCourse);
  const missing = courses.filter((c) => !COURSE_CODES[c]);
  if (missing.length) throw new Error(`No program code defined for: ${missing.join(', ')}`);

  const cwtsBrigadeOfCourse = {};
  for (const [i, course] of courses.entries()) {
    const program = await Program.findOneAndUpdate(
      { code: COURSE_CODES[course], nstpProgram: 'CWTS' },
      { $setOnInsert: { name: course, code: COURSE_CODES[course], nstpProgram: 'CWTS', campus: campusOfCourse[course], status: 'Active' } },
      { new: true, upsert: true }
    );
    let brigade = program.brigadeId ? await Brigade.findById(program.brigadeId) : null;
    if (!brigade) {
      brigade = await Brigade.create({ name: CWTS_BRIGADE_NAMES[i], programId: program._id, nstpProgram: 'CWTS', status: 'Active' });
      program.brigadeId = brigade._id;
      await program.save();
    }
    cwtsBrigadeOfCourse[course] = { program, brigade };
  }

  const rotcCourses = courses.filter((c) => !ROTC_RESTRICTED_CAMPUSES.includes(campusOfCourse[c]));
  const rotcProgramOfCourse = {};
  const companies = [];
  for (const [i, course] of rotcCourses.entries()) {
    // ROTC programs have no fixed campus — a cadet picks theirs.
    const program = await Program.findOneAndUpdate(
      { code: COURSE_CODES[course], nstpProgram: 'ROTC' },
      { $setOnInsert: { name: course, code: COURSE_CODES[course], nstpProgram: 'ROTC', campus: null, status: 'Active' } },
      { new: true, upsert: true }
    );
    // A company (brigade) must be paired with one program; the first six
    // ROTC programs carry the six companies.
    if (i < ROTC_COMPANIES.length && !program.brigadeId) {
      const company = await Brigade.create({ name: ROTC_COMPANIES[i], programId: program._id, nstpProgram: 'ROTC', status: 'Active' });
      program.brigadeId = company._id;
      await program.save();
    }
    rotcProgramOfCourse[course] = program;
  }
  companies.push(...(await Brigade.find({ nstpProgram: 'ROTC' }).sort({ name: 1 })));
  console.log(`Programs: ${courses.length} CWTS, ${rotcCourses.length} ROTC. Brigades: ${courses.length} CWTS, ${companies.length} ROTC companies.`);

  // ---- 2. Trainee accounts ----
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const already = new Set((await User.find({ studentId: { $in: masterlist.map((m) => m.studentNumber) } }).select('studentId')).map((u) => u.studentId));
  const users = [];
  const profiles = { cwts: [], rotc: [] };
  let bootcamp = 0; // counts Boac/Sta. Cruz students for the CWTS/ROTC split
  let cadetIndex = 0;

  for (const m of masterlist) {
    if (already.has(m.studentNumber)) continue;
    const rotcAllowed = !ROTC_RESTRICTED_CAMPUSES.includes(m.campus) && rotcProgramOfCourse[m.courseProgram];
    const isCadet = rotcAllowed && bootcamp++ % 3 === 2; // about 1 in 3 at ROTC campuses
    const _id = new mongoose.Types.ObjectId();
    const base = {
      fullName: m.fullName,
      email: m.email,
      course: m.courseProgram,
      yearLevel: m.academicYear,
      section: '',
      campus: m.campus,
      contactNumber: `09${String(randInt(100000000, 999999999))}`,
      specialCategory: 'None',
      status: 'Active',
      userId: _id,
    };

    if (isCadet) {
      const company = companies[cadetIndex % companies.length];
      const platoon = PLATOONS[Math.floor(cadetIndex / companies.length) % PLATOONS.length];
      cadetIndex += 1;
      users.push({ _id, name: m.fullName, email: m.email, password: passwordHash, role: 'cadet', studentId: m.studentNumber, program: 'ROTC', programId: rotcProgramOfCourse[m.courseProgram]._id, brigadeId: company._id, yearLevel: m.academicYear, section: '', campus: m.campus, contactNumber: base.contactNumber, status: 'Active' });
      profiles.rotc.push({ ...base, program: 'ROTC', cadetId: m.studentNumber, programId: rotcProgramOfCourse[m.courseProgram]._id, brigadeId: company._id, brigade: company.name, company: company.name, platoon });
    } else {
      const { program, brigade } = cwtsBrigadeOfCourse[m.courseProgram];
      users.push({ _id, name: m.fullName, email: m.email, password: passwordHash, role: 'student', studentId: m.studentNumber, program: 'CWTS', programId: program._id, brigadeId: brigade._id, yearLevel: m.academicYear, section: '', campus: m.campus, contactNumber: base.contactNumber, status: 'Active' });
      profiles.cwts.push({ ...base, program: 'CWTS', studentId: m.studentNumber, programId: program._id, brigadeId: brigade._id, brigade: brigade.name, company: '' });
    }
  }

  // insertMany skips the pre-save hook, so `password` is already the bcrypt hash.
  await User.insertMany(users);
  await Student.insertMany(profiles.cwts);
  await Cadet.insertMany(profiles.rotc);
  console.log(`Accounts: ${profiles.cwts.length} CWTS students, ${profiles.rotc.length} ROTC cadets (password: ${DEFAULT_PASSWORD}).`);

  // ---- 3. Training sessions + attendance ----
  const { lateGraceMinutes } = attendanceRules();
  const groups = [
    ...Object.values(cwtsBrigadeOfCourse).map(({ brigade }) => ({ brigade, program: 'CWTS', label: 'CWTS Training' })),
    ...companies.map((brigade) => ({ brigade, program: 'ROTC', label: 'ROTC Drill' })),
  ];
  let sessionCount = 0;
  let recordCount = 0;
  const tally = { Present: 0, Late: 0, Absent: 0, Excused: 0 };

  for (const group of groups) {
    const roster = await User.find({ brigadeId: group.brigade._id, role: group.program === 'ROTC' ? 'cadet' : 'student', status: 'Active' }).select('_id');
    if (!roster.length) continue;

    for (const [dayIndex, day] of TRAINING_DAYS.entries()) {
      const date = startOfDay(new Date(day));
      const startsAt = combineDateAndTime(date, START);
      const endsAt = combineDateAndTime(date, END);
      const session = await AttendanceSession.create({
        program: group.program,
        brigadeId: group.brigade._id,
        brigade: group.brigade.name,
        title: `${group.brigade.name} — ${group.label} Day ${dayIndex + 1}`,
        date,
        startTime: START,
        endTime: END,
        startsAt,
        endsAt,
        sessionCode: `NSTP-${group.program}-${crypto.randomBytes(9).toString('hex').toUpperCase()}`,
        checkType: 'IN',
        status: 'Closed',
        absentSweptAt: endsAt,
        createdBy: creator ? creator._id : null,
      });
      sessionCount += 1;

      const records = roster.map((u) => {
        const r = rand();
        const status = r < 0.8 ? 'Present' : r < 0.9 ? 'Late' : r < 0.96 ? 'Absent' : 'Excused';
        tally[status] += 1;
        const scannedAt = status === 'Present'
          ? addMinutes(startsAt, randInt(-15, lateGraceMinutes - 1))
          : status === 'Late'
            ? addMinutes(startsAt, randInt(lateGraceMinutes + 1, 70))
            : endsAt;
        return {
          sessionId: session._id,
          activityId: null,
          brigadeId: group.brigade._id,
          studentId: u._id,
          program: group.program,
          title: session.title,
          date,
          time: status === 'Present' || status === 'Late' ? formatTime12h(scannedAt) : '',
          status,
          attendanceMethod: status === 'Present' || status === 'Late' ? 'QR' : 'Manual',
          verificationCode: null,
          verificationExpiresAt: null,
          verified: true,
          checkOutTime: '',
          checkOutAt: null,
          outSessionId: null,
          remarks: status === 'Absent'
            ? 'Automatically marked absent — no QR scan before the session ended.'
            : status === 'Excused' ? 'Excused — with valid reason submitted to the officer.' : '',
          autoAbsent: status === 'Absent',
          recordedBy: status === 'Excused' && creator ? creator._id : null,
          createdAt: scannedAt,
          updatedAt: scannedAt,
        };
      });
      // Raw insert so createdAt reflects the real scan time (the officer
      // dashboard's trend line groups by it).
      await Attendance.collection.insertMany(records);
      recordCount += records.length;
    }
  }
  console.log(`Attendance: ${sessionCount} sessions, ${recordCount} records — ${JSON.stringify(tally)}`);

  // ---- 4. Grades (and the automatic drop rule) ----
  const trainees = await User.find({ _id: { $in: users.map((u) => u._id) } }).select('_id program');
  for (const t of trainees) await recalculateGrade(t._id, t.program);
  const dropped = await User.countDocuments({ _id: { $in: users.map((u) => u._id) }, status: 'Dropped' });
  console.log(`Grades recalculated for ${trainees.length} trainees. Automatically dropped (absence limit): ${dropped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[populate] failed:', err.message);
    process.exit(1);
  });
