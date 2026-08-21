/* eslint-disable no-console */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Officer = require('../models/Officer');
const Instructor = require('../models/Instructor');
const Activity = require('../models/Activity');
const ModuleModel = require('../models/Module');
const Announcement = require('../models/Announcement');
const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const Submission = require('../models/Submission');
const DocumentModel = require('../models/Document');
const Notification = require('../models/Notification');
const Grade = require('../models/Grade');

const { recalculateGrade } = require('../utils/gradeCalculator');
const { startOfDay, combineDateAndTime, formatTime12h } = require('../utils/datetime');

// ---------- deterministic helpers ----------
const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (n) => startOfDay(new Date(Date.now() - n * 86400000));
const daysAhead = (n) => startOfDay(new Date(Date.now() + n * 86400000));

const COURSES = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Criminology',
  'BS Education',
  'BS Business Administration',
  'BS Nursing',
];
const SHORT_COURSES = ['BSIT', 'BSCS', 'BSCrim', 'BSEd', 'BSBA', 'BSN'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const CWTS_BRIGADES = ['Brigade Makakalikasan', 'Brigade Kalikasan', 'Brigade Masipag'];
const ROTC_COMPANIES = ['Alpha Company', 'Bravo Company', 'Charlie Company'];
const ROTC_PLATOONS = ['1st Platoon', '2nd Platoon', '3rd Platoon'];

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
    Instructor.deleteMany({}),
    Activity.deleteMany({}),
    ModuleModel.deleteMany({}),
    Announcement.deleteMany({}),
    AttendanceSession.deleteMany({}),
    Attendance.deleteMany({}),
    Submission.deleteMany({}),
    DocumentModel.deleteMany({}),
    Notification.deleteMany({}),
    Grade.deleteMany({}),
  ]);
}

async function seed() {
  await connectDatabase();
  await wipe();

  // ============================================================
  // 1. ADMIN
  // ============================================================
  const admin = await User.create({
    name: 'System Administrator',
    email: 'admin@nstp.test',
    password: 'Admin123',
    role: 'admin',
    studentId: 'ADMIN-001',
    status: 'Active',
  });
  console.log('[seed] admin created');

  // ============================================================
  // 2. INSTRUCTORS (2)
  // ============================================================
  const instructorSeeds = [
    {
      name: 'Lorenz D. Manalo',
      email: 'instructor@nstp.test',
      employeeId: 'INS-001',
      program: 'CWTS',
      sections: ['CWTS 1 - A', 'CWTS 1 - B'],
    },
    {
      name: 'Ramon C. Villanueva',
      email: 'instructor.rotc@nstp.test',
      employeeId: 'INS-002',
      program: 'ROTC',
      sections: ['ROTC 1 - A'],
    },
  ];

  const instructors = [];
  for (const s of instructorSeeds) {
    const user = await User.create({
      name: s.name,
      email: s.email,
      password: 'Instructor123',
      role: 'instructor',
      studentId: s.employeeId,
      program: s.program,
      status: 'Active',
    });
    await Instructor.create({
      userId: user._id,
      employeeId: s.employeeId,
      fullName: s.name,
      email: s.email,
      program: s.program,
      department: 'NSTP Office',
      sections: s.sections,
      contactNumber: '09171234567',
    });
    instructors.push(user);
  }
  console.log(`[seed] ${instructors.length} instructors created`);

  // ============================================================
  // 3. OFFICERS (3 CWTS + 3 ROTC)
  // ============================================================
  const officerSeeds = [
    { name: 'Piolo M. Privado', email: 'officer.cwts@nstp.test', id: 'OFF-C01', program: 'CWTS' },
    { name: 'Ana Marie Garcia', email: 'officer.cwts2@nstp.test', id: 'OFF-C02', program: 'CWTS' },
    { name: 'Mark Anthony Cruz', email: 'officer.cwts3@nstp.test', id: 'OFF-C03', program: 'CWTS' },
    { name: 'Bernard S. Tolentino', email: 'officer.rotc@nstp.test', id: 'OFF-R01', program: 'ROTC' },
    { name: 'Katrina L. Bautista', email: 'officer.rotc2@nstp.test', id: 'OFF-R02', program: 'ROTC' },
    { name: 'Dennis P. Ocampo', email: 'officer.rotc3@nstp.test', id: 'OFF-R03', program: 'ROTC' },
  ];

  const officers = [];
  for (let i = 0; i < officerSeeds.length; i += 1) {
    const s = officerSeeds[i];
    const user = await User.create({
      name: s.name,
      email: s.email,
      password: 'Officer123',
      role: 'officer',
      studentId: s.id,
      program: s.program,
      status: 'Active',
    });
    await Officer.create({
      userId: user._id,
      officerId: s.id,
      fullName: s.name,
      email: s.email,
      program: s.program,
      position: i % 3 === 0 ? 'Head Officer' : 'Officer',
      brigade:
        s.program === 'CWTS' ? pick(CWTS_BRIGADES, i) : pick(ROTC_COMPANIES, i),
      contactNumber: '09181234567',
    });
    officers.push(user);
  }
  const cwtsOfficer = officers[0];
  const rotcOfficer = officers[3];
  console.log(`[seed] ${officers.length} officers created`);

  // ============================================================
  // 4. STUDENTS (10 CWTS)
  // ============================================================
  const students = [];
  for (let i = 0; i < STUDENT_NAMES.length; i += 1) {
    const name = STUDENT_NAMES[i];
    const studentId = `23BI${471 + i}`;
    const email = i === 0 ? 'student@nstp.test' : `student${i + 1}@nstp.test`;

    const user = await User.create({
      name,
      email,
      password: 'Student123',
      role: 'student',
      studentId,
      program: 'CWTS',
      yearLevel: pick(YEARS, i),
      section: `CWTS 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
      contactNumber: `0910312226${i}`,
      status: i === 7 ? 'Dropped' : 'Active',
    });

    await Student.create({
      userId: user._id,
      studentId,
      fullName: name,
      email,
      program: 'CWTS',
      course: pick(SHORT_COURSES, i),
      yearLevel: pick(YEARS, i),
      section: `CWTS 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
      brigade: pick(CWTS_BRIGADES, i),
      contactNumber: `0910312226${i}`,
      address: 'Butansapa, Mogpog, Marinduque - 4901',
      emergencyContact: 'Eleanor Privado (Mother) - 09989251333',
      status: i === 7 ? 'Dropped' : 'Active',
    });

    students.push(user);
  }
  console.log(`[seed] ${students.length} students created`);

  // ============================================================
  // 5. CADETS (10 ROTC)
  // ============================================================
  const cadets = [];
  for (let i = 0; i < CADET_NAMES.length; i += 1) {
    const name = CADET_NAMES[i];
    const cadetId = `23RC${101 + i}`;
    const email = i === 0 ? 'cadet@nstp.test' : `cadet${i + 1}@nstp.test`;

    const user = await User.create({
      name,
      email,
      password: 'Cadet123',
      role: 'cadet',
      studentId: cadetId,
      program: 'ROTC',
      yearLevel: pick(YEARS, i),
      section: `ROTC 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
      contactNumber: `0920312226${i}`,
      status: 'Active',
    });

    await Cadet.create({
      userId: user._id,
      cadetId,
      fullName: name,
      email,
      program: 'ROTC',
      course: pick(SHORT_COURSES, i),
      platoon: pick(ROTC_PLATOONS, i),
      company: pick(ROTC_COMPANIES, i),
      brigade: 'Brigade Katihan',
      yearLevel: pick(YEARS, i),
      section: `ROTC 1 - ${i % 2 === 0 ? 'A' : 'B'}`,
      contactNumber: `0920312226${i}`,
      address: 'Boac, Marinduque - 4900',
      emergencyContact: 'Corazon Luna (Mother) - 09981112222',
      status: 'Active',
    });

    cadets.push(user);
  }
  console.log(`[seed] ${cadets.length} cadets created`);

  // ============================================================
  // 6. ACTIVITIES (10 total)
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
        brigade: pick(CWTS_BRIGADES, i),
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
    const isPast = i < 2;
    activities.push(
      await Activity.create({
        title,
        description,
        program: 'ROTC',
        date: isPast ? daysAgo((2 - i) * 7) : daysAhead(6),
        startTime: '06:00',
        endTime: '10:00',
        location,
        brigade: 'Brigade Katihan',
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
  console.log(`[seed] ${activities.length} activities created`);

  // ============================================================
  // 7. MODULES (10 total, with deadlines + rubrics)
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
        createdBy: instructors[0]._id,
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
        createdBy: instructors[1]._id,
      })
    );
  }
  console.log(`[seed] ${modules.length} modules created`);

  // ============================================================
  // 8. ANNOUNCEMENTS (10 total)
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
    ['Faculty Meeting', 'All NSTP instructors are requested to attend the monthly coordination meeting.', 'All', 'Instructors', 'NSTP Office', false],
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
  // 9. ATTENDANCE SESSIONS + RECORDS
  // ============================================================
  const pastCwtsActivities = activities.filter(
    (a) => a.program === 'CWTS' && a.status === 'Completed'
  );
  const pastRotcActivities = activities.filter(
    (a) => a.program === 'ROTC' && a.status === 'Completed'
  );

  const sessions = [];
  const attendanceRows = [];

  async function seedSessionFor(activity, roster, createdBy) {
    const session = await AttendanceSession.create({
      activityId: activity._id,
      program: activity.program,
      brigade: activity.brigade,
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

    for (let i = 0; i < roster.length; i += 1) {
      const user = roster[i];
      // Deterministic mix so the dashboards show meaningful numbers.
      const seed = (i + activity.title.length) % 10;
      let status = 'Present';
      if (seed === 3) status = 'Absent';
      else if (seed === 5) status = 'Late';
      else if (seed === 8) status = 'Excused';

      attendanceRows.push({
        sessionId: session._id,
        activityId: activity._id,
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
    }
  }

  for (const activity of pastCwtsActivities) {
    await seedSessionFor(activity, students, cwtsOfficer._id);
  }
  for (const activity of pastRotcActivities) {
    await seedSessionFor(activity, cadets, rotcOfficer._id);
  }

  // One session that is open right now, so QR scanning can be tested live.
  const liveActivity = activities.find(
    (a) => a.program === 'CWTS' && a.status === 'Upcoming'
  );
  const now = new Date();
  const liveSession = await AttendanceSession.create({
    activityId: liveActivity ? liveActivity._id : null,
    program: 'CWTS',
    brigade: 'Brigade Makakalikasan',
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

  await Attendance.insertMany(attendanceRows);
  console.log(
    `[seed] ${sessions.length} attendance sessions, ${attendanceRows.length} attendance records created`
  );

  // ============================================================
  // 10. SUBMISSIONS (+ grades on the older ones)
  // ============================================================
  const gradedByInstructor = instructors[0]._id;
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

  buildSubmissions(cwtsModulesWithDeadline, students, gradedByInstructor);
  buildSubmissions(rotcModulesWithDeadline, cadets, instructors[1]._id);

  await Submission.insertMany(submissionRows);
  console.log(`[seed] ${submissionRows.length} submissions created`);

  // ============================================================
  // 11. GRADES (computed from the seeded data, never invented)
  // ============================================================
  for (const s of students) {
    await recalculateGrade(s._id, 'CWTS', gradedByInstructor);
  }
  for (const c of cadets) {
    await recalculateGrade(c._id, 'ROTC', instructors[1]._id);
  }
  console.log(`[seed] ${students.length + cadets.length} grade records computed`);

  // ============================================================
  // 12. DOCUMENTS
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
  // 13. NOTIFICATIONS
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

  officers.concat(instructors).forEach((user) => {
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
  console.log(' Test accounts (all passwords are case-sensitive):');
  console.log('   admin@nstp.test           / Admin123       (admin)');
  console.log('   instructor@nstp.test      / Instructor123  (CWTS instructor)');
  console.log('   instructor.rotc@nstp.test / Instructor123  (ROTC instructor)');
  console.log('   officer.cwts@nstp.test    / Officer123     (CWTS officer)');
  console.log('   officer.rotc@nstp.test    / Officer123     (ROTC officer)');
  console.log('   student@nstp.test         / Student123     (CWTS trainee, ID 23BI471)');
  console.log('   cadet@nstp.test           / Cadet123       (ROTC cadet,   ID 23RC101)');
  console.log('');
  console.log(' Trainees can also log in with their student/cadet ID.');
  console.log(` Live QR test code: ${liveSession.sessionCode}`);
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
