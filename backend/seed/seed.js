/* eslint-disable no-console */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const Program = require('../models/Program');
const Brigade = require('../models/Brigade');
const Activity = require('../models/Activity');
const ModuleModel = require('../models/Module');
const Announcement = require('../models/Announcement');
const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const Submission = require('../models/Submission');
const DocumentModel = require('../models/Document');
const Notification = require('../models/Notification');
const Grade = require('../models/Grade');
const CertificateRequest = require('../models/CertificateRequest');
const AttendanceContest = require('../models/AttendanceContest');
const Masterlist = require('../models/Masterlist');

const { CERTIFICATE_TYPES, CAMPUSES, ROTC_RESTRICTED_CAMPUSES } = require('../config/constants');
// ROTC isn't offered at every campus (see ROTC_RESTRICTED_CAMPUSES) — cadets
// are only ever assigned one of these.
const ROTC_ALLOWED_CAMPUSES = CAMPUSES.filter((c) => !ROTC_RESTRICTED_CAMPUSES.includes(c));
const { recalculateGrade } = require('../utils/gradeCalculator');
const { startOfDay, combineDateAndTime, formatTime12h } = require('../utils/datetime');
const { resolveBrigadeForCourse, applyBrigadeFields } = require('../utils/brigadeAssignment');

// `npm run seed` and `npm run seed:fresh` both currently run this file the
// same way (always wipe + recreate) — there is no persistent "add to existing
// data" mode yet, so the two npm scripts are equivalent for now.

// ---------- deterministic helpers ----------
const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (n) => startOfDay(new Date(Date.now() - n * 86400000));
const daysAhead = (n) => startOfDay(new Date(Date.now() + n * 86400000));

/** Runs `fn` over `items` with at most `limit` in flight at once — used for
 * the per-trainee grade recalculation pass so a 300+ roster doesn't serialize
 * into hundreds of sequential round trips to the database. */
async function mapWithConcurrency(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
// Every brigade/company gets exactly this many trainees. CWTS has 12
// colleges, each with a brigade and a fixed campus (see CWTS_PROGRAM_SEEDS
// below), for 360 CWTS students; ROTC keeps its original 6 companies for
// 180 cadets.
const TRAINEES_PER_BRIGADE = 30;

// ============================================================
// CENTRALIZED PROGRAM → BRIGADE MAPPING
// ============================================================
// One row per college/course, per NSTP program — this is the single source
// of truth every student/cadet's brigade (and, for CWTS, campus) is derived
// from (never picked independently). CWTS is organized by college (one
// brigade per college, and every college is only offered at one MARSU
// campus — see the `campus` column and models/Program.js); ROTC keeps its
// existing per-course "company" convention with no fixed campus instead, so
// a cadet still picks their own campus at registration.
const CWTS_PROGRAM_SEEDS = [
  { code: 'CICS', name: 'College of Information and Computing Sciences', brigade: 'Brigade Makakalikasan', campus: 'MARSU - Boac (Main)' },
  { code: 'CES', name: 'College of Environmental Studies', brigade: 'Brigade Mapagmalasakit', campus: 'MARSU - Boac (Main)' },
  { code: 'CGOV', name: 'College of Governance', brigade: 'Brigade Matatag', campus: 'MARSU - Boac (Main)' },
  { code: 'CBA', name: 'College of Business and Accountancy', brigade: 'Brigade Masigasig', campus: 'MARSU - Boac (Main)' },
  { code: 'COE', name: 'College of Engineering', brigade: 'Brigade Makabayan', campus: 'MARSU - Boac (Main)' },
  { code: 'CAHS', name: 'College of Allied Health and Sciences', brigade: 'Brigade Makabansa', campus: 'MARSU - Boac (Main)' },
  { code: 'CED', name: 'College of Education', brigade: 'Brigade Maka-Diyos', campus: 'MARSU - Boac (Main)' },
  { code: 'CASS', name: 'College of Arts and Social Sciences', brigade: 'Brigade Maka-Pilipino', campus: 'MARSU - Boac (Main)' },
  { code: 'CIT', name: 'College of Industrial Technology', brigade: 'Brigade Makatao', campus: 'MARSU - Boac (Main)' },
  { code: 'CFG', name: 'College of Fisheries', brigade: 'Brigade Gasan Campus', campus: 'MARSU - Gasan' },
  { code: 'CTOUR', name: 'College of Tourism', brigade: 'Brigade Sta. Cruz Campus', campus: 'MARSU - Sta. Cruz' },
  { code: 'CAGRI', name: 'College of Agriculture', brigade: 'Brigade Torrijos Campus', campus: 'MARSU - Torrijos' },
];
const ROTC_PROGRAM_SEEDS = [
  { code: 'BSIT', name: 'BS Information Technology', brigade: 'Alpha Company' },
  { code: 'BSCS', name: 'BS Computer Science', brigade: 'Bravo Company' },
  { code: 'BSCrim', name: 'BS Criminology', brigade: 'Charlie Company' },
  { code: 'BSEd', name: 'BS Education', brigade: 'Delta Company' },
  { code: 'BSBA', name: 'BS Business Administration', brigade: 'Echo Company' },
  { code: 'BSN', name: 'BS Nursing', brigade: 'Foxtrot Company' },
];
// Course/college codes used to assign each block of TRAINEES_PER_BRIGADE
// trainees to their program — derived from the seeds above so the two never
// drift apart.
const CWTS_COURSES = CWTS_PROGRAM_SEEDS.map((p) => p.code);
const ROTC_COURSES = ROTC_PROGRAM_SEEDS.map((p) => p.code);

const STUDENT_NAMES = [
  'Piolo M. Privado',
  'Juan Dela Cruz',
  'Maria Clara Santos',
  'Jose P. Rizal',
  'Andres Bonifacio',
  'Gabriela Silang',
  'Emilio Aguinaldo',
  'Melchora Aquino',
  'Sofia Mendoza',
  'John Paul Reyes',
];

const CADET_NAMES = [
  'Antonio Luna',
  'Gregorio del Pilar',
  'Apolinario Mabini',
  'Marcelo H. del Pilar',
  'Diego Silang',
  'Teresa Magbanua',
  'Vicente Lim',
  'Rafael Ramos',
  'Carlos Romulo',
  'Josefa Llanes',
];

// Beyond the first 10 iconic names above, the rest of each 180-person roster
// gets a generated name from these pools — large enough (20 x 20 = 400
// combinations) that CWTS's ~170 extra students and ROTC's ~170 extra cadets
// each draw from a disjoint slice of the combo space (see generateFullName)
// and never collide with each other or repeat within a program.
const EXTRA_FIRST_NAMES = [
  'Mark', 'Angel', 'Kristine', 'Paolo', 'Bea', 'Carlo', 'Jasmine', 'Miguel',
  'Nicole', 'Rafael', 'Erika', 'Joshua', 'Cassandra', 'Renz', 'Alyssa',
  'Kevin', 'Trisha', 'Adrian', 'Camille', 'Xander',
];
const EXTRA_LAST_NAMES = [
  'Torres', 'Domingo', 'Villanueva', 'Bautista', 'Aquino', 'Fernandez',
  'Castillo', 'Navarro', 'Salazar', 'Mercado', 'Rivera', 'Cruz', 'Santos',
  'Garcia', 'Ramirez', 'Gutierrez', 'Pascual', 'Aguilar', 'Velasco', 'Ocampo',
];
function generateFullName(comboIndex) {
  const first = EXTRA_FIRST_NAMES[comboIndex % EXTRA_FIRST_NAMES.length];
  const last = EXTRA_LAST_NAMES[Math.floor(comboIndex / EXTRA_FIRST_NAMES.length) % EXTRA_LAST_NAMES.length];
  return `${first} ${last}`;
}
/** Iconic name for the first 10 slots, then a generated one — `offset` keeps
 * CWTS's and ROTC's generated names drawing from different combo ranges. */
function nameForIndex(index, iconicNames, offset) {
  if (index < iconicNames.length) return iconicNames[index];
  return generateFullName(offset + (index - iconicNames.length));
}

const CWTS_ACTIVITY_SEEDS = [
  ['CWTS Orientation', 'Opening orientation for all CWTS trainees for the semester.', 'MARSU Gymnasium'],
  ['Tree Planting Activity', 'Annual tree planting drive at the campus grounds.', 'MARSU Campus'],
  ['Coastal Clean-Up Activity', 'Community coastal clean-up drive. Bring gloves and water.', 'Sea Side, Boac'],
  ['Community Outreach Program', 'Feeding program and medical mission for the barangay.', 'Barangay Hall'],
  ['Disaster Preparedness Seminar', 'Seminar on disaster preparedness and community safety measures.', 'MARSU Gymnasium'],
  ['Recycling Awareness Campaign', 'House-to-house campaign on proper waste segregation.', 'Barangay San Miguel'],
  ['First Aid Training Seminar', 'Basic first aid and emergency response training.', 'AVR Building'],
];

const ROTC_ACTIVITY_SEEDS = [
  ['ROTC Orientation', 'Opening orientation and cadet briefing for the semester.', 'MARSU Gymnasium'],
  ['Drill & Ceremony Practice', 'Close order drill and ceremony rehearsal.', 'MARSU Parade Ground'],
  ['Endurance Run and Physical Fitness Test', 'Timed run and PFT scoring for all cadets.', 'MARSU Parade Ground'],
  ['Land Navigation Exercise', 'Map reading and land navigation course for all cadets.', 'MARSU Training Ground'],
  ['Field Training Exercise', 'Overnight bivouac with field equipment.', 'MARSU Training Ground'],
];

const CWTS_MODULE_SEEDS = [
  ['CWTS Module 1', 'Understanding Community and Self', 'CWTS - A'],
  ['CWTS Module 2', 'Community Engagement and Solidarity', 'CWTS - A'],
  ['CWTS Module 3', 'Social Responsibility and Action', 'CWTS - A1'],
  ['CWTS Module 4', 'Sustainable Community Development', 'CWTS - A1'],
  ['CWTS Reflection Paper', 'Write a reflection about your CWTS community engagement experience.', 'CWTS - A'],
  ['Coastal Clean-Up Report', 'Document your participation in the coastal clean-up drive.', 'CWTS - A1'],
  ['Recycling Awareness Campaign Output', 'Submit photos and a short write-up of your campaign.', 'CWTS - B'],
];

const ROTC_MODULE_SEEDS = [
  ['ROTC Module 1', 'Military Orientation and Organization', 'ROTC - A'],
  ['ROTC Module 2', 'Drill and Ceremony Fundamentals', 'ROTC - A'],
  ['Drill Manual Report', 'Submit your written drill manual report.', 'ROTC - A'],
];

const RUBRIC_TEMPLATE = [
  {
    title: 'Content & Understanding',
    points: 30,
    description: 'Demonstrates clear understanding of the experience and key learnings.',
  },
  {
    title: 'Organization & Structure',
    points: 25,
    description: 'Ideas are logically arranged with a clear introduction and conclusion.',
  },
  {
    title: 'Reflection & Insight',
    points: 25,
    description: 'Shows genuine personal insight and connection to community service.',
  },
  {
    title: 'Grammar & Presentation',
    points: 20,
    description: 'Free of major grammatical errors and follows the required format.',
  },
];

const REQUIRED_DOCUMENTS = [
  'Registration Form',
  'Medical Certificate',
  'PWD ID (if applicable)',
  'Parent Consent Form',
  '2 x 2 Picture',
  'Brigade Clearance',
];

async function wipe() {
  console.log('[seed] clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Cadet.deleteMany({}),
    Officer.deleteMany({}),
    Program.deleteMany({}),
    Brigade.deleteMany({}),
    Activity.deleteMany({}),
    ModuleModel.deleteMany({}),
    Announcement.deleteMany({}),
    AttendanceSession.deleteMany({}),
    Attendance.deleteMany({}),
    Submission.deleteMany({}),
    DocumentModel.deleteMany({}),
    Notification.deleteMany({}),
    Grade.deleteMany({}),
    CertificateRequest.deleteMany({}),
    AttendanceContest.deleteMany({}),
    Masterlist.deleteMany({}),
  ]);
}

/**
 * Creates one Program + its paired Brigade for each seed row, in the exact
 * same shape POST /api/programs would produce — so seed data and live
 * admin-created data are structurally identical. A row with no `brigade`
 * (falsy) creates the Program only and leaves it unconfigured, same as a
 * freshly admin-created program nobody has paired with a brigade yet.
 */
async function seedProgramsAndBrigades(rows, nstpProgram) {
  const created = [];
  for (const row of rows) {
    const program = await Program.create({
      name: row.name,
      code: row.code,
      nstpProgram,
      campus: row.campus || null,
      status: 'Active',
    });
    let brigade = null;
    if (row.brigade) {
      brigade = await Brigade.create({
        name: row.brigade,
        programId: program._id,
        nstpProgram,
        status: 'Active',
      });
      program.brigadeId = brigade._id;
      await program.save();
    }
    created.push({ program, brigade });
  }
  return created;
}

async function seed() {
  await connectDatabase();
  await wipe();

  // ============================================================
  // 1. SUPER ADMIN (system-wide, no single program)
  // ============================================================
  const superAdmin = await User.create({
    name: 'System Administrator',
    email: 'admin@nstp.test',
    password: 'Admin123',
    role: 'super_admin',
    studentId: 'ADMIN-001',
    status: 'Active',
  });
  console.log('[seed] super_admin created');

  // system_maintenance_admin — program-less, scoped by middleware/systemAdminScope.js
  // to only /auth, /notifications, /system, /certificate-templates.
  await User.create({
    name: 'System Maintenance Admin',
    email: 'sysmaint@nstp.test',
    password: 'SysMaint123',
    role: 'system_maintenance_admin',
    studentId: 'SYSMAINT-001',
    status: 'Active',
  });
  console.log('[seed] system_maintenance_admin created');

  // ============================================================
  // 2. PROGRAM ADMINS (admin_cwts, admin_rotc)
  // ============================================================
  const adminCwts = await User.create({
    name: 'Lorenz D. Manalo',
    email: 'admin.cwts@nstp.test',
    password: 'AdminCWTS123',
    role: 'admin_cwts',
    studentId: 'ADMIN-CWTS-001',
    program: 'CWTS',
    status: 'Active',
  });
  const adminRotc = await User.create({
    name: 'Ramon C. Villanueva',
    email: 'admin.rotc@nstp.test',
    password: 'AdminROTC123',
    role: 'admin_rotc',
    studentId: 'ADMIN-ROTC-001',
    program: 'ROTC',
    status: 'Active',
  });
  console.log('[seed] admin_cwts and admin_rotc created');

  // ============================================================
  // 3. COLLEGE PROGRAMS + BRIGADES (the centralized hierarchy's foundation)
  // ============================================================
  const cwtsPrograms = await seedProgramsAndBrigades(CWTS_PROGRAM_SEEDS, 'CWTS');
  const rotcPrograms = await seedProgramsAndBrigades(ROTC_PROGRAM_SEEDS, 'ROTC');
  console.log(
    `[seed] ${cwtsPrograms.length} CWTS + ${rotcPrograms.length} ROTC programs/brigades created`
  );

  // ============================================================
  // 4. OFFICERS (3 CWTS + 3 ROTC) — each admin-assigned to one brigade
  // ============================================================
  const officerSeeds = [
    { name: 'Piolo M. Privado', email: 'officer.cwts@nstp.test', password: 'OfficerCWTS@123', id: 'OFF-C01', program: 'CWTS' },
    { name: 'Ana Marie Garcia', email: 'officer.cwts2@nstp.test', password: 'OfficerCWTS123', id: 'OFF-C02', program: 'CWTS' },
    { name: 'Mark Anthony Cruz', email: 'officer.cwts3@nstp.test', password: 'OfficerCWTS123', id: 'OFF-C03', program: 'CWTS' },
    { name: 'Bernard S. Tolentino', email: 'officer.rotc@nstp.test', password: 'OfficerROTC123', id: 'OFF-R01', program: 'ROTC' },
    { name: 'Katrina L. Bautista', email: 'officer.rotc2@nstp.test', password: 'OfficerROTC123', id: 'OFF-R02', program: 'ROTC' },
    { name: 'Dennis P. Ocampo', email: 'officer.rotc3@nstp.test', password: 'OfficerROTC123', id: 'OFF-R03', program: 'ROTC' },
  ];

  const officers = [];
  for (let i = 0; i < officerSeeds.length; i += 1) {
    const s = officerSeeds[i];
    // Only programs with a configured brigade are eligible — College of
    // Fisheries has none yet, so it never gets an officer.
    const pool = (s.program === 'CWTS' ? cwtsPrograms : rotcPrograms).filter((p) => p.brigade);
    const brigade = pick(pool, i).brigade;

    const user = await User.create({
      name: s.name,
      email: s.email,
      password: s.password,
      role: 'officer',
      studentId: s.id,
      program: s.program,
      brigadeId: brigade._id,
      status: 'Active',
    });
    await Officer.create({
      userId: user._id,
      officerId: s.id,
      fullName: s.name,
      email: s.email,
      program: s.program,
      position: i % 3 === 0 ? 'Head Officer' : 'Officer',
      brigadeId: brigade._id,
      brigade: brigade.name,
      contactNumber: '09181234567',
      // Ana Marie (OFF-C02) and Katrina (OFF-R02) double as their program's
      // Special Class officer — separate demo accounts from cwtsOfficer/
      // rotcOfficer below, so the two roles (regular brigade officer vs.
      // cross-brigade Special Class officer) stay distinguishable in the
      // seeded data.
      isSpecialClassOfficer: i === 1 || i === 4,
    });
    officers.push(user);
  }
  const cwtsOfficer = officers[0]; // Brigade Makakalikasan (CICS)
  const rotcOfficer = officers[3]; // Alpha Company (BSIT)
  const cwtsSpecialClassOfficer = officers[1]; // Ana Marie Garcia — CWTS Special Class (all brigades)
  const specialClassOfficer = officers[4]; // Katrina L. Bautista — ROTC Special Class (all companies)
  console.log(`[seed] ${officers.length} officers created, each assigned to one brigade`);
  console.log(`[seed] ${cwtsSpecialClassOfficer.name} assigned as the CWTS Special Class officer`);
  console.log(`[seed] ${specialClassOfficer.name} assigned as the ROTC Special Class officer`);

  // ============================================================
  // 5. STUDENTS (360 CWTS — 30 per college) — brigade+campus auto-derived from course
  // ============================================================
  const TOTAL_CWTS_STUDENTS = CWTS_COURSES.length * TRAINEES_PER_BRIGADE; // 360

  // Passwords are identical across the whole roster, so hash each shared
  // password exactly once instead of once per trainee (bcrypt is
  // deliberately slow) — insertMany below skips the User model's
  // pre('save') hashing hook, so the hash has to already be final here.
  const studentPasswordHash = await bcrypt.hash('StudentCWTS123', 10);

  // resolveBrigadeForCourse hits the database — resolve each of the 12
  // colleges once and reuse the result for all 30 students in that college,
  // rather than 360 redundant lookups.
  const cwtsResolvedByCourse = new Map();
  for (const course of CWTS_COURSES) {
    cwtsResolvedByCourse.set(course, await resolveBrigadeForCourse(course, 'CWTS'));
  }

  const studentUserDocs = [];
  for (let i = 0; i < TOTAL_CWTS_STUDENTS; i += 1) {
    const name = nameForIndex(i, STUDENT_NAMES, 0);
    const studentId = `23BI${471 + i}`;
    const email = i === 0 ? 'student.cwts@nstp.test' : `student${i + 1}@nstp.test`;
    const course = CWTS_COURSES[Math.floor(i / TRAINEES_PER_BRIGADE)];
    const resolved = cwtsResolvedByCourse.get(course);

    studentUserDocs.push(
      applyBrigadeFields(
        {
          name,
          email,
          password: studentPasswordHash,
          role: 'student',
          studentId,
          program: 'CWTS',
          yearLevel: pick(YEARS, i),
          section: `CWTS 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
          // No campus set here — every CWTS college has a fixed campus
          // (see CWTS_PROGRAM_SEEDS), so applyBrigadeFields derives it below
          // from the resolved Program instead of it being picked by hand.
          contactNumber: `09${String(100000000 + i).padStart(9, '0')}`,
          status: 'Active',
        },
        resolved
      )
    );
  }
  const students = await User.insertMany(studentUserDocs);

  const studentProfileDocs = students.map((u, i) => {
    const course = CWTS_COURSES[Math.floor(i / TRAINEES_PER_BRIGADE)];
    return applyBrigadeFields(
      {
        userId: u._id,
        studentId: u.studentId,
        fullName: u.name,
        email: u.email,
        program: 'CWTS',
        course,
        yearLevel: u.yearLevel,
        section: u.section,
        campus: u.campus,
        contactNumber: u.contactNumber,
        address: 'Butansapa, Mogpog, Marinduque - 4901',
        emergencyContact: 'Eleanor Privado (Mother) - 09989251333',
        status: 'Active',
      },
      cwtsResolvedByCourse.get(course)
    );
  });
  // Demo Special Class students — deliberately spread across three
  // different brigades (not the same one used for the at-risk/dropped
  // demos below) so the CWTS-wide, cross-brigade nature of the track is
  // obvious, mirroring the ROTC demo set built right after this.
  const CWTS_SPECIAL_CLASS_DEMO_INDEXES = [35, 65, 185]; // Mapagmalasakit, Matatag, Maka-Diyos brigades
  const CWTS_SPECIAL_CLASS_DEMO_VALUES = ['PWD', 'Medical Condition', 'Medical Condition'];
  CWTS_SPECIAL_CLASS_DEMO_INDEXES.forEach((idx, i) => {
    studentProfileDocs[idx].specialCategory = CWTS_SPECIAL_CLASS_DEMO_VALUES[i];
  });

  await Student.insertMany(studentProfileDocs);
  console.log(`[seed] ${students.length} students created, ${TRAINEES_PER_BRIGADE} per brigade`);
  console.log(
    `[seed] ${CWTS_SPECIAL_CLASS_DEMO_INDEXES.length} students marked for the CWTS Special Class track (PWD/Medical Condition)`
  );

  // ============================================================
  // 6. CADETS (180 ROTC — 30 per company) — same derivation, ROTC pool
  // ============================================================
  const TOTAL_ROTC_CADETS = ROTC_COURSES.length * TRAINEES_PER_BRIGADE; // 180
  const cadetPasswordHash = await bcrypt.hash('CadetROTC123', 10);

  const rotcResolvedByCourse = new Map();
  for (const course of ROTC_COURSES) {
    rotcResolvedByCourse.set(course, await resolveBrigadeForCourse(course, 'ROTC'));
  }

  const cadetUserDocs = [];
  for (let i = 0; i < TOTAL_ROTC_CADETS; i += 1) {
    const name = nameForIndex(i, CADET_NAMES, TOTAL_CWTS_STUDENTS - STUDENT_NAMES.length);
    const cadetId = `23RC${101 + i}`;
    const email = i === 0 ? 'cadet.rotc@nstp.test' : `cadet${i + 1}@nstp.test`;
    const course = ROTC_COURSES[Math.floor(i / TRAINEES_PER_BRIGADE)];
    const resolved = rotcResolvedByCourse.get(course);

    cadetUserDocs.push(
      applyBrigadeFields(
        {
          name,
          email,
          password: cadetPasswordHash,
          role: 'cadet',
          studentId: cadetId,
          program: 'ROTC',
          yearLevel: pick(YEARS, i),
          section: `ROTC 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
          campus: pick(ROTC_ALLOWED_CAMPUSES, i),
          contactNumber: `09${String(200000000 + i).padStart(9, '0')}`,
          status: 'Active',
        },
        resolved
      )
    );
  }
  const cadets = await User.insertMany(cadetUserDocs);

  const cadetProfileDocs = cadets.map((u, i) => {
    const course = ROTC_COURSES[Math.floor(i / TRAINEES_PER_BRIGADE)];
    const resolved = rotcResolvedByCourse.get(course);
    return applyBrigadeFields(
      {
        userId: u._id,
        cadetId: u.studentId,
        fullName: u.name,
        email: u.email,
        program: 'ROTC',
        course,
        platoon: pick(['1st Platoon', '2nd Platoon', '3rd Platoon'], i),
        company: resolved ? resolved.brigade.name : '',
        yearLevel: u.yearLevel,
        section: u.section,
        campus: u.campus,
        contactNumber: u.contactNumber,
        address: 'Boac, Marinduque - 4900',
        emergencyContact: 'Corazon Luna (Mother) - 09981112222',
        status: 'Active',
      },
      resolved
    );
  });
  // Demo Special Class cadets — deliberately spread across three different
  // companies (not the same one used for the at-risk/dropped demos below) so
  // the ROTC-wide, cross-brigade nature of the track is obvious.
  const SPECIAL_CLASS_DEMO_INDEXES = [5, 65, 125]; // Alpha, Charlie, Echo companies
  const SPECIAL_CLASS_DEMO_VALUES = ['PWD', 'Medical Condition', 'Medical Condition'];
  SPECIAL_CLASS_DEMO_INDEXES.forEach((idx, i) => {
    cadetProfileDocs[idx].specialCategory = SPECIAL_CLASS_DEMO_VALUES[i];
  });

  await Cadet.insertMany(cadetProfileDocs);
  console.log(`[seed] ${cadets.length} cadets created, ${TRAINEES_PER_BRIGADE} per company`);
  console.log(
    `[seed] ${SPECIAL_CLASS_DEMO_INDEXES.length} cadets marked for the ROTC Special Class track (PWD/Medical Condition)`
  );

  // ============================================================
  // 7. ACTIVITIES (10 total) — each belongs to its creating officer's brigade
  // ============================================================
  const activities = [];
  for (let i = 0; i < CWTS_ACTIVITY_SEEDS.length; i += 1) {
    const [title, description, location] = CWTS_ACTIVITY_SEEDS[i];
    const isPast = i < 4;
    activities.push(
      await Activity.create({
        title,
        description,
        program: 'CWTS',
        date: isPast ? daysAgo((4 - i) * 7) : daysAhead((i - 3) * 5),
        startTime: '08:00',
        endTime: '11:30',
        location,
        brigadeId: cwtsOfficer.brigadeId,
        brigade: cwtsPrograms.find((p) => String(p.brigade._id) === String(cwtsOfficer.brigadeId))
          ?.brigade.name || '',
        objectives: [
          'Promote environmental awareness',
          'Encourage community involvement',
          'Develop civic responsibility among trainees',
        ],
        status: isPast ? 'Completed' : 'Upcoming',
        createdBy: cwtsOfficer._id,
      })
    );
  }
  for (let i = 0; i < ROTC_ACTIVITY_SEEDS.length; i += 1) {
    const [title, description, location] = ROTC_ACTIVITY_SEEDS[i];
    const isPast = i < 4;
    activities.push(
      await Activity.create({
        title,
        description,
        program: 'ROTC',
        date: isPast ? daysAgo((4 - i) * 7) : daysAhead(6),
        startTime: '06:00',
        endTime: '10:00',
        location,
        brigadeId: rotcOfficer.brigadeId,
        brigade: rotcPrograms.find((p) => String(p.brigade._id) === String(rotcOfficer.brigadeId))
          ?.brigade.name || '',
        objectives: [
          'Instill discipline and teamwork',
          'Develop leadership among cadets',
          'Practice military bearing and courtesy',
        ],
        status: isPast ? 'Completed' : 'Upcoming',
        createdBy: rotcOfficer._id,
      })
    );
  }
  console.log(`[seed] ${activities.length} activities created, each tied to its officer's brigade`);

  // ============================================================
  // 8. MODULES (10 total, with deadlines + rubrics)
  // ============================================================
  const modules = [];
  for (let i = 0; i < CWTS_MODULE_SEEDS.length; i += 1) {
    const [title, description, moduleCode] = CWTS_MODULE_SEEDS[i];
    modules.push(
      await ModuleModel.create({
        title,
        description,
        program: 'CWTS',
        moduleCode,
        section: moduleCode,
        instructions: [
          'Minimum of 300 words',
          'Use your own words',
          'Submit in PDF format',
        ],
        deadline: i < 3 ? daysAgo(10 - i * 3) : daysAhead((i - 2) * 4),
        totalPoints: 100,
        rubrics: RUBRIC_TEMPLATE,
        status: i < 3 ? 'Completed' : 'Open',
        createdBy: adminCwts._id,
      })
    );
  }
  for (let i = 0; i < ROTC_MODULE_SEEDS.length; i += 1) {
    const [title, description, moduleCode] = ROTC_MODULE_SEEDS[i];
    modules.push(
      await ModuleModel.create({
        title,
        description,
        program: 'ROTC',
        moduleCode,
        section: moduleCode,
        instructions: ['Follow the ROTC manual format', 'Submit in PDF format'],
        deadline: i === 0 ? daysAgo(5) : daysAhead((i + 1) * 5),
        totalPoints: 100,
        rubrics: RUBRIC_TEMPLATE,
        status: i === 0 ? 'Completed' : 'Open',
        createdBy: adminRotc._id,
      })
    );
  }
  console.log(`[seed] ${modules.length} modules created`);

  // ============================================================
  // 9. ANNOUNCEMENTS (10 total)
  // ============================================================
  const announcementSeeds = [
    ['CWTS Orientation', 'All CWTS trainees are required to attend the orientation. Please bring your registration form and wear the proper uniform.', 'CWTS', 'Students', 'MARSU Gymnasium', true],
    ['Tree Planting Activity', 'Join us for our annual tree planting activity. Bring your own shovel and gloves. Certificates will be given to participants.', 'CWTS', 'Students', 'MARSU Campus', false],
    ['Coastal Clean-Up Activity', 'Community coastal clean-up drive this Saturday. Bring gloves, water, and a hat.', 'CWTS', 'All', 'Sea Side, Boac', false],
    ['Submission Reminder', "Don't forget to submit your Reflection Paper on or before the deadline.", 'CWTS', 'Students', '', false],
    ['Schedule Update', 'Please be advised that the schedule for Module 4 has been moved one week later.', 'CWTS', 'All', '', false],
    ['Barangay Feeding Program', 'Community feeding program. Volunteers are needed for preparation and serving.', 'CWTS', 'Students', 'Barangay San Miguel', false],
    ['First Aid Training Seminar', 'Basic first aid and emergency response training for all CWTS officers.', 'CWTS', 'Officers', 'AVR Building', false],
    ['ROTC Orientation', 'All ROTC cadets must attend the orientation. Bring your cadet uniform and ROTC manual.', 'ROTC', 'Cadets', 'MARSU Gymnasium', true],
    ['Field Training Exercise', 'Overnight bivouac training. Bring field equipment, sleeping bag, and personal necessities.', 'ROTC', 'Cadets', 'MARSU Training Ground', false],
    ['Program Coordination Meeting', 'All NSTP officers and program admins are requested to attend the monthly coordination meeting.', 'All', 'Officers', 'NSTP Office', false],
  ];

  const announcements = [];
  for (let i = 0; i < announcementSeeds.length; i += 1) {
    const [title, content, program, targetAudience, location, isPinned] =
      announcementSeeds[i];
    announcements.push(
      await Announcement.create({
        title,
        content,
        program,
        targetAudience,
        location,
        isPinned,
        date: i < 5 ? daysAgo(10 - i) : daysAhead(i - 4),
        time: i % 2 === 0 ? '8:00 AM' : '2:00 PM',
        status: 'Published',
        createdBy: program === 'ROTC' ? rotcOfficer._id : cwtsOfficer._id,
      })
    );
  }
  console.log(`[seed] ${announcements.length} announcements created`);

  // ============================================================
  // 10. ATTENDANCE SESSIONS + RECORDS
  // ============================================================
  const pastCwtsActivities = activities.filter(
    (a) => a.program === 'CWTS' && a.status === 'Completed'
  );
  const pastRotcActivities = activities.filter(
    (a) => a.program === 'ROTC' && a.status === 'Completed'
  );

  const sessions = [];
  const attendanceRows = [];

  // One session per (past activity, brigade) — not just the single
  // "showcase" officer's own brigade — so every seeded student/cadet across
  // every brigade/company ends up with real attendance history, and every
  // program admin/officer/super_admin dashboard has something to show.
  function rosterByBrigade(users, programBrigades) {
    const map = new Map(
      programBrigades.filter((p) => p.brigade).map((p) => [String(p.brigade._id), []])
    );
    for (const u of users) {
      const key = String(u.brigadeId || '');
      if (map.has(key)) map.get(key).push(u);
    }
    return map;
  }
  const officerByBrigade = new Map(officers.map((o) => [String(o.brigadeId), o]));
  const cwtsRosterByBrigade = rosterByBrigade(students, cwtsPrograms);
  const rotcRosterByBrigade = rosterByBrigade(cadets, rotcPrograms);

  async function seedSessionForBrigade(activity, brigadeDoc, roster, fallbackCreatedBy) {
    if (!roster.length) return;
    const createdBy = officerByBrigade.get(String(brigadeDoc._id))?._id || fallbackCreatedBy;

    const session = await AttendanceSession.create({
      activityId: activity._id,
      program: activity.program,
      brigadeId: brigadeDoc._id,
      brigade: brigadeDoc.name,
      title: activity.title,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      startsAt: combineDateAndTime(activity.date, activity.startTime),
      endsAt: combineDateAndTime(activity.date, activity.endTime),
      sessionCode: `NSTP-${activity.program}-${crypto
        .randomBytes(9)
        .toString('hex')
        .toUpperCase()}`,
      notes: `${activity.title} attendance`,
      status: 'Closed',
      createdBy,
    });
    sessions.push(session);

    roster.forEach((user, i) => {
      // Deterministic mix so the dashboards show meaningful numbers.
      const seed = (i + activity.title.length + brigadeDoc.name.length) % 10;
      let status = 'Present';
      if (seed === 3) status = 'Absent';
      else if (seed === 5) status = 'Late';
      else if (seed === 8) status = 'Excused';

      attendanceRows.push({
        sessionId: session._id,
        activityId: activity._id,
        brigadeId: brigadeDoc._id,
        studentId: user._id,
        program: activity.program,
        title: activity.title,
        date: activity.date,
        time:
          status === 'Absent'
            ? ''
            : formatTime12h(combineDateAndTime(activity.date, activity.startTime)),
        status,
        attendanceMethod: i % 4 === 0 ? 'Manual' : 'QR',
        verified: true,
        remarks: status === 'Excused' ? 'Medical certificate submitted' : '',
        recordedBy: createdBy,
      });
    });
  }

  for (const activity of pastCwtsActivities) {
    for (const { brigade } of cwtsPrograms) {
      if (!brigade) continue; // College of Fisheries has none yet
      await seedSessionForBrigade(
        activity,
        brigade,
        cwtsRosterByBrigade.get(String(brigade._id)) || [],
        cwtsOfficer._id
      );
    }
  }
  for (const activity of pastRotcActivities) {
    for (const { brigade } of rotcPrograms) {
      await seedSessionForBrigade(
        activity,
        brigade,
        rotcRosterByBrigade.get(String(brigade._id)) || [],
        rotcOfficer._id
      );
    }
  }

  // Sets a trainee's Absent count to *exactly* `count` — forces the first
  // `count` of their rows to Absent, and just as importantly neutralizes any
  // of their other rows that the deterministic Present/Late/Absent/Excused
  // mix above happened to already land on Absent, so callers below can rely
  // on an exact total instead of "at least N" (which could silently tip a
  // trainee past the 4-absence auto-drop threshold).
  function setExactAbsences(userId, count) {
    attendanceRows
      .filter((row) => String(row.studentId) === String(userId))
      .forEach((row, idx) => {
        if (idx < count) {
          row.status = 'Absent';
          row.time = '';
          row.remarks = '';
        } else if (row.status === 'Absent') {
          row.status = 'Present';
          row.time = '8:00 AM';
          row.remarks = '';
        }
      });
  }

  // Force the demo trainee's earliest attendance record to Absent so the
  // "Contest this absence" flow (mobile trainee screen -> officer review)
  // has something to test right after seeding, without disturbing the
  // deterministic Present/Late/Absent/Excused mix everyone else gets above.
  const demoTrainee = students[0]; // student.cwts@nstp.test, ID 23BI471
  setExactAbsences(demoTrainee._id, 1);

  // 20 CWTS students + 20 ROTC cadets forced to 3/4 absences (At Risk, still
  // Active) — pulled from cwtsOfficer's / rotcOfficer's own brigade/company
  // roster so the demo accounts (officer.cwts@nstp.test, officer.rotc@nstp.test)
  // see a full At Risk list immediately without switching brigades. Excludes
  // the demo-contest trainee above so its single forced absence isn't
  // overwritten.
  const cwtsOfficerRoster = cwtsRosterByBrigade.get(String(cwtsOfficer.brigadeId)) || [];
  const rotcOfficerRoster = rotcRosterByBrigade.get(String(rotcOfficer.brigadeId)) || [];
  const atRiskCandidates = cwtsOfficerRoster.filter(
    (s) => String(s._id) !== String(demoTrainee._id)
  );
  const atRiskStudents = atRiskCandidates.slice(0, 20);
  const atRiskCadets = rotcOfficerRoster.slice(0, 20);
  atRiskStudents.forEach((s) => setExactAbsences(s._id, 3));
  atRiskCadets.forEach((c) => setExactAbsences(c._id, 3));

  // A 21st CWTS student (outside the 20 above) gets a single forced absence
  // that's then contested-and-approved below — kept separate so approving it
  // (which turns that one Absent into Excused) doesn't knock any of the 20
  // At Risk students below their 3/4 count.
  const approvedContestStudent = atRiskCandidates[20] || null;
  if (approvedContestStudent) setExactAbsences(approvedContestStudent._id, 1);

  // One trainee per program pushed to 4/4 instead — section 12's grade
  // recalculation auto-drops them for real via the actual business logic
  // (utils/gradeCalculator.js), not a hardcoded status flag. Picked from
  // different brigade/company blocks than the At Risk group above.
  const toBeDroppedStudent = students[245]; // Brigade Makatao (College of Industrial Technology) block
  const toBeDroppedCadet = cadets[61]; // Charlie Company block
  setExactAbsences(toBeDroppedStudent._id, 4);
  setExactAbsences(toBeDroppedCadet._id, 4);

  // One session that is open right now, so QR scanning can be tested live —
  // scoped to cwtsOfficer's own brigade, same as a real "Create QR Code" call.
  const liveActivity = activities.find(
    (a) => a.program === 'CWTS' && a.status === 'Upcoming'
  );
  const now = new Date();
  const liveSession = await AttendanceSession.create({
    activityId: liveActivity ? liveActivity._id : null,
    program: 'CWTS',
    brigadeId: cwtsOfficer.brigadeId,
    brigade: activities[0].brigade,
    title: 'CWTS Training - Live Test Session',
    date: startOfDay(now),
    startTime: '00:00',
    endTime: '23:59',
    startsAt: combineDateAndTime(now, '00:00'),
    endsAt: combineDateAndTime(now, '23:59'),
    sessionCode: 'NSTP-CWTS-LIVE-TEST-SESSION',
    notes: 'Always-open session for testing the QR attendance flow.',
    status: 'Active',
    createdBy: cwtsOfficer._id,
  });
  sessions.push(liveSession);

  const insertedAttendance = await Attendance.insertMany(attendanceRows);
  console.log(
    `[seed] ${sessions.length} attendance sessions, ${attendanceRows.length} attendance records created`
  );

  // ============================================================
  // 10.6 ROTC SPECIAL CLASS DEMO DATA (activity + closed session)
  // ============================================================
  // Program-wide (brigadeId: null) and run by specialClassOfficer, not
  // rotcOfficer — cuts across the three companies SPECIAL_CLASS_DEMO_INDEXES
  // was drawn from, same as the real feature works.
  const specialClassCadetDemo = SPECIAL_CLASS_DEMO_INDEXES.map((idx) => cadets[idx]);
  const specialClassActivity = await Activity.create({
    title: 'Special Class Leadership Seminar',
    description: 'Alternative-track seminar for cadets exempted from field training.',
    program: 'ROTC',
    date: daysAgo(3),
    startTime: '09:00',
    endTime: '11:00',
    location: 'AVR Building',
    brigadeId: null,
    brigade: '',
    isSpecialClass: true,
    objectives: ['Develop leadership skills through classroom-based instruction'],
    status: 'Completed',
    createdBy: specialClassOfficer._id,
  });

  const specialClassSession = await AttendanceSession.create({
    activityId: specialClassActivity._id,
    program: 'ROTC',
    brigadeId: null,
    brigade: '',
    isSpecialClass: true,
    title: specialClassActivity.title,
    date: specialClassActivity.date,
    startTime: specialClassActivity.startTime,
    endTime: specialClassActivity.endTime,
    startsAt: combineDateAndTime(specialClassActivity.date, specialClassActivity.startTime),
    endsAt: combineDateAndTime(specialClassActivity.date, specialClassActivity.endTime),
    sessionCode: `NSTP-ROTC-${crypto.randomBytes(9).toString('hex').toUpperCase()}`,
    notes: 'ROTC Special Class attendance',
    status: 'Closed',
    createdBy: specialClassOfficer._id,
  });

  const specialClassAttendanceRows = specialClassCadetDemo.map((u, i) => {
    const status = i === specialClassCadetDemo.length - 1 ? 'Absent' : 'Present';
    return {
      sessionId: specialClassSession._id,
      activityId: specialClassActivity._id,
      brigadeId: null,
      studentId: u._id,
      program: 'ROTC',
      title: specialClassActivity.title,
      date: specialClassActivity.date,
      time:
        status === 'Absent'
          ? ''
          : formatTime12h(combineDateAndTime(specialClassActivity.date, specialClassActivity.startTime)),
      status,
      attendanceMethod: 'Manual',
      verified: true,
      remarks: '',
      recordedBy: specialClassOfficer._id,
    };
  });
  await Attendance.insertMany(specialClassAttendanceRows);
  await Promise.all(specialClassCadetDemo.map((u) => recalculateGrade(u._id, 'ROTC')));
  console.log(
    `[seed] ROTC Special Class demo activity + closed session created (${specialClassCadetDemo.length} cadets)`
  );

  // ============================================================
  // 10.7 CWTS SPECIAL CLASS DEMO DATA (activity + closed session)
  // ============================================================
  // Program-wide (brigadeId: null) and run by cwtsSpecialClassOfficer, not
  // the regular brigade officers — mirrors the ROTC block above.
  const specialClassStudentDemo = CWTS_SPECIAL_CLASS_DEMO_INDEXES.map((idx) => students[idx]);
  const cwtsSpecialClassActivity = await Activity.create({
    title: 'Special Class Community Orientation',
    description: 'Alternative-track session for trainees exempted from physically demanding community work.',
    program: 'CWTS',
    date: daysAgo(3),
    startTime: '09:00',
    endTime: '11:00',
    location: 'AVR Building',
    brigadeId: null,
    brigade: '',
    isSpecialClass: true,
    objectives: ['Orient trainees on alternative, classroom-based civic engagement work'],
    status: 'Completed',
    createdBy: cwtsSpecialClassOfficer._id,
  });

  const cwtsSpecialClassSession = await AttendanceSession.create({
    activityId: cwtsSpecialClassActivity._id,
    program: 'CWTS',
    brigadeId: null,
    brigade: '',
    isSpecialClass: true,
    title: cwtsSpecialClassActivity.title,
    date: cwtsSpecialClassActivity.date,
    startTime: cwtsSpecialClassActivity.startTime,
    endTime: cwtsSpecialClassActivity.endTime,
    startsAt: combineDateAndTime(cwtsSpecialClassActivity.date, cwtsSpecialClassActivity.startTime),
    endsAt: combineDateAndTime(cwtsSpecialClassActivity.date, cwtsSpecialClassActivity.endTime),
    sessionCode: `NSTP-CWTS-${crypto.randomBytes(9).toString('hex').toUpperCase()}`,
    notes: 'CWTS Special Class attendance',
    status: 'Closed',
    createdBy: cwtsSpecialClassOfficer._id,
  });

  const cwtsSpecialClassAttendanceRows = specialClassStudentDemo.map((u, i) => {
    const status = i === specialClassStudentDemo.length - 1 ? 'Absent' : 'Present';
    return {
      sessionId: cwtsSpecialClassSession._id,
      activityId: cwtsSpecialClassActivity._id,
      brigadeId: null,
      studentId: u._id,
      program: 'CWTS',
      title: cwtsSpecialClassActivity.title,
      date: cwtsSpecialClassActivity.date,
      time:
        status === 'Absent'
          ? ''
          : formatTime12h(combineDateAndTime(cwtsSpecialClassActivity.date, cwtsSpecialClassActivity.startTime)),
      status,
      attendanceMethod: 'Manual',
      verified: true,
      remarks: '',
      recordedBy: cwtsSpecialClassOfficer._id,
    };
  });
  await Attendance.insertMany(cwtsSpecialClassAttendanceRows);
  await Promise.all(specialClassStudentDemo.map((u) => recalculateGrade(u._id, 'CWTS')));
  console.log(
    `[seed] CWTS Special Class demo activity + closed session created (${specialClassStudentDemo.length} students)`
  );

  // ============================================================
  // 10.5 ATTENDANCE CONTESTS ("Contest this absence" flow)
  // ============================================================
  const contestRows = [];
  const contestedAttendanceIds = [];
  function findAbsentDoc(userId) {
    return insertedAttendance.find(
      (doc) =>
        String(doc.studentId) === String(userId) &&
        doc.status === 'Absent' &&
        !contestedAttendanceIds.includes(String(doc._id))
    );
  }

  const pendingContestDoc = findAbsentDoc(demoTrainee._id);
  if (pendingContestDoc) {
    contestedAttendanceIds.push(String(pendingContestDoc._id));
    contestRows.push({
      attendanceId: pendingContestDoc._id,
      studentId: demoTrainee._id,
      program: pendingContestDoc.program,
      brigadeId: pendingContestDoc.brigadeId,
      reason: 'I scanned the QR code at the venue but my attendance was not recorded. Please check the session logs.',
      status: 'Pending',
    });
  }

  const approvedContestDoc = approvedContestStudent ? findAbsentDoc(approvedContestStudent._id) : null;
  if (approvedContestDoc) {
    contestedAttendanceIds.push(String(approvedContestDoc._id));
    const reviewer = officerByBrigade.get(String(approvedContestDoc.brigadeId))?._id || cwtsOfficer._id;
    contestRows.push({
      attendanceId: approvedContestDoc._id,
      studentId: approvedContestStudent._id,
      program: approvedContestDoc.program,
      brigadeId: approvedContestDoc.brigadeId,
      reason: 'I was sick that day and submitted a medical certificate to my brigade officer.',
      attachmentName: 'Medical_Certificate.pdf',
      attachmentSize: 245_760,
      status: 'Approved',
      reviewedBy: reviewer,
      reviewNote: 'Verified with the submitted medical certificate.',
      reviewedAt: daysAgo(1),
    });
    // Mirrors what attendanceContestController.review() does on approval, so
    // the resulting Attendance record and grade stay consistent with a real
    // approved contest.
    approvedContestDoc.status = 'Excused';
    approvedContestDoc.remarks = 'Contest approved: Verified with the submitted medical certificate.';
    approvedContestDoc.recordedBy = reviewer;
  }

  const rejectedContestDoc = findAbsentDoc(atRiskCadets[0]._id);
  if (rejectedContestDoc) {
    contestedAttendanceIds.push(String(rejectedContestDoc._id));
    const reviewer = officerByBrigade.get(String(rejectedContestDoc.brigadeId))?._id || rotcOfficer._id;
    contestRows.push({
      attendanceId: rejectedContestDoc._id,
      studentId: atRiskCadets[0]._id,
      program: rejectedContestDoc.program,
      brigadeId: rejectedContestDoc.brigadeId,
      reason: 'I attended the training but was marked absent by mistake.',
      status: 'Rejected',
      reviewedBy: reviewer,
      reviewNote: 'No record of your attendance was found in the session log or roster.',
      reviewedAt: daysAgo(1),
    });
  }

  await AttendanceContest.insertMany(contestRows);
  if (approvedContestDoc) {
    await Attendance.updateOne(
      { _id: approvedContestDoc._id },
      {
        $set: {
          status: approvedContestDoc.status,
          remarks: approvedContestDoc.remarks,
          recordedBy: approvedContestDoc.recordedBy,
        },
      }
    );
  }
  console.log(`[seed] ${contestRows.length} attendance contests created`);

  // ============================================================
  // 11. SUBMISSIONS (+ grades on the older ones)
  // ============================================================
  const submissionRows = [];

  const cwtsModulesWithDeadline = modules.filter(
    (m) => m.program === 'CWTS' && m.deadline
  );
  const rotcModulesWithDeadline = modules.filter(
    (m) => m.program === 'ROTC' && m.deadline
  );

  function buildSubmissions(moduleList, roster, grader) {
    moduleList.forEach((module, mi) => {
      roster.forEach((user, si) => {
        const seed = (mi * 3 + si) % 10;
        if (seed === 4 || seed === 9) return; // no submission yet

        const graded = seed < 5;
        const score = graded ? 70 + ((si * 7 + mi * 3) % 26) : null;

        submissionRows.push({
          moduleId: module._id,
          studentId: user._id,
          fileUrl: '',
          fileName: `${module.title.replace(/\s+/g, '_')}_${user.studentId}.pdf`,
          fileSize: 1_258_291,
          comment: 'Attached is my output. Thank you!',
          submittedAt: daysAgo(3 + (si % 5)),
          status: graded ? 'Graded' : 'Submitted',
          score,
          totalPoints: 100,
          rubricScores: graded
            ? RUBRIC_TEMPLATE.map((r, ri) => ({
                title: r.title,
                points: r.points,
                score: Math.max(
                  0,
                  Math.min(r.points, Math.round((score / 100) * r.points) + (ri % 2 ? 1 : -1))
                ),
              }))
            : [],
          feedback: graded ? 'Good work. Expand more on your personal insights.' : '',
          gradedBy: graded ? grader : null,
          gradedAt: graded ? daysAgo(1 + (si % 3)) : null,
        });
      });
    });
  }

  // CWTS-program content is graded by admin_cwts, ROTC-program content by admin_rotc.
  buildSubmissions(cwtsModulesWithDeadline, students, adminCwts._id);
  buildSubmissions(rotcModulesWithDeadline, cadets, adminRotc._id);

  await Submission.insertMany(submissionRows);
  console.log(`[seed] ${submissionRows.length} submissions created`);

  // ============================================================
  // 12. GRADES (computed from the seeded data, never invented)
  // ============================================================
  // Also where the automatic 4-absence drop actually fires (see
  // utils/gradeCalculator.js) — toBeDroppedStudent/toBeDroppedCadet above
  // become Dropped for real here, not via a hardcoded status.
  await mapWithConcurrency(students, 20, (s) => recalculateGrade(s._id, 'CWTS', adminCwts._id));
  await mapWithConcurrency(cadets, 20, (c) => recalculateGrade(c._id, 'ROTC', adminRotc._id));
  console.log(`[seed] ${students.length + cadets.length} grade records computed`);

  // ============================================================
  // 13. DOCUMENTS
  // ============================================================
  const documentRows = [];
  [...students, ...cadets].forEach((user, ui) => {
    REQUIRED_DOCUMENTS.forEach((title, di) => {
      const uploaded = (ui + di) % 4 !== 0;
      documentRows.push({
        ownerId: user._id,
        title,
        fileName: uploaded ? `${title.replace(/\s+/g, '_')}.pdf` : '',
        fileSize: uploaded ? 524_288 : 0,
        isUploaded: uploaded,
        status: uploaded
          ? di % 3 === 0
            ? 'Approved'
            : 'Under Review'
          : 'Awaiting Approval',
        uploadedAt: uploaded ? daysAgo(15 - di) : null,
      });
    });
  });
  await DocumentModel.insertMany(documentRows);
  console.log(`[seed] ${documentRows.length} documents created`);

  // ============================================================
  // 13.5 CERTIFICATE REQUESTS
  // ============================================================
  const certificateRows = [];
  function buildCertificateRequests(roster, grader) {
    roster.forEach((user, i) => {
      const type = pick(CERTIFICATE_TYPES, i);
      const cycle = i % 3;
      const status = cycle === 0 ? 'Pending' : cycle === 1 ? 'Approved' : 'Rejected';
      certificateRows.push({
        studentId: user._id,
        program: user.program,
        brigadeId: user.brigadeId || null,
        type,
        purpose: 'For submission to my scholarship application.',
        status,
        certificateName:
          status === 'Approved' ? `${type.replace(/\s+/g, '_')}_${user.studentId}.pdf` : '',
        certificateSize: status === 'Approved' ? 312_440 : 0,
        reviewedBy: status === 'Pending' ? null : grader,
        reviewNote:
          status === 'Approved'
            ? 'Approved and signed by the program coordinator.'
            : status === 'Rejected'
              ? 'Incomplete training hours on record.'
              : '',
        reviewedAt: status === 'Pending' ? null : daysAgo(2 + (i % 4)),
      });
    });
  }
  buildCertificateRequests(students, adminCwts._id);
  buildCertificateRequests(cadets, adminRotc._id);

  await CertificateRequest.insertMany(certificateRows);
  console.log(`[seed] ${certificateRows.length} certificate requests created`);

  // ============================================================
  // 13.6 NSTP MASTERLIST (gates self-registration, shared by both programs)
  // ============================================================
  // A masterlist entry represents someone who is ENROLLED but has not yet
  // created a portal account — that's the entire point of the gate: they
  // fill in Student Number/Name/Course, get matched against a row here, and
  // only then can they set an email/password. So this list is deliberately
  // a WHOLLY SEPARATE batch of people from the 360 students/cadets already
  // seeded with full accounts above — every row here should show up as
  // "Open" in the admin panel, never "Registered". Not split by CWTS/ROTC —
  // a real registrar's "who's enrolled in NSTP this term" list doesn't
  // pre-assign a component; the trainee picks CWTS or ROTC themselves on the
  // app's first screen, and the same row is checked either way (see
  // authController.validateEnrollment / .register).
  const MASTERLIST_SIZE = 50;
  const MASTERLIST_SECTIONS = ['A', 'B', 'C'];
  // Offset past every combo index already spent on the real trainees'
  // generated names (CWTS + ROTC, see section 5/6 above) so these people
  // never happen to share a name with an already-registered trainee.
  const MASTERLIST_NAME_OFFSET = (TOTAL_CWTS_STUDENTS - STUDENT_NAMES.length) + (TOTAL_ROTC_CADETS - CADET_NAMES.length);
  // CWTS is now college-level and ROTC stays course-level, so a single code
  // no longer resolves under both programs the way it used to — pool from
  // both lists so every masterlist row still matches whichever program
  // (CWTS or ROTC) the code actually belongs to.
  const MASTERLIST_COURSE_POOL = [...CWTS_COURSES, ...ROTC_COURSES];
  // Every CWTS college has one fixed campus — keep a masterlist row's campus
  // consistent with its course the same way a real registrar export would be,
  // instead of picking it independently. ROTC rows have no fixed campus, so
  // they still get one picked from the general pool.
  const CWTS_CAMPUS_BY_CODE = new Map(CWTS_PROGRAM_SEEDS.map((p) => [p.code, p.campus]));
  const masterlistRows = [];
  for (let i = 0; i < MASTERLIST_SIZE; i += 1) {
    const fullName = generateFullName(MASTERLIST_NAME_OFFSET + i);
    const [first, ...rest] = fullName.split(' ');
    const emailLocal = `${first}.${rest.join('')}`.toLowerCase().replace(/[^a-z.]/g, '');
    const courseProgram = pick(MASTERLIST_COURSE_POOL, i);
    masterlistRows.push({
      studentNumber: `24NS${String(i + 1).padStart(3, '0')}`,
      fullName,
      email: `${emailLocal}@marsu.edu.ph`,
      courseProgram,
      campus: CWTS_CAMPUS_BY_CODE.get(courseProgram) || pick(CAMPUSES, i),
      academicYear: pick(YEARS, i),
      section: pick(MASTERLIST_SECTIONS, i),
    });
  }

  await Masterlist.insertMany(masterlistRows);
  console.log(
    `[seed] ${masterlistRows.length} NSTP masterlist entries created (all Open/unregistered — shared by CWTS + ROTC)`
  );

  // ============================================================
  // 14. NOTIFICATIONS
  // ============================================================
  const notificationRows = [];
  [...students, ...cadets].forEach((user, ui) => {
    const program = user.program;
    const relevant = announcements.filter(
      (a) => a.program === program || a.program === 'All'
    );

    relevant.slice(0, 3).forEach((a, i) => {
      notificationRows.push({
        recipientId: user._id,
        title: a.title,
        message: a.content,
        type: 'announcement',
        data: { announcementId: a._id },
        isRead: (ui + i) % 3 === 0,
      });
    });

    notificationRows.push({
      recipientId: user._id,
      title: 'Attendance recorded',
      message: 'Your attendance for the last session has been recorded.',
      type: 'attendance',
      isRead: ui % 2 === 0,
    });

    notificationRows.push({
      recipientId: user._id,
      title: 'Submission graded',
      message: 'One of your submissions has been graded. Check your grades page.',
      type: 'grade',
      isRead: false,
    });
  });

  officers.concat([adminCwts, adminRotc]).forEach((user) => {
    notificationRows.push({
      recipientId: user._id,
      title: 'New submissions to grade',
      message: 'There are submissions waiting for your review.',
      type: 'submission',
      isRead: false,
    });
  });

  await Notification.insertMany(notificationRows);
  console.log(`[seed] ${notificationRows.length} notifications created`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log(' SEED COMPLETE');
  console.log('========================================');
  console.log(` Roster: ${students.length} CWTS students (30/college) + ${cadets.length} ROTC cadets (30/company).`);
  console.log(' Test accounts (all passwords are case-sensitive):');
  console.log('   admin@nstp.test           / Admin123        (super_admin)');
  console.log('   sysmaint@nstp.test        / SysMaint123     (system_maintenance_admin)');
  console.log('   admin.cwts@nstp.test      / AdminCWTS123    (admin_cwts)');
  console.log('   admin.rotc@nstp.test      / AdminROTC123    (admin_rotc)');
  console.log('   officer.cwts@nstp.test    / OfficerCWTS@123 (CWTS officer, Brigade Makakalikasan)');
  console.log('   officer.rotc@nstp.test    / OfficerROTC123  (ROTC officer, Alpha Company)');
  console.log('   student.cwts@nstp.test    / StudentCWTS123  (CWTS trainee, ID 23BI471)');
  console.log('   cadet.rotc@nstp.test      / CadetROTC123    (ROTC cadet,   ID 23RC101)');
  console.log('');
  console.log(' CWTS programs → brigades:');
  CWTS_PROGRAM_SEEDS.forEach((p) => console.log(`   ${p.code.padEnd(8)} -> ${p.brigade || '(unconfigured)'}`));
  console.log(' ROTC programs → brigades:');
  ROTC_PROGRAM_SEEDS.forEach((p) => console.log(`   ${p.code.padEnd(8)} -> ${p.brigade}`));
  console.log('');
  console.log(' Trainees can also log in with their student/cadet ID.');
  console.log(` Live QR test code: ${liveSession.sessionCode}`);
  console.log('');
  console.log(' Demo scenarios seeded for every dashboard (admin, officer, trainee):');
  const rotcOfficerBrigadeName =
    rotcPrograms.find((p) => String(p.brigade._id) === String(rotcOfficer.brigadeId))?.brigade.name || '';
  console.log(`   At-risk (3/4 absences): ${atRiskStudents.length} CWTS students (Brigade Makakalikasan) + ${atRiskCadets.length} ROTC cadets (${rotcOfficerBrigadeName})`);
  console.log(`   Auto-dropped (4/4 absences, real business logic): ${toBeDroppedStudent.name} (${toBeDroppedStudent.studentId}) / ${toBeDroppedCadet.name} (${toBeDroppedCadet.studentId})`);
  console.log(`   Pending absence contest: ${demoTrainee.name} (student.cwts@nstp.test)`);
  if (approvedContestStudent) {
    console.log(`   Approved absence contest: ${approvedContestStudent.name} (${approvedContestStudent.studentId})`);
  }
  console.log('   Approved + Rejected absence contests also seeded (1 each).');
  console.log('   Certificate requests seeded for every trainee (mix of Pending/Approved/Rejected).');
  console.log('');
  console.log(' ROTC Special Class track (PWD/Medical Condition, exempt from field training):');
  console.log(`   Officer: ${specialClassOfficer.name} (${specialClassOfficer.email} / OfficerROTC123)`);
  console.log(
    `   Cadets: ${specialClassCadetDemo.map((c) => `${c.name} (${c.studentId})`).join(', ')}`
  );
  console.log('   1 demo Special Class activity + closed attendance session already seeded.');
  console.log('');
  console.log(' CWTS Special Class track (PWD/Medical Condition, exempt from field work):');
  console.log(`   Officer: ${cwtsSpecialClassOfficer.name} (${cwtsSpecialClassOfficer.email} / OfficerCWTS123)`);
  console.log(
    `   Students: ${specialClassStudentDemo.map((s) => `${s.name} (${s.studentId})`).join(', ')}`
  );
  console.log('   1 demo Special Class activity + closed attendance session already seeded.');
  console.log('');
  console.log(' NSTP masterlist (shared self-registration gate for CWTS + ROTC):');
  console.log(`   ${masterlistRows.length} entries, all Open/unregistered — nobody here has an account`);
  console.log('   yet, same list checked no matter which program a trainee picks on the first');
  console.log('   screen. Try these in the app (in the course dropdown, pick the full name');
  console.log('   shown for whichever program the row\'s code belongs to — CWTS dropdowns list');
  console.log('   colleges (e.g. CICS = "College of Information and Computing Sciences"), ROTC');
  console.log('   dropdowns list courses (e.g. BSIT = "BS Information Technology")):');
  const okRow = masterlistRows[0];
  const badRow = masterlistRows[masterlistRows.length - 1];
  console.log(`     ${okRow.studentNumber} / ${okRow.fullName} / ${okRow.courseProgram}   (Active — registration should succeed)`);
  console.log(`     ${badRow.studentNumber} / ${badRow.fullName} / ${badRow.courseProgram}   (Inactive — rejected: enrollment status)`);
  console.log('   Any Student Number not on the list is rejected; a real Student Number with');
  console.log('   the wrong name or course is rejected too (Information/Course Mismatch).');
  console.log('========================================\n');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
