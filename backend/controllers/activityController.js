const Activity = require('../models/Activity');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');
const { publicUrl } = require('../middleware/upload');

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
  if (req.query.program) filter.program = req.query.program;
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

  const participants = await Attendance.countDocuments({ activityId: activity._id });

  res.json({ success: true, data: { ...activity.toObject(), participants } });
});

/** POST /api/activities */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'date']);
  assertEnum(req.body.program, PROGRAMS, 'program');

  const program = req.body.program || req.user.program || 'CWTS';
  const photos = (req.files || []).map((f) => publicUrl('activities', f.filename));

  const activity = await Activity.create({
    title: req.body.title,
    description: req.body.description || '',
    program,
    date: new Date(req.body.date),
    startTime: req.body.startTime || '',
    endTime: req.body.endTime || '',
    location: req.body.location || '',
    brigade: req.body.brigade || '',
    objectives: parseList(req.body.objectives) || [],
    image: photos[0] || req.body.image || '',
    photos: photos.length ? photos : parseList(req.body.photos) || [],
    status: req.body.status || 'Upcoming',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: activity });
});

/** PUT /api/activities/:id */
exports.update = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw ApiError.notFound('Activity not found.');
  assertEnum(req.body.program, PROGRAMS, 'program');

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

  const uploaded = (req.files || []).map((f) => publicUrl('activities', f.filename));
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

  await Attendance.updateMany({ activityId: activity._id }, { activityId: null });
  await activity.deleteOne();

  res.json({ success: true, message: 'Activity deleted.' });
});

/** GET /api/activities/:id/participants */
exports.participants = asyncHandler(async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) throw ApiError.notFound('Activity not found.');

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
