const Attendance = require('../models/Attendance');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const { grading } = require('../config/constants');

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

function remarksFor(finalGrade, hasAnyData) {
  if (!hasAnyData) return 'Incomplete';
  const { passing, warning } = grading();
  if (finalGrade >= passing) return 'Passed';
  if (finalGrade >= warning) return 'Warning';
  return 'Failed';
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
  const { weights } = grading();
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

  return grade;
}

module.exports = {
  recalculateGrade,
  attendanceScoreFrom,
  remarksFor,
  round2,
};
