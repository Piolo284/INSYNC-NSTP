const Attendance = require('../models/Attendance');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Notification = require('../models/Notification');
const { grading, attendanceRules, SPECIAL_CLASS_CATEGORIES } = require('../config/constants');
const Officer = require('../models/Officer');
const { gradePointFrom, PASSING_POINT } = require('../utils/gradeScale');
const { notifyUser, notifyUsers } = require('./notify');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Attendance score keeps the same shape the officer dashboard already implies:
 * Present and Excused count in full, Late counts half, Absent counts zero.
 */
function attendanceScoreFrom(summary) {
  if (!summary.total) return 0;
  const earned = summary.present + summary.excused + summary.late * 0.5;
  return round2((earned / summary.total) * 100);
}

/**
 * Passed/Failed is decided off the 1.00-5.00 college grading scale
 * equivalent of finalGrade, not the raw percentage: 3.00 and better passes,
 * 3.25 and worse (i.e. below 75%) fails.
 */
function remarksFor(finalGrade, hasAnyData) {
  if (!hasAnyData) return 'Incomplete';
  return gradePointFrom(finalGrade) <= PASSING_POINT ? 'Passed' : 'Failed';
}

function lineFrom(submission, refField) {
  const total = submission.totalPoints || 100;
  const score = Number(submission.score) || 0;
  const ref = submission[refField];
  return {
    refId: ref ? ref._id || ref : null,
    title: (ref && ref.title) || '',
    score,
    totalPoints: total,
    percentage: total > 0 ? round2((score / total) * 100) : 0,
  };
}

const average = (lines) =>
  lines.length
    ? round2(lines.reduce((sum, l) => sum + l.percentage, 0) / lines.length)
    : 0;

/**
 * Recomputes and persists the Grade document for one trainee/cadet from their
 * graded submissions and attendance records. Called after grading a submission
 * and after recording/updating attendance, so grades always match the source data.
 */
async function recalculateGrade(userId, program, gradedBy = null) {
  const [submissions, attendance] = await Promise.all([
    Submission.find({ studentId: userId, status: 'Graded' })
      .populate('moduleId', 'title')
      .populate('activityId', 'title'),
    Attendance.find({ studentId: userId, program }),
  ]);

  const moduleScores = submissions
    .filter((s) => s.moduleId)
    .map((s) => lineFrom(s, 'moduleId'));

  const activityScores = submissions
    .filter((s) => s.activityId && !s.moduleId)
    .map((s) => lineFrom(s, 'activityId'));

  const summary = {
    present: attendance.filter((a) => a.status === 'Present').length,
    late: attendance.filter((a) => a.status === 'Late').length,
    absent: attendance.filter((a) => a.status === 'Absent').length,
    excused: attendance.filter((a) => a.status === 'Excused').length,
    total: attendance.length,
  };

  const attendanceScore = attendanceScoreFrom(summary);
  const moduleAvg = average(moduleScores);
  const activityAvg = average(activityScores);

  // Weights of components with no data yet are redistributed across the
  // components that do, so an early-semester grade is not dragged to zero.
  const { weights } = grading(program);
  const parts = [
    { value: moduleAvg, weight: weights.modules, has: moduleScores.length > 0 },
    { value: activityAvg, weight: weights.activities, has: activityScores.length > 0 },
    { value: attendanceScore, weight: weights.attendance, has: summary.total > 0 },
  ].filter((p) => p.has);

  const weightSum = parts.reduce((sum, p) => sum + p.weight, 0);
  const totalScore = weightSum
    ? round2(parts.reduce((sum, p) => sum + p.value * p.weight, 0) / weightSum)
    : 0;

  const hasAnyData = parts.length > 0;
  const finalGrade = totalScore;

  const grade = await Grade.findOneAndUpdate(
    { studentId: userId, program },
    {
      studentId: userId,
      program,
      moduleScores,
      activityScores,
      attendanceScore,
      attendanceSummary: summary,
      totalScore,
      finalGrade,
      remarks: remarksFor(finalGrade, hasAnyData),
      ...(gradedBy ? { gradedBy } : {}),
      computedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await flagForDropReviewIfOverAbsenceLimit(userId, program, summary.absent);

  return grade;
}

/**
 * Enrollment policy: once a trainee's Absent count for a program reaches
 * `maxAbsencesBeforeDrop`, they are NOT dropped automatically — they're
 * flagged "for drop review" and their assigned officer must confirm the drop
 * (or keep them) in the officer app (controllers/dropReviewController.js).
 * Checked here because recalculateGrade already runs after every attendance
 * change and has the exact up-to-date absence count on hand.
 */
async function flagForDropReviewIfOverAbsenceLimit(userId, program, absentCount) {
  const { maxAbsencesBeforeDrop } = attendanceRules();

  if (absentCount < maxAbsencesBeforeDrop) {
    await warnIfApproachingDropLimit(userId, absentCount, maxAbsencesBeforeDrop);
    return;
  }

  const user = await User.findById(userId);
  if (!user || user.status === 'Dropped' || user.dropPendingSince) return;
  // An officer already reviewed and kept them at this count — only a new
  // absence brings them back for review.
  if (absentCount <= (user.dropKeptAtAbsences || 0)) return;

  user.dropPendingSince = new Date();
  user.dropReviewAbsences = absentCount;
  await user.save();

  await notifyUser(userId, {
    title: 'Absence limit reached',
    message: `You have reached ${absentCount} absences (limit: ${maxAbsencesBeforeDrop}). Your officer will review whether you will be dropped from the program.`,
    type: 'attendance',
  });

  const officerIds = await assignedOfficerIds(user, program);
  if (officerIds.length) {
    await notifyUsers(officerIds, {
      title: 'Drop review needed',
      message: `${user.name} (${user.studentId}) has ${absentCount} absences. Please confirm whether to drop this trainee.`,
      type: 'attendance',
      data: { dropReviewUserId: user._id },
    });
  }
}

/** Active officers handling this trainee: their brigade/company's officers,
 * or the Special Class officer for a PWD/Medical-Condition cadet. */
async function assignedOfficerIds(user, program) {
  const ProfileModel = program === 'ROTC' ? Cadet : Student;
  const profile = await ProfileModel.findOne({ userId: user._id }).select('specialCategory');
  const isSpecial =
    program === 'ROTC' && profile && SPECIAL_CLASS_CATEGORIES.includes(profile.specialCategory);
  if (isSpecial) {
    const specialOfficers = await Officer.find({ program: 'ROTC', isSpecialClassOfficer: true }).select('userId');
    const ids = specialOfficers.map((o) => o.userId);
    return (await User.find({ _id: { $in: ids }, status: 'Active' }).select('_id')).map((u) => u._id);
  }
  if (!user.brigadeId) return [];
  return (
    await User.find({ role: 'officer', program, brigadeId: user.brigadeId, status: 'Active' }).select('_id')
  ).map((u) => u._id);
}

/**
 * Sends a one-time heads-up notification once a trainee is exactly one
 * absence away from the auto-drop threshold. Guarded by a marker in
 * `data.warningAbsentCount` so re-running recalculateGrade (e.g. after
 * grading an unrelated submission) never re-sends the same warning.
 */
async function warnIfApproachingDropLimit(userId, absentCount, maxAbsencesBeforeDrop) {
  if (maxAbsencesBeforeDrop <= 1 || absentCount !== maxAbsencesBeforeDrop - 1) return;

  const alreadyWarned = await Notification.exists({
    recipientId: userId,
    type: 'attendance',
    'data.warningAbsentCount': absentCount,
  });
  if (alreadyWarned) return;

  await notifyUser(userId, {
    title: 'Attendance warning',
    message: `You now have ${absentCount} absence(s). Reaching ${maxAbsencesBeforeDrop} absences will refer you to your officer for dropping from the program.`,
    type: 'attendance',
    data: { warningAbsentCount: absentCount },
  });
}

module.exports = {
  recalculateGrade,
  attendanceScoreFrom,
  remarksFor,
  round2,
};
