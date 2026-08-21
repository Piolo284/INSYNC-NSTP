const Notification = require('../models/Notification');

/** Creates one notification. Never throws into the caller's happy path. */
async function notifyUser(recipientId, { title, message, type = 'system', data = {} }) {
  try {
    return await Notification.create({ recipientId, title, message, type, data });
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return null;
  }
}

/** Fan-out helper for announcements and bulk actions. */
async function notifyUsers(recipientIds, payload) {
  const docs = recipientIds.map((recipientId) => ({
    recipientId,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'system',
    data: payload.data || {},
    isRead: false,
  }));

  if (!docs.length) return [];

  try {
    return await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error('[notify] bulk failed:', err.message);
    return [];
  }
}

module.exports = { notifyUser, notifyUsers };
