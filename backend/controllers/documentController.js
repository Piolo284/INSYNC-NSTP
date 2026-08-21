const DocumentModel = require('../models/Document');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { publicUrl } = require('../middleware/upload');
const { assertSelfOrStaff } = require('../middleware/auth');

/** GET /api/documents — signed-in user's requirement checklist. */
exports.listMine = asyncHandler(async (req, res) => {
  const docs = await DocumentModel.find({ ownerId: req.user._id }).sort({ createdAt: 1 });
  res.json({
    success: true,
    count: docs.length,
    data: {
      uploaded: docs.filter((d) => d.isUploaded),
      pending: docs.filter((d) => !d.isUploaded),
      all: docs,
    },
  });
});

/** GET /api/documents/user/:userId */
exports.listForUser = asyncHandler(async (req, res) => {
  assertSelfOrStaff(req, req.params.userId);
  const docs = await DocumentModel.find({ ownerId: req.params.userId }).sort({ createdAt: 1 });
  res.json({ success: true, count: docs.length, data: docs });
});

/** POST /api/documents — upload or re-upload a requirement. */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.body.title) throw ApiError.badRequest('Document title is required.');

  const update = {
    ownerId: req.user._id,
    title: req.body.title,
  };

  if (req.file) {
    update.fileUrl = publicUrl('documents', req.file.filename);
    update.fileName = req.file.originalname;
    update.fileSize = req.file.size;
    update.isUploaded = true;
    update.status = 'Under Review';
    update.uploadedAt = new Date();
  }

  const doc = await DocumentModel.findOneAndUpdate(
    { ownerId: req.user._id, title: req.body.title },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ success: true, data: doc });
});

/** PUT /api/documents/:id — staff approve/reject. */
exports.review = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found.');

  if (req.body.status !== undefined) doc.status = req.body.status;
  await doc.save();

  res.json({ success: true, data: doc });
});

/** DELETE /api/documents/:id */
exports.remove = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found.');

  assertSelfOrStaff(req, doc.ownerId);
  await doc.deleteOne();

  res.json({ success: true, message: 'Document deleted.' });
});
