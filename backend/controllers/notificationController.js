const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/notifications/:userId */
exports.listForUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const isSelf = String(req.user._id) === String(userId);
  if (!isSelf && !['admin', 'instructor'].includes(req.user.role)) {
    throw ApiError.forbidden('You can only view your own notifications.');
  }

  const filter = { recipientId: userId };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100),
    Notification.countDocuments({ recipientId: userId, isRead: false }),
  ]);

  res.json({ success: true, count: items.length, unreadCount, data: items });
});

/** GET /api/notifications — shorthand for the signed-in user. */
exports.listMine = asyncHandler(async (req, res) => {
  const filter = { recipientId: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100),
    Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
  ]);

  res.json({ success: true, count: items.length, unreadCount, data: items });
});

/** PUT /api/notifications/:id/read */
exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found.');

  if (String(notification.recipientId) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only update your own notifications.');
  }

  notification.isRead = req.body.isRead === undefined ? true : Boolean(req.body.isRead);
  await notification.save();

  res.json({ success: true, data: notification });
});

/** PUT /api/notifications/read-all */
exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipientId: req.user._id, isRead: false },
    { isRead: true }
  );
  res.json({ success: true, message: `${result.modifiedCount} marked as read.` });
});

/** POST /api/notifications — staff sending a direct notification. */
exports.create = asyncHandler(async (req, res) => {
  const { recipientId, title, message, type } = req.body;
  if (!recipientId || !title) {
    throw ApiError.badRequest('recipientId and title are required.');
  }

  const notification = await Notification.create({
    recipientId,
    title,
    message: message || '',
    type: type || 'system',
  });

  res.status(201).json({ success: true, data: notification });
});

/** DELETE /api/notifications/:id */
exports.remove = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found.');

  if (
    String(notification.recipientId) !== String(req.user._id) &&
    !['admin'].includes(req.user.role)
  ) {
    throw ApiError.forbidden('You can only delete your own notifications.');
  }

  await notification.deleteOne();
  res.json({ success: true, message: 'Notification deleted.' });
});
