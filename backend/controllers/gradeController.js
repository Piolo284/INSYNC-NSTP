const Grade = require('../models/Grade');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertSelfOrStaff } = require('../middleware/auth');
const { recalculateGrade } = require('../utils/gradeCalculator');
const { grading } = require('../config/constants');

/** GET /api/grades */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.program) filter.program = req.query.program;
  if (req.query.remarks && req.query.remarks !== 'All') filter.remarks = req.query.remarks;

  if (['student', 'cadet'].includes(req.user.role)) {
    filter.studentId = req.user._id;
  }

  let grades = await Grade.find(filter)
    .populate('studentId', 'name studentId program section yearLevel profileImage')
    .sort({ finalGrade: -1 });

  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    grades = grades.filter((g) => {
      const u = g.studentId;
      return (
        String(u?.name || '').toLowerCase().includes(q) ||
        String(u?.studentId || '').toLowerCase().includes(q)
      );
    });
  }

  res.json({
    success: true,
    count: grades.length,
    stats: {
      passed: grades.filter((g) => g.remarks === 'Passed').length,
      warning: grades.filter((g) => g.remarks === 'Warning').length,
      failed: grades.filter((g) => g.remarks === 'Failed').length,
      incomplete: grades.filter((g) => g.remarks === 'Incomplete').length,
    },
    grading: grading(),
    data: grades,
  });
});

/**
 * GET /api/grades/:studentId
 * Always recalculated from the underlying submissions + attendance so the
 * number can never drift from its source data.
 */
exports.getForStudent = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    $or: [
      ...(req.params.studentId.match(/^[0-9a-fA-F]{24}$/)
        ? [{ _id: req.params.studentId }]
        : []),
      { studentId: req.params.studentId },
    ],
  });
  if (!user) throw ApiError.notFound('Student not found.');

  assertSelfOrStaff(req, user._id);

  const grade = await recalculateGrade(user._id, user.program || 'CWTS');
  await grade.populate('studentId', 'name studentId program section yearLevel profileImage');

  res.json({ success: true, grading: grading(), data: grade });
});

/** POST /api/grades — force a recalculation for one trainee or a whole program. */
exports.recalculate = asyncHandler(async (req, res) => {
  if (req.body.studentId) {
    const user = await User.findById(req.body.studentId);
    if (!user) throw ApiError.notFound('Student not found.');
    const grade = await recalculateGrade(
      user._id,
      user.program || 'CWTS',
      req.user._id
    );
    return res.json({ success: true, count: 1, data: grade });
  }

  const program = req.body.program || req.user.program || 'CWTS';
  const trainees = await User.find({
    role: program === 'ROTC' ? 'cadet' : 'student',
    program,
  });

  const grades = [];
  for (const t of trainees) {
    grades.push(await recalculateGrade(t._id, program, req.user._id));
  }

  res.json({
    success: true,
    message: `Recalculated ${grades.length} grade(s).`,
    count: grades.length,
    data: grades,
  });
});

/** PUT /api/grades/:id — manual override of remarks/final grade by staff. */
exports.update = asyncHandler(async (req, res) => {
  const grade = await Grade.findById(req.params.id);
  if (!grade) throw ApiError.notFound('Grade record not found.');

  if (req.body.finalGrade !== undefined) {
    const value = Number(req.body.finalGrade);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw ApiError.badRequest('Final grade must be between 0 and 100.');
    }
    grade.finalGrade = value;
    grade.totalScore = value;
  }
  if (req.body.remarks !== undefined) grade.remarks = req.body.remarks;
  grade.gradedBy = req.user._id;
  await grade.save();

  res.json({ success: true, data: grade });
});

/**
 * GET /api/grades/report/export
 * Returns CSV for the instructor "Export final grade report" button.
 */
exports.exportReport = asyncHandler(async (req, res) => {
  const program = req.query.program || req.user.program || 'CWTS';

  const grades = await Grade.find({ program }).populate(
    'studentId',
    'name studentId section yearLevel'
  );

  const header = [
    'Student ID',
    'Name',
    'Section',
    'Year Level',
    'Module Score',
    'Activity Score',
    'Attendance Score',
    'Final Grade',
    'Remarks',
  ];

  const avg = (lines) =>
    lines.length
      ? (lines.reduce((s, l) => s + l.percentage, 0) / lines.length).toFixed(2)
      : '0.00';

  const rows = grades.map((g) => {
    const u = g.studentId || {};
    return [
      u.studentId || '',
      u.name || '',
      u.section || '',
      u.yearLevel || '',
      avg(g.moduleScores),
      avg(g.activityScores),
      g.attendanceScore.toFixed(2),
      g.finalGrade.toFixed(2),
      g.remarks,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');
  });

  const csv = [header.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${program}-final-grades.csv"`
  );
  res.send(csv);
});
