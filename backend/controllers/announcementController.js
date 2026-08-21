const Announcement = require('../models/Announcement');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS, TARGET_AUDIENCES } = require('../config/constants');
const { notifyUsers } = require('../utils/notify');

const AUDIENCE_ROLES = {
  Students: ['student'],
  Cadets: ['cadet'],
  Officers: ['officer'],
  Instructors: ['instructor'],
};

/** Resolves who should receive a notification for this announcement. */
async function recipientsFor(announcement) {
  if (announcement.recipients && announcement.recipients.length) {
    return announcement.recipients;
  }

  const filter = {};
  const roles = AUDIENCE_ROLES[announcement.targetAudience];
  if (roles) filter.role = { $in: roles };
  else filter.role = { $in: ['student', 'cadet', 'officer', 'instructor'] };

  if (announcement.program && announcement.program !== 'All') {
    filter.program = announcement.program;
  }
  filter.status = 'Active';

  const users = await User.find(filter).select('_id');
  return users.map((u) => u._id);
}

/**
 * GET /api/announcements
 * Trainees automatically get only what is addressed to them; staff see all.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = { status: req.query.status || 'Published' };

  if (req.query.program) {
    filter.program = { $in: [req.query.program, 'All'] };
  }

  if (['student', 'cadet'].includes(req.user.role)) {
    const audience = req.user.role === 'cadet' ? 'Cadets' : 'Students';
    filter.program = { $in: [req.user.program, 'All'] };
    filter.targetAudience = { $in: ['All', audience] };
    filter.$or = [
      { recipients: { $size: 0 } },
      { recipients: req.user._id },
    ];
  } else if (req.query.audience) {
    filter.targetAudience = req.query.audience;
  }

  const announcements = await Announcement.find(filter)
    .populate('createdBy', 'name role')
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(Number(req.query.limit) || 100);

  res.json({ success: true, count: announcements.length, data: announcements });
});

/** GET /api/announcements/:id */
exports.get = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id).populate(
    'createdBy',
    'name role'
  );
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  res.json({ success: true, data: announcement });
});

/** POST /api/announcements */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'content']);
  assertEnum(req.body.program, [...PROGRAMS, 'All'], 'program');
  assertEnum(req.body.targetAudience, TARGET_AUDIENCES, 'targetAudience');

  const announcement = await Announcement.create({
    title: req.body.title,
    content: req.body.content,
    program: req.body.program || req.user.program || 'All',
    targetAudience: req.body.targetAudience || 'All',
    recipients: Array.isArray(req.body.recipients) ? req.body.recipients : [],
    date: req.body.date ? new Date(req.body.date) : new Date(),
    time: req.body.time || '',
    location: req.body.location || '',
    isPinned: Boolean(req.body.isPinned),
    status: req.body.status || 'Published',
    createdBy: req.user._id,
  });

  if (announcement.status === 'Published') {
    const recipients = await recipientsFor(announcement);
    await notifyUsers(recipients, {
      title: announcement.title,
      message: announcement.content,
      type: 'announcement',
      data: { announcementId: announcement._id },
    });
  }

  res.status(201).json({ success: true, data: announcement });
});

/** PUT /api/announcements/:id */
exports.update = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');

  assertEnum(req.body.program, [...PROGRAMS, 'All'], 'program');
  assertEnum(req.body.targetAudience, TARGET_AUDIENCES, 'targetAudience');

  const fields = [
    'title',
    'content',
    'program',
    'targetAudience',
    'time',
    'location',
    'isPinned',
    'status',
    'recipients',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) announcement[f] = req.body[f];
  });
  if (req.body.date !== undefined) announcement.date = new Date(req.body.date);

  await announcement.save();
  res.json({ success: true, data: announcement });
});

/** DELETE /api/announcements/:id */
exports.remove = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');

  await announcement.deleteOne();
  res.json({ success: true, message: 'Announcement deleted.' });
});

/** POST /api/announcements/:id/send — re-notifies the audience. */
exports.send = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');

  if (Array.isArray(req.body.recipients) && req.body.recipients.length) {
    announcement.recipients = req.body.recipients;
    await announcement.save();
  }

  const recipients = await recipientsFor(announcement);
  await notifyUsers(recipients, {
    title: announcement.title,
    message: announcement.content,
    type: 'announcement',
    data: { announcementId: announcement._id },
  });

  res.json({
    success: true,
    message: `Announcement sent to ${recipients.length} user(s).`,
    count: recipients.length,
  });
});
