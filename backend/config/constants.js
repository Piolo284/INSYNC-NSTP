/**
 * Shared enums + tunables. Everything that a school might want to change
 * (grading weights, passing marks, late grace period) reads from .env so the
 * values can be adjusted without touching code.
 */

const ROLES = ['student', 'cadet', 'officer', 'instructor', 'admin'];
const PROGRAMS = ['CWTS', 'ROTC'];
const USER_STATUSES = ['Active', 'Inactive', 'Dropped', 'Pending'];

const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Excused'];
const ATTENDANCE_METHODS = ['QR', 'Manual'];

const SUBMISSION_STATUSES = ['To Do', 'Submitted', 'Graded', 'Missing'];

const TARGET_AUDIENCES = ['All', 'Students', 'Cadets', 'Officers', 'Instructors'];

const SESSION_STATUSES = ['Active', 'Closed', 'Cancelled'];

const NOTIFICATION_TYPES = [
  'announcement',
  'attendance',
  'submission',
  'grade',
  'module',
  'activity',
  'system',
];

function num(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
}

/** Grading structure kept identical to what the Flutter screens already show. */
const grading = () => ({
  weights: {
    modules: num('GRADE_WEIGHT_MODULES', 30),
    activities: num('GRADE_WEIGHT_ACTIVITIES', 40),
    attendance: num('GRADE_WEIGHT_ATTENDANCE', 30),
  },
  passing: num('GRADE_PASSING', 75),
  warning: num('GRADE_WARNING', 70),
});

const attendanceRules = () => ({
  lateGraceMinutes: num('ATTENDANCE_LATE_GRACE_MINUTES', 15),
  codeTtlMinutes: num('ATTENDANCE_CODE_TTL_MINUTES', 15),
});

module.exports = {
  ROLES,
  PROGRAMS,
  USER_STATUSES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS,
  SUBMISSION_STATUSES,
  TARGET_AUDIENCES,
  SESSION_STATUSES,
  NOTIFICATION_TYPES,
  grading,
  attendanceRules,
};
