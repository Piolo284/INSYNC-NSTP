const Activity = require('../models/Activity');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');
const {
  assertProgramAccess,
  scopeFilterToProgram,
  resolveProgramForCreate,
} = require('../utils/programScope');
const { assertBrigadeAccess, resolveBrigadeForCreate } = require('../utils/brigadeScope');
const {
  assertSpecialClassManager,
  isSpecialClassManager,
  isSpecialClassTrainee,
} = require('../utils/specialClass');
const Brigade = require('../models/Brigade');
const { announceActivity, removeLinkedAnnouncements } = require('../utils/linkedAnnouncement');

function parseList(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  // The Add Activity screen sends one textarea — split on newlines/semicolons.
  return String(value)
    .split(/\r?\n|;/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** GET /api/activities */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  scopeFilterToProgram(filter, req.user, req.query.program);

  if (req.user.role === 'cadet' || req.user.role === 'student') {
    // A Special Class trainee only ever sees their alternative-track
    // activities (they can't do field training/the equivalent CWTS field
    // work); everyone else never sees Special Class activities mixed into
    // their regular feed.
    filter.isSpecialClass = await isSpecialClassTrainee(req.user._id, req.user.role);
  } else {
    const program = filter.program || req.query.program;
    // The assigned Special Class officer has no separate "Special" tab —
    // their whole interface (this one included) is the Special Class
    // roster, so they never need to explicitly ask via ?specialClass=true.
    const isOfficerSpecial =
      req.user.role === 'officer' && Boolean(program) && (await isSpecialClassManager(req.user, program));
    const wantsSpecialClass = req.query.specialClass === 'true' || isOfficerSpecial;
    if (wantsSpecialClass) {
      if (!program) {
        throw ApiError.badRequest('program is required when requesting a Special Class list.');
      }
      if (req.user.role === 'officer') await assertSpecialClassManager(req.user, program);
      filter.program = program;
      filter.isSpecialClass = true;
    } else {
      filter.isSpecialClass = { $ne: true };
      // An activity with no brigade is program-wide (visible to every officer
      // in the program), so an officer sees their own brigade's activities
      // *plus* program-wide ones — not a hard brigadeId equality like
      // students/attendance.
      if (req.user.role === 'officer') {
        filter.$and = (filter.$and || []).concat([
          { $or: [{ brigadeId: req.user.brigadeId }, { brigadeId: null }] },
        ]);
      } else if (req.query.brigadeId) {
        filter.brigadeId = req.query.brigadeId;
      }
    }
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.upcoming === 'true') filter.date = { $gte: new Date() };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
  }

  const activities = await Activity.find(filter)
    .populate('createdBy', 'name role')
    .sort({ date: -1 });

  // Participant counts drive the "42 trainees participated" line.
  const counts = await Attendance.aggregate([
    { $match: { activityId: { $in: activities.map((a) => a._id) } } },
    { $group: { _id: '$activityId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    success: true,
    count: activities.length,
    data: activities.map((a) => ({
      ...a.toObject(),
      participants: countMap.get(String(a._id)) || 0,
    })),
  });
});

/** GET /api/activities/:id */
exports.get = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('createdBy', 'name role');
  if (!activity) throw ApiError.notFound('Activity not found.');
  assertProgramAccess(req.user, activity.program);
  // brigadeId: null means "program-wide" — visible to every officer in the
  // program, not restricted like students/attendance are.
  if (activity.brigadeId) assertBrigadeAccess(req.user, activity.brigadeId);

  const participants = await Attendance.countDocuments({ activityId: activity._id });

  res.json({ success: true, data: { ...activity.toObject(), participants } });
});

/** POST /api/activities */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'date']);
  assertEnum(req.body.program, PROGRAMS, 'program');

  const program = resolveProgramForCreate(req.user, req.body.program);

  // The assigned Special Class officer always creates Special Class
  // activities — no toggle needed, since that's the only thing they manage.
  const isOfficerSpecial =
    req.user.role === 'officer' && (await isSpecialClassManager(req.user, program));
  const wantsSpecialClass =
    isOfficerSpecial || req.body.isSpecialClass === true || req.body.isSpecialClass === 'true';
  let brigadeId = null;
  let brigade = null;
  if (wantsSpecialClass) {
    await assertSpecialClassManager(req.user, program);
    // Always program-wide — the Special Class track cuts across brigades.
  } else {
    brigadeId = resolveBrigadeForCreate(req.user, req.body.brigadeId);
    brigade = brigadeId ? await Brigade.findById(brigadeId) : null;
  }
  const photos = (req.files || []).map((f) => f.path);

  const activity = await Activity.create({
    title: req.body.title,
    description: req.body.description || '',
    program,
    date: new Date(req.body.date),
    startTime: req.body.startTime || '',
    endTime: req.body.endTime || '',
    location: req.body.location || '',
    brigadeId,
    brigade: brigade ? brigade.name : '',
    isSpecialClass: wantsSpecialClass,
    objectives: parseList(req.body.objectives) || [],
    image: photos[0] || req.body.image || '',
    photos: photos.length ? photos : parseList(req.body.photos) || [],
    status: req.body.status || 'Upcoming',
    createdBy: req.user._id,
  });

  // Announce it to the trainees who can see it, linked to this activity.
  await announceActivity(activity, req.user._id);

  res.status(201).json({ success: true, data: activity });
});

/** PUT /api/activities/:id */
exports.update = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw ApiError.notFound('Activity not found.');
  assertProgramAccess(req.user, activity.program);
  if (activity.brigadeId) assertBrigadeAccess(req.user, activity.brigadeId);
  assertEnum(req.body.program, PROGRAMS, 'program');
  // Program-scoped roles cannot move an activity to the other program.
  if (req.user.role !== 'super_admin' && req.body.program !== undefined) {
    req.body.program = req.user.program;
  }

  const scalarFields = [
    'title',
    'description',
    'program',
    'startTime',
    'endTime',
    'location',
    'brigade',
    'status',
    'image',
  ];
  scalarFields.forEach((f) => {
    if (req.body[f] !== undefined) activity[f] = req.body[f];
  });

  if (req.body.date !== undefined) activity.date = new Date(req.body.date);

  const objectives = parseList(req.body.objectives);
  if (objectives) activity.objectives = objectives;

  const uploaded = (req.files || []).map((f) => f.path);
  if (uploaded.length) {
    activity.photos = [...activity.photos, ...uploaded];
    if (!activity.image) activity.image = uploaded[0];
  }

  await activity.save();
  res.json({ success: true, data: activity });
});

/** DELETE /api/activities/:id */
exports.remove = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw ApiError.notFound('Activity not found.');
  assertProgramAccess(req.user, activity.program);
  if (activity.brigadeId) assertBrigadeAccess(req.user, activity.brigadeId);

  await Attendance.updateMany({ activityId: activity._id }, { activityId: null });
  await removeLinkedAnnouncements('Activity', activity._id);
  await activity.deleteOne();

  res.json({ success: true, message: 'Activity deleted.' });
});

/** GET /api/activities/:id/participants */
exports.participants = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw ApiError.notFound('Activity not found.');
  assertProgramAccess(req.user, activity.program);
  if (activity.brigadeId) assertBrigadeAccess(req.user, activity.brigadeId);

  const records = await Attendance.find({ activityId: activity._id }).sort({ time: 1 });
  const users = await User.find({ _id: { $in: records.map((r) => r.studentId) } });
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const participants = records.map((r) => {
    const u = userMap.get(String(r.studentId));
    return {
      attendanceId: r._id,
      userId: r.studentId,
      name: u ? u.name : 'Unknown',
      studentId: u ? u.studentId : '',
      program: u ? u.program : activity.program,
      course: u ? u.section : '',
      yearLevel: u ? u.yearLevel : '',
      status: r.status,
      time: r.time,
      profileImage: u ? u.profileImage : '',
    };
  });

  res.json({
    success: true,
    count: participants.length,
    stats: {
      present: participants.filter((p) => p.status === 'Present').length,
      late: participants.filter((p) => p.status === 'Late').length,
      absent: participants.filter((p) => p.status === 'Absent').length,
      excused: participants.filter((p) => p.status === 'Excused').length,
    },
    data: participants,
  });
});
