const AnnouncementTemplate = require('../models/AnnouncementTemplate');
const { ANNOUNCEMENT_FIELD_KEYS } = AnnouncementTemplate;
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertEnum } = require('../utils/validate');
const { PROGRAMS } = require('../config/constants');

/** GET /api/announcement-templates — both programs' templates. */
exports.list = asyncHandler(async (req, res) => {
  const templates = await AnnouncementTemplate.find();
  res.json({ success: true, data: templates });
});

/** GET /api/announcement-templates/:program */
exports.get = asyncHandler(async (req, res) => {
  assertEnum(req.params.program, PROGRAMS, 'program');
  const template = await AnnouncementTemplate.findOne({ program: req.params.program });
  res.json({ success: true, data: template || null });
});

/**
 * POST /api/announcement-templates/:program — uploads/replaces the sample
 * poster image for a program. Replacing the image resets `fields` (their
 * x/y positions were placed against the old image and won't necessarily
 * still line up) — the admin re-places them against the new one.
 */
exports.upload = asyncHandler(async (req, res) => {
  assertEnum(req.params.program, PROGRAMS, 'program');
  if (!req.file) throw ApiError.badRequest('Please attach an image file.');
  if (!req.body.width || !req.body.height) {
    throw ApiError.badRequest('Missing image dimensions.');
  }

  const template = await AnnouncementTemplate.findOneAndUpdate(
    { program: req.params.program },
    {
      program: req.params.program,
      imageUrl: req.file.path,
      imageName: req.file.originalname,
      imageWidth: Number(req.body.width),
      imageHeight: Number(req.body.height),
      fields: [],
      updatedBy: req.user._id,
    },
    { new: true, upsert: true }
  );

  res.json({ success: true, data: template });
});

/** PUT /api/announcement-templates/:program/fields — save field placements. */
exports.updateFields = asyncHandler(async (req, res) => {
  assertEnum(req.params.program, PROGRAMS, 'program');
  const fields = Array.isArray(req.body.fields) ? req.body.fields : [];

  for (const f of fields) {
    assertEnum(f.key, ANNOUNCEMENT_FIELD_KEYS, 'fields[].key');
    if (typeof f.x !== 'number' || typeof f.y !== 'number' || f.x < 0 || f.x > 100 || f.y < 0 || f.y > 100) {
      throw ApiError.badRequest('Each field needs an x/y position between 0 and 100.');
    }
  }

  const template = await AnnouncementTemplate.findOne({ program: req.params.program });
  if (!template) throw ApiError.notFound('Upload a template image for this program first.');

  template.fields = fields.map((f) => ({
    key: f.key,
    x: f.x,
    y: f.y,
    fontSize: Number(f.fontSize) || 24,
    color: f.color || '#000000',
    fontWeight: f.fontWeight === 'bold' ? 'bold' : 'normal',
    align: ['left', 'center', 'right'].includes(f.align) ? f.align : 'center',
  }));
  template.updatedBy = req.user._id;
  await template.save();

  res.json({ success: true, data: template });
});

/** DELETE /api/announcement-templates/:program */
exports.remove = asyncHandler(async (req, res) => {
  assertEnum(req.params.program, PROGRAMS, 'program');
  await AnnouncementTemplate.deleteOne({ program: req.params.program });
  res.json({ success: true, message: 'Template removed.' });
});
