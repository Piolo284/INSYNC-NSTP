const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { notifyUsers } = require('./notify');
const { specialClassTraineeIds } = require('./specialClass');

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

/** The trainee audience label for a program ('Cadets' for ROTC). */
function traineeAudience(program) {
  return program === 'ROTC' ? 'Cadets' : 'Students';
}

function formatManila(date, withTime = true) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  });
}

/**
 * Posts a Published announcement that deep-links to the item it is about
 * (a quiz, assignment, learning module or activity), then notifies its
 * audience. The mobile app opens `linkType`/`linkId` directly when the
 * announcement (or its notification) is tapped.
 *
 * Never throws into the caller's happy path — the module/activity itself has
 * already been saved, so a failed announcement only gets logged.
 */
async function postLinkedAnnouncement({
  linkType,
  linkId,
  linkLabel = '',
  title,
  content,
  program,
  recipients = [],
  date,
  time = '',
  location = '',
  createdBy,
  notification = {},
}) {
  try {
    const announcement = await Announcement.create({
      title,
      content,
      program,
      targetAudience: traineeAudience(program),
      recipients,
      date: date || new Date(),
      time,
      location,
      linkType,
      linkId,
      linkLabel,
      status: 'Published',
      createdBy,
    });

    await notifyUsers(await recipientsFor(announcement), {
      title: notification.title || announcement.title,
      message: notification.message || announcement.content,
      type: notification.type || 'announcement',
      data: {
        ...(notification.data || {}),
        announcementId: announcement._id,
        linkType,
        linkId,
        linkLabel,
      },
    });

    return announcement;
  } catch (err) {
    console.error('[linkedAnnouncement] failed:', err.message);
    return null;
  }
}

/** 'Quiz', 'Assignment' (graded, has a due date) or 'Module' (material). */
function moduleLinkLabel(module) {
  if (module.kind === 'Quiz') return 'Quiz';
  return module.deadline ? 'Assignment' : 'Module';
}

/** Auto-announcement for a newly posted module, assignment or quiz. */
function announceModule(module, createdBy) {
  let heading;
  if (module.kind === 'Quiz') {
    heading = `New quiz: ${module.quizNumber ? `${module.quizNumber} — ` : ''}${module.title}`;
  } else if (module.deadline) {
    heading = `New assignment: ${module.title}`;
  } else {
    heading = `New learning module: ${module.title}`;
  }

  const lines = [];
  if (module.description) lines.push(module.description);
  if (module.deadline) lines.push(`Due: ${formatManila(module.deadline)}`);
  lines.push('Tap to open it.');

  return postLinkedAnnouncement({
    linkType: 'Module',
    linkId: module._id,
    linkLabel: moduleLinkLabel(module),
    title: heading,
    content: lines.join('\n\n'),
    program: module.program,
    createdBy,
    // Keeps the type/data the app already used for "New module posted".
    notification: {
      title: heading,
      message: module.title,
      type: 'module',
      data: { moduleId: module._id },
    },
  });
}

/**
 * Auto-announcement for a newly scheduled activity, addressed to the same
 * trainees who can see the activity: its company/brigade, the Inclusive
 * Learning Section roster, or (program-wide) everyone in the program.
 */
async function announceActivity(activity, createdBy) {
  let recipients = [];
  if (activity.isSpecialClass) {
    recipients = await specialClassTraineeIds(activity.program);
    if (!recipients.length) return null;
  } else if (activity.brigadeId) {
    const users = await User.find({
      role: activity.program === 'ROTC' ? 'cadet' : 'student',
      program: activity.program,
      brigadeId: activity.brigadeId,
      status: 'Active',
    }).select('_id');
    recipients = users.map((u) => u._id);
    // An empty recipients list would mean "everyone" — skip instead.
    if (!recipients.length) return null;
  }

  const time = [activity.startTime, activity.endTime].filter(Boolean).join(' – ');
  const lines = [];
  if (activity.description) lines.push(activity.description);
  lines.push(`Schedule: ${formatManila(activity.date, false)}${time ? `, ${time}` : ''}`);
  if (activity.location) lines.push(`Location: ${activity.location}`);
  lines.push('Tap to view the activity details.');

  return postLinkedAnnouncement({
    linkType: 'Activity',
    linkId: activity._id,
    linkLabel: 'Activity',
    title: `Upcoming activity: ${activity.title}`,
    content: lines.join('\n\n'),
    program: activity.program,
    recipients,
    date: activity.date,
    time,
    location: activity.location || '',
    createdBy,
  });
}

/** Removes the auto-announcements of a deleted module/activity. */
async function removeLinkedAnnouncements(linkType, linkId) {
  try {
    await Announcement.deleteMany({ linkType, linkId });
  } catch (err) {
    console.error('[linkedAnnouncement] cleanup failed:', err.message);
  }
}

module.exports = {
  recipientsFor,
  moduleLinkLabel,
  postLinkedAnnouncement,
  announceModule,
  announceActivity,
  removeLinkedAnnouncements,
};
