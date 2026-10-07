const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getBucket, mimeFor } = require('../middleware/upload');

/**
 * GET /api/files/:id — streams a GridFS-stored upload back out.
 *
 * Deliberately not behind `protect`: every uploaded-file URL used to be an
 * unguessable-but-public Cloudinary link that anyone holding it could fetch
 * with no auth header — every <img>/<a> tag across the admin panel and
 * mobile app relies on exactly that (plain <img src> can't attach a Bearer
 * token). This endpoint keeps the same security model rather than silently
 * breaking every file preview/download in the app.
 */
exports.stream = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.notFound('File not found.');
  }
  const _id = new mongoose.Types.ObjectId(req.params.id);
  const bucket = getBucket();

  const [file] = await bucket.find({ _id }).toArray();
  if (!file) throw ApiError.notFound('File not found.');

  // Files uploaded before the extension-based fix were stored as a generic
  // application/octet-stream — serve those by their real extension too.
  const stored = file.contentType && file.contentType !== 'application/octet-stream' ? file.contentType : null;
  res.set('Content-Type', stored || mimeFor(file.filename));
  // RFC 5987 form, so a name with spaces/accents saves exactly as uploaded
  // ("My File.jpg", not "My%20File.jpg").
  res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.filename || 'file')}`);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');

  const downloadStream = bucket.openDownloadStream(_id);
  downloadStream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  downloadStream.pipe(res);
});
