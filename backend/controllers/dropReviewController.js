const User = require('../models/User');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const Attendance = require('../models/Attendance');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../utils/notify');
const { assertProgramAccess } = require('../utils/programScope');
const { isSpecialClassManager, isSpecialClassTrainee } = require('../utils/specialClass');
const { attendanceRules } = require('../config/constants');

/**
 * Reaching the absence limit only FLAGS a trainee (utils/gradeCalculator.js);
 * their assigned officer decides here whether they're actually dropped.
 * "Assigned officer" = an officer of the trainee's own brigade/company, or
 * the Special Class officer for a PWD/Medical-Condition cadet.
 */
async function loadPendingTrainee(req) {
  const trainee = await User.findById(req.params.userId);
  if (!trainee || !['student', 'cadet'].includes(trainee.role)) {
    throw ApiError.notFound('Trainee not found.');
  }
  assertProgramAccess(req.user, trainee.program);

  const special = await isSpecialClassTrainee(trainee._id, trainee.role);
  const allowed = special
    ? await isSpecialClassManager(req.user, trainee.program)
    : Boolean(req.user.brigadeId) && String(req.user.brigadeId) === String(trainee.brigadeId);
  if (!allowed) {
    throw ApiError.forbidden('Only the officer assigned to this trainee can review their drop.');
  }

  if (trainee.status === 'Dropped') throw ApiError.conflict(`${trainee.name} is already dropped.`);
  if (!trainee.dropPendingSince) {
    throw ApiError.conflict(`${trainee.name} is not waiting for a drop review.`);
  }
  return trainee;
}

const absentCountOf = (trainee) =>
  Attendance.countDocuments({ studentId: trainee._id, program: trainee.program, status: 'Absent' });

/** POST /api/drop-reviews/:userId/confirm — the officer confirms the drop. */
exports.confirm = asyncHandler(async (req, res) => {
  const trainee = await loadPendingTrainee(req);
  const absences = await absentCountOf(trainee);

  trainee.status = 'Dropped';
  trainee.dropPendingSince = null;
  await trainee.save();
  const ProfileModel = trainee.program === 'ROTC' ? Cadet : Student;
  await ProfileModel.updateOne({ userId: trainee._id }, { status: 'Dropped' });

  await notifyUser(trainee._id, {
    title: 'You have been dropped',
    message: `With ${absences} absences (limit: ${attendanceRules().maxAbsencesBeforeDrop}), your officer has dropped you from the ${trainee.program} program. Please contact your officer if you believe this is a mistake.`,
    type: 'attendance',
  });

  res.json({ success: true, message: `${trainee.name} has been dropped from ${trainee.program}.` });
});

/** POST /api/drop-reviews/:userId/keep — the officer keeps the trainee
 * enrolled. They're only flagged again after another absence. */
exports.keep = asyncHandler(async (req, res) => {
  const trainee = await loadPendingTrainee(req);
  const absences = await absentCountOf(trainee);

  trainee.dropPendingSince = null;
  trainee.dropKeptAtAbsences = absences;
  await trainee.save();

  await notifyUser(trainee._id, {
    title: 'You remain enrolled',
    message: `Your officer reviewed your ${absences} absences and kept you in the ${trainee.program} program. Another absence will be reviewed again.`,
    type: 'attendance',
  });

  res.json({ success: true, message: `${trainee.name} stays enrolled.` });
});
