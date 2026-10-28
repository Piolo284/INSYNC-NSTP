/**
 * Shared enums + tunables. Everything that a school might want to change
 * (grading weights, passing marks, late grace period) reads from .env so the
 * values can be adjusted without touching code.
 */

const ROLES = ['student', 'cadet', 'officer', 'admin_cwts', 'admin_rotc', 'super_admin', 'system_maintenance_admin'];
const PROGRAMS = ['CWTS', 'ROTC'];
const USER_STATUSES = ['Active', 'Inactive', 'Dropped', 'Pending', 'Completed'];
/**
 * Student/Cadet (trainee) status is intentionally narrower than the general
 * USER_STATUSES: a trainee's attendance-based workflow only ever has two
 * real states — Active, or auto/manually Dropped — unlike officers/admins,
 * who still use the fuller USER_STATUSES range (e.g. 'Inactive' for
 * deactivating an account without deleting it, see officerController.js).
 */
const TRAINEE_STATUSES = ['Active', 'Dropped'];

/** Roles that administer exactly one program (CWTS or ROTC), never both. */
const PROGRAM_ADMIN_ROLES = ['admin_cwts', 'admin_rotc'];
/** Every role with admin-level rights, program-scoped or system-wide. */
const ADMIN_ROLES = ['admin_cwts', 'admin_rotc', 'super_admin'];
/** Non-trainee roles — centralizes what used to be hand-typed per file. */
const STAFF_ROLES = ['officer', 'admin_cwts', 'admin_rotc', 'super_admin'];
/** Trainee roles — unchanged. */
const TRAINEE_ROLES = ['student', 'cadet'];
/**
 * Technical-maintenance-only role — deliberately kept out of every array
 * above. It must never inherit NSTP-data visibility (STAFF_ROLES/ADMIN_ROLES
 * gate that everywhere), so its access is granted purely by listing it on
 * the specific system/* routes that are meant for it (see routes/system*).
 */
const SYSTEM_ROLES = ['system_maintenance_admin'];

const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Excused'];
const ATTENDANCE_METHODS = ['QR', 'Manual'];

const SUBMISSION_STATUSES = ['To Do', 'Submitted', 'Graded', 'Missing'];

const TARGET_AUDIENCES = ['All', 'Students', 'Cadets', 'Officers'];

/** What an announcement can deep-link to in the mobile app ('' = nothing).
 * Module covers learning modules, assignments and quizzes; Attendance has no
 * linkId (it opens the trainee's own attendance page). */
const ANNOUNCEMENT_LINK_TYPES = ['Module', 'Activity', 'Attendance'];

/** Special-consideration category collected at registration (drives which
 * requirement documents a trainee is asked to submit). */
const SPECIAL_CATEGORIES = ['None', 'PWD', 'SK Chairperson', 'Medical Condition'];

/** Of the special categories, the ones that mean a ROTC cadet physically
 * cannot undergo field training/drills, and so belong in the dedicated
 * "Special Class" track (its own dashboard, its own ROTC-wide officer,
 * alternative activities) instead of the regular brigade program. SK
 * Chairperson is a civic-duty exemption, not a physical one, so it's
 * deliberately excluded — see utils/specialClass.js. */
const SPECIAL_CLASS_CATEGORIES = ['PWD', 'Medical Condition'];

/** Officer title choices offered when adding/promoting an officer, scoped by
 * program — CWTS's brigade-level lead is titled differently from ROTC's
 * platoon-level lead, but both share the same Attendance Officer title. */
const OFFICER_POSITIONS = {
  CWTS: ['Brigade Commander', 'Attendance Officer'],
  ROTC: ['Platoon Leader', 'Attendance Officer'],
};

/** MARSU campus a trainee is enrolled at, collected at registration. */
const CAMPUSES = ['MARSU - Boac (Main)', 'MARSU - Torrijos', 'MARSU - Sta. Cruz', 'MARSU - Gasan'];

/** Campuses that do not offer ROTC — only CWTS is available there. */
const ROTC_RESTRICTED_CAMPUSES = ['MARSU - Torrijos', 'MARSU - Gasan'];

/**
 * Per-document-type upload rules for the trainee "Documents" requirement
 * checklist — `accept` is which kind(s) of file that title takes ('image',
 * 'pdf', or both), `maxMb` is its own size ceiling. A 2x2 ID photo has no
 * business being a 20MB scan, so this is deliberately tighter (and
 * type-specific) than the app's general upload limit. Matched against the
 * document's free-text `title` field (see backend/models/Document.js);
 * anything not listed here falls back to DOCUMENT_TYPE_DEFAULT_RULE.
 */
const DOCUMENT_TYPE_RULES = {
  'Registration Form': { accept: ['pdf'], maxMb: 5 },
  'Parent Consent Form': { accept: ['pdf'], maxMb: 5 },
  'Brigade Clearance': { accept: ['pdf'], maxMb: 5 },
  'Medical Certificate': { accept: ['pdf', 'image'], maxMb: 5 },
  'PWD ID (if applicable)': { accept: ['pdf', 'image'], maxMb: 5 },
  '2 x 2 Picture': { accept: ['image'], maxMb: 1 },
};
const DOCUMENT_TYPE_DEFAULT_RULE = { accept: ['pdf', 'image'], maxMb: 5 };

const SESSION_STATUSES = ['Active', 'Closed', 'Cancelled'];
/** Whether a QR attendance session checks trainees IN or OUT. An OUT session
 * is paired to one IN session (AttendanceSession.pairedSessionId) — closing
 * it marks anyone who checked in but never checked out as Absent for the day. */
const SESSION_CHECK_TYPES = ['IN', 'OUT'];

const CONTEST_STATUSES = ['Pending', 'Approved', 'Rejected'];
/** What an Approved contest turned the Absent record into: 'Excused' keeps
 * it in the history as an excused (uncounted) absence, 'Present' erases the
 * absence entirely. See attendanceContestController.review. */
const CONTEST_APPROVAL_TYPES = ['Excused', 'Present'];

/** A trainee's forgot-password request, manually reviewed by
 * system_maintenance_admin before any reset code is issued — see
 * controllers/passwordResetController.js. */
const PASSWORD_RESET_STATUSES = ['Pending', 'Approved', 'Rejected'];

const CERTIFICATE_STATUSES = ['Pending', 'Approved', 'Rejected'];
/** The only certificate a trainee may request (enforced in
 * certificateRequestController.create). Older requests of other types
 * stay on record and still display as they were filed. */
const CERTIFICATE_TYPES = ['Certificate of Completion'];

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

/**
 * Grading structure kept identical to what the Flutter screens already show.
 * A program (CWTS/ROTC) can override these via the System Settings ›
 * grading admin UI (see systemConfigCache.getGradingWeightsOverride); with
 * no override on file, both programs share the same .env-driven default,
 * exactly as before per-program overrides existed.
 */
const grading = (program) => {
  // Lazy require: systemConfigCache is populated at server startup, but
  // constants.js is required very early (before that cache exists) by
  // plenty of modules that never call grading() at import time.
  const { getGradingWeightsOverride } = require('../utils/systemConfigCache');
  const override = program ? getGradingWeightsOverride(program) : null;
  return {
    weights: override || {
      modules: num('GRADE_WEIGHT_MODULES', 30),
      activities: num('GRADE_WEIGHT_ACTIVITIES', 40),
      attendance: num('GRADE_WEIGHT_ATTENDANCE', 30),
    },
  };
};

/** How long an approved password reset code stays valid before the trainee
 * must submit a fresh request. */
const PASSWORD_RESET_CODE_TTL_MINUTES = num('PASSWORD_RESET_CODE_TTL_MINUTES', 30);

const attendanceRules = () => {
  // Lazy require: systemConfigCache is populated at server startup, but
  // constants.js is required very early (before that cache exists) by
  // plenty of modules that never call attendanceRules() at import time.
  const { getQrTtlOverride } = require('../utils/systemConfigCache');
  const override = getQrTtlOverride();
  return {
    lateGraceMinutes: num('ATTENDANCE_LATE_GRACE_MINUTES', 15),
    codeTtlMinutes: override != null ? override : num('ATTENDANCE_CODE_TTL_MINUTES', 15),
    // At this many Absents a trainee is restricted (QR attendance and
    // modules locked) and flagged for the officer's drop review — they need
    // an officer/admin to sort it out. See utils/attendanceStanding.js and
    // utils/gradeCalculator.js.
    maxAbsencesBeforeDrop: num('ATTENDANCE_MAX_ABSENCES_BEFORE_DROP', 5),
    // At this many Absents the trainee's home screen shows an attendance
    // warning ("needs attention"), before anything is locked.
    absenceWarningAt: num('ATTENDANCE_ABSENCE_WARNING_AT', 3),
  };
};

module.exports = {
  ROLES,
  PROGRAM_ADMIN_ROLES,
  ADMIN_ROLES,
  STAFF_ROLES,
  TRAINEE_ROLES,
  SYSTEM_ROLES,
  PROGRAMS,
  USER_STATUSES,
  TRAINEE_STATUSES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS,
  SUBMISSION_STATUSES,
  TARGET_AUDIENCES,
  ANNOUNCEMENT_LINK_TYPES,
  SPECIAL_CATEGORIES,
  SPECIAL_CLASS_CATEGORIES,
  OFFICER_POSITIONS,
  CAMPUSES,
  ROTC_RESTRICTED_CAMPUSES,
  DOCUMENT_TYPE_RULES,
  DOCUMENT_TYPE_DEFAULT_RULE,
  SESSION_STATUSES,
  SESSION_CHECK_TYPES,
  CONTEST_STATUSES,
  CONTEST_APPROVAL_TYPES,
  CERTIFICATE_STATUSES,
  CERTIFICATE_TYPES,
  PASSWORD_RESET_STATUSES,
  PASSWORD_RESET_CODE_TTL_MINUTES,
  NOTIFICATION_TYPES,
  grading,
  attendanceRules,
};
