const Grade = require('../models/Grade');

/**
 * Non-blocking eligibility snapshot shown to staff reviewing a certificate
 * request. Approval stays a manual staff decision (a trainee can still file
 * a request and staff can still approve/reject it exactly as before) — this
 * only adds visibility into whether the trainee's current grade/attendance
 * record would normally support the request, reading the Grade record that
 * recalculateGrade already keeps up to date rather than recomputing it here.
 */
async function eligibilityFor(studentId, program, userStatus) {
  const grade = await Grade.findOne({ studentId, program });

  const reasons = [];
  if (userStatus === 'Dropped') {
    reasons.push('Trainee has been dropped from the program.');
  }
  if (!grade || grade.remarks !== 'Passed') {
    reasons.push(
      grade ? `Current grade remark is "${grade.remarks}", not Passed.` : 'No grade record on file yet.'
    );
  }

  return {
    gradeRemarks: grade?.remarks || null,
    finalGrade: grade?.finalGrade ?? null,
    attendanceSummary: grade?.attendanceSummary || null,
    eligible: reasons.length === 0,
    reasons,
  };
}

module.exports = { eligibilityFor };
