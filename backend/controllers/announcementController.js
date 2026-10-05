const Announcement = require('../models/Announcement');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { PROGRAMS, TARGET_AUDIENCES, CAMPUSES } = require('../config/constants');
const { notifyUsers } = require('../utils/notify');
const { assertProgramAccess } = require('../utils/programScope');

const AUDIENCE_ROLES = {
  Students: ['student'],
  Cadets: ['cadet'],
  Officers: ['officer'],
};

/** Resolves who should receive a notification for this announcement. */
async function recipientsFor(announcement) {
  if (announcement.recipients && announcement.recipients.length) {
    return announcement.recipients;
  }

  const filter = {};
  const roles = AUDIENCE_ROLES[announcement.targetAudience];
  if (roles) filter.role = { $in: roles };
  else filter.role = { $in: ['student', 'cadet', 'officer'] };

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

  if (req.user.role === 'super_admin') {
    if (req.query.program) filter.program = { $in: [req.query.program, 'All'] };
  } else {
    // Every other role — trainee, officer, admin_cwts/admin_rotc — is locked
    // to their own program (plus 'All'-targeted announcements).
    filter.program = { $in: [req.user.program, 'All'] };
  }

  if (['student', 'cadet'].includes(req.user.role)) {
    const audience = req.user.role === 'cadet' ? 'Cadets' : 'Students';
    filter.targetAudience = { $in: ['All', audience] };
    // A trainee only sees announcements targeted at their own campus (or
    // every-campus ones) — same pattern as the program/audience narrowing
    // above, just one more dimension.
    filter.campus = { $in: [req.user.campus, 'All'] };
    filter.$and = [
      { $or: [{ recipients: { $size: 0 } }, { recipients: req.user._id }] },
      // Belt-and-suspenders alongside the TTL index on the model — hides an
      // already-past-expiry announcement in the few seconds before Mongo's
      // background TTL sweep actually deletes the document.
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
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

/**
 * Announcements can target 'All' (both programs), which only super_admin may
 * use. admin_cwts/admin_rotc/officer are locked to their own program.
 */
function assertAnnouncementAccess(user, program) {
  if (user.role === 'super_admin') return;
  if (program === 'All' || program !== user.program) {
    throw ApiError.forbidden('You are not authorized to access this program.');
  }
}

/** GET /api/announcements/:id */
exports.get = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id).populate(
    'createdBy',
    'name role'
  );
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  if (req.user.role !== 'super_admin' && announcement.program !== 'All') {
    assertProgramAccess(req.user, announcement.program);
  }
  res.json({ success: true, data: announcement });
});

/** POST /api/announcements */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'content']);
  assertEnum(req.body.program, [...PROGRAMS, 'All'], 'program');
  assertEnum(req.body.targetAudience, TARGET_AUDIENCES, 'targetAudience');
  if (req.body.campus !== undefined) {
    assertEnum(req.body.campus, [...CAMPUSES, 'All'], 'campus');
  }

  let expiresAt = null;
  if (req.body.expiresAt) {
    expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw ApiError.badRequest('Please provide a valid expiry date.');
    }
    if (expiresAt <= new Date()) {
      throw ApiError.badRequest('Expiry date must be in the future.');
    }
  }

  // Force the program (and, by extension, the audience) to the caller's own
  // program unless they are super_admin — closes the "target the other
  // program" hole for admin_cwts/admin_rotc/officer.
  const program =
    req.user.role === 'super_admin' ? req.body.program || 'All' : req.user.program;

  if (req.user.role !== 'super_admin' && req.body.targetAudience) {
    const wrongAudience =
      (req.user.program === 'CWTS' && req.body.targetAudience === 'Cadets') ||
      (req.user.program === 'ROTC' && req.body.targetAudience === 'Students');
    if (wrongAudience) {
      throw ApiError.forbidden('You are not authorized to target that audience.');
    }
  }

  const announcement = await Announcement.create({
    title: req.body.title,
    content: req.body.content,
    program,
    targetAudience: req.body.targetAudience || 'All',
    campus: req.body.campus || 'All',
    recipients: Array.isArray(req.body.recipients) ? req.body.recipients : [],
    date: req.body.date ? new Date(req.body.date) : new Date(),
    time: req.body.time || '',
    location: req.body.location || '',
    isPinned: Boolean(req.body.isPinned),
    expiresAt,
    status: req.body.status || 'Published',
    createdBy: req.user._id,
    ...(req.file ? { imageUrl: req.file.path, imageName: req.file.originalname } : {}),
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
  if (req.user.role !== 'super_admin' && announcement.program !== 'All') {
    assertProgramAccess(req.user, announcement.program);
  } else if (req.user.role !== 'super_admin') {
    // An existing 'All' announcement may only be edited by super_admin.
    throw ApiError.forbidden('You are not authorized to access this program.');
  }

  assertEnum(req.body.program, [...PROGRAMS, 'All'], 'program');
  assertEnum(req.body.targetAudience, TARGET_AUDIENCES, 'targetAudience');
  if (req.body.campus !== undefined) {
    assertEnum(req.body.campus, [...CAMPUSES, 'All'], 'campus');
  }
  if (req.user.role !== 'super_admin' && req.body.program !== undefined) {
    req.body.program = req.user.program;
  }

  const fields = [
    'title',
    'content',
    'program',
    'targetAudience',
    'campus',
    'time',
    'location',
    'isPinned',
    'status',
    'recipients',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) announcement[f] = req.body[f];
  });
  if (req.file) {
    announcement.imageUrl = req.file.path;
    announcement.imageName = req.file.originalname;
  }
  if (req.body.date !== undefined) announcement.date = new Date(req.body.date);
  if (req.body.expiresAt !== undefined) {
    if (!req.body.expiresAt) {
      announcement.expiresAt = null;
    } else {
      const expiresAt = new Date(req.body.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw ApiError.badRequest('Please provide a valid expiry date.');
      }
      if (expiresAt <= new Date()) {
        throw ApiError.badRequest('Expiry date must be in the future.');
      }
      announcement.expiresAt = expiresAt;
    }
  }

  await announcement.save();
  res.json({ success: true, data: announcement });
});

/** DELETE /api/announcements/:id */
exports.remove = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  if (req.user.role !== 'super_admin') {
    if (announcement.program === 'All') {
      throw ApiError.forbidden('You are not authorized to access this program.');
    }
    assertProgramAccess(req.user, announcement.program);
  }

  await announcement.deleteOne();
  res.json({ success: true, message: 'Announcement deleted.' });
});

/** POST /api/announcements/:id/send — re-notifies the audience. */
exports.send = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  if (req.user.role !== 'super_admin' && announcement.program !== 'All') {
    assertProgramAccess(req.user, announcement.program);
  } else if (req.user.role !== 'super_admin') {
    throw ApiError.forbidden('You are not authorized to access this program.');
  }

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
