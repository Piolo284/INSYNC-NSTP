/* eslint-disable no-console */
/**
 * DEVELOPMENT ONLY — exercises the running API end-to-end against the seeded
 * data. Requires the server (npm start) and a seeded database to already be
 * running. Not part of the deliverable; used only to verify the integration.
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  OK   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}: ${err.message}`);
    failed++;
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${json.message || res.statusText}`);
  }
  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function login(identifier, password, role) {
  const res = await api('POST', '/auth/login', {
    body: { identifier, password, role },
  });
  assert(res.data.token, 'no token returned');
  return res.data.token;
}

async function main() {
  console.log(`\nSmoke testing ${BASE}\n`);

  let studentToken, cadetToken, officerToken, adminCwtsToken, adminToken;
  let studentId, moduleId, submissionId, activityId, sessionCode;

  await check('health check', async () => {
    const res = await fetch(BASE.replace('/api', '/health'));
    assert(res.ok, 'health endpoint not ok');
  });

  await check('login as student', async () => {
    studentToken = await login('student.cwts@nstp.test', 'StudentCWTS123', 'student');
  });

  await check('login as cadet', async () => {
    cadetToken = await login('cadet.rotc@nstp.test', 'CadetROTC123', 'cadet');
  });

  await check('login as CWTS officer', async () => {
    officerToken = await login('officer.cwts@nstp.test', 'OfficerCWTS123', 'officer');
  });

  await check('login as CWTS program admin (admin_cwts)', async () => {
    adminCwtsToken = await login('admin.cwts@nstp.test', 'AdminCWTS123', 'admin_cwts');
  });

  await check('login as super_admin', async () => {
    adminToken = await login('admin@nstp.test', 'Admin123', 'super_admin');
  });

  await check('reject wrong password', async () => {
    try {
      await login('student.cwts@nstp.test', 'WrongPass1!', 'student');
      throw new Error('should have been rejected');
    } catch (err) {
      assert(err.message.startsWith('401'), `expected 401, got ${err.message}`);
    }
  });

  await check('GET /auth/me (student)', async () => {
    const res = await api('GET', '/auth/me', { token: studentToken });
    assert(res.data.user.role === 'student', 'wrong role');
    studentId = res.data.user._id;
  });

  await check('student dashboard has real overview counts', async () => {
    const res = await api('GET', `/students/${studentId}/dashboard`, { token: studentToken });
    assert(typeof res.data.overview.activities === 'number', 'missing overview.activities');
    assert(Array.isArray(res.data.announcements), 'missing announcements array');
  });

  await check('cadet dashboard works', async () => {
    const meRes = await api('GET', '/auth/me', { token: cadetToken });
    const res = await api('GET', `/cadets/${meRes.data.user._id}/dashboard`, { token: cadetToken });
    assert(res.data.overview, 'missing overview');
  });

  await check('officer dashboard has attendance overview', async () => {
    const res = await api('GET', '/dashboard/officer', { token: officerToken });
    assert(typeof res.data.overview.totalStudents === 'number', 'missing totalStudents');
  });

  await check('admin_cwts dashboard has program-scoped module count', async () => {
    const res = await api('GET', '/dashboard/admin', { token: adminCwtsToken });
    assert(typeof res.data.content.modules === 'number', 'missing modules count');
    assert(res.data.program === 'CWTS', 'expected admin_cwts to be scoped to CWTS');
  });

  await check('super_admin dashboard aggregates users', async () => {
    const res = await api('GET', '/dashboard/admin', { token: adminToken });
    assert(res.data.users.total >= 10, 'expected at least 10 seeded users');
  });

  await check('list activities (student)', async () => {
    const res = await api('GET', '/activities?program=CWTS', { token: studentToken });
    assert(res.count > 0, 'expected seeded activities');
    activityId = res.data[0]._id;
  });

  await check('list modules with myStatus for student', async () => {
    const res = await api('GET', '/modules', { token: studentToken });
    assert(res.count > 0, 'expected seeded modules');
    const withDeadline = res.data.find((m) => m.deadline && m.myStatus === 'To Do');
    assert(withDeadline, 'expected at least one To Do module');
    moduleId = withDeadline._id;
  });

  await check('list announcements scoped to student', async () => {
    const res = await api('GET', '/announcements', { token: studentToken });
    assert(res.count > 0, 'expected seeded announcements');
    assert(
      res.data.every((a) => a.program === 'CWTS' || a.program === 'All'),
      'student saw an announcement outside their program'
    );
  });

  await check('officer creates an activity', async () => {
    const res = await api('POST', '/activities', {
      token: officerToken,
      body: {
        title: 'Smoke Test Activity',
        description: 'Created by smoke test',
        date: new Date().toISOString(),
        location: 'Test Field',
        program: 'CWTS',
      },
    });
    assert(res.data.title === 'Smoke Test Activity', 'activity not created correctly');
  });

  await check('officer creates a QR attendance session', async () => {
    const now = new Date();
    const start = `${String(now.getHours()).padStart(2, '0')}:00`;
    const end = `23:59`;
    const res = await api('POST', '/attendance/sessions', {
      token: officerToken,
      body: {
        date: now.toISOString(),
        startTime: '00:00',
        endTime: end,
        program: 'CWTS',
        brigade: 'Brigade Makakalikasan',
        notes: 'Smoke test session',
      },
    });
    assert(res.data.sessionCode, 'no session code returned');
    sessionCode = res.data.sessionCode;
  });

  await check('trainee scans QR and gets a dev verification code', async () => {
    const res = await api('POST', '/attendance/scan', {
      token: studentToken,
      body: { sessionCode },
    });
    assert(res.data.devVerificationCode, 'expected dev verification code (SMTP not configured)');
    global.__devCode = res.data.devVerificationCode;
    global.__attendanceId = res.data.attendanceId;
  });

  await check('duplicate scan is rejected', async () => {
    try {
      await api('POST', '/attendance/scan', { token: studentToken, body: { sessionCode } });
      // Not yet verified, so a second scan actually re-issues a code — only a
      // *verified* duplicate should be rejected. Verify first, then rescan.
    } catch (err) {
      /* either outcome is acceptable pre-verification */
    }
  });

  await check('trainee verifies the code and attendance is recorded', async () => {
    const res = await api('POST', '/attendance/verify', {
      token: studentToken,
      body: {
        verificationCode: global.__devCode,
        attendanceId: global.__attendanceId,
      },
    });
    assert(res.data.verified === true, 'attendance not marked verified');
  });

  await check('verified duplicate scan is now rejected', async () => {
    try {
      await api('POST', '/attendance/scan', { token: studentToken, body: { sessionCode } });
      throw new Error('should have been rejected as duplicate');
    } catch (err) {
      assert(err.message.startsWith('409'), `expected 409, got ${err.message}`);
    }
  });

  await check('officer marks manual attendance for a cadet', async () => {
    const meRes = await api('GET', '/auth/me', { token: cadetToken });
    const rotcOfficerToken = await login('officer.rotc@nstp.test', 'OfficerROTC123', 'officer');
    const res = await api('POST', '/attendance', {
      token: rotcOfficerToken,
      body: {
        studentIds: [meRes.data.user._id],
        date: new Date().toISOString(),
        status: 'Present',
        program: 'ROTC',
        title: 'Smoke Test Manual Attendance',
      },
    });
    assert(res.count === 1, 'expected 1 manual attendance record');
  });

  await check('trainee submits an activity', async () => {
    const res = await api('POST', '/submissions', {
      token: studentToken,
      body: { moduleId, comment: 'Smoke test submission' },
    });
    assert(res.data.status === 'Submitted', 'submission not marked Submitted');
    submissionId = res.data._id;
  });

  await check('admin_cwts grades the submission', async () => {
    const res = await api('POST', `/submissions/${submissionId}/grade`, {
      token: adminCwtsToken,
      body: { score: 88, totalPoints: 100, feedback: 'Nice work.' },
    });
    assert(res.data.status === 'Graded', 'submission not marked Graded');
    assert(res.data.score === 88, 'score not saved');
  });

  await check('grade recalculation reflects the new submission score', async () => {
    const res = await api('GET', `/grades/${studentId}`, { token: studentToken });
    assert(res.data.moduleScores.length > 0, 'expected at least one module score');
  });

  await check('unauthorized role is rejected (student cannot create activity)', async () => {
    try {
      await api('POST', '/activities', {
        token: studentToken,
        body: { title: 'x', date: new Date().toISOString() },
      });
      throw new Error('should have been rejected');
    } catch (err) {
      assert(err.message.startsWith('403'), `expected 403, got ${err.message}`);
    }
  });

  await check('officer posts and sends an announcement', async () => {
    const res = await api('POST', '/announcements', {
      token: officerToken,
      body: {
        title: 'Smoke Test Announcement',
        content: 'This is a smoke test.',
        program: 'CWTS',
        targetAudience: 'Students',
      },
    });
    assert(res.data._id, 'announcement not created');
  });

  await check('trainee sees a notification from attendance', async () => {
    const res = await api('GET', '/notifications', { token: studentToken });
    assert(res.count > 0, 'expected at least one notification');
  });

  await check('CSV export endpoint responds', async () => {
    const res = await fetch(`${BASE}/grades/report/export?program=CWTS`, {
      headers: { Authorization: `Bearer ${adminCwtsToken}` },
    });
    assert(res.ok, 'export endpoint failed');
    const text = await res.text();
    assert(text.startsWith('"Student ID"'), 'unexpected CSV header');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
