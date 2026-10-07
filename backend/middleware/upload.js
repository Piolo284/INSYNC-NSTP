const multer = require('multer');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const ApiError = require('../utils/ApiError');

/**
 * MIME type by file extension. Clients don't always label uploads — Flutter's
 * `MultipartFile.fromBytes` sends every file as application/octet-stream —
 * and that label is what GridFS stored and later served, so a JPG came back
 * as an unknown binary download instead of an image. The original file name
 * is the reliable source, so it decides the stored type. The bytes themselves
 * are never changed or converted.
 */
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

function mimeFor(fileName, fallback) {
  const match = /\.([a-z0-9]+)$/i.exec(String(fileName || ''));
  const byExt = match && MIME_BY_EXTENSION[match[1].toLowerCase()];
  return byExt || fallback || 'application/octet-stream';
}

const API_BASE = (
  process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`
).replace(/\/$/, '');

/**
 * Lazily built on every call rather than once at module load — safe because
 * server.js always finishes connecting to MongoDB before it starts accepting
 * HTTP requests, so `mongoose.connection.db` is guaranteed to exist by the
 * time any upload/download actually runs.
 */
function getBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
}

/**
 * Streams one already-validated in-memory file into GridFS and rewrites it
 * to look like what every controller already expects from the old Cloudinary
 * storage engine: `.path` (an absolute URL the client can fetch the file
 * from) and `.filename` (the id needed to delete it later).
 */
function persistFile(file, folder) {
  return new Promise((resolve, reject) => {
    file.mimetype = mimeFor(file.originalname, file.mimetype);
    const uploadStream = getBucket().openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { folder: `nstp/${folder}` },
    });
    uploadStream.on('finish', () => {
      file.filename = String(uploadStream.id);
      file.path = `${API_BASE}/files/${uploadStream.id}`;
      resolve();
    });
    uploadStream.on('error', reject);
    Readable.from(file.buffer).pipe(uploadStream);
  });
}

/**
 * Returns `{ single, array }` field-parsers that read the upload into memory,
 * validate it, then stream it into MongoDB GridFS under nstp/<folder>/ —
 * matching the shape (`req.file.path` / `req.file.filename`) the app used to
 * get from Cloudinary, so route/controller code didn't need to change.
 *
 * `options.maxMb` / `options.allowedPattern` / `options.typeErrorMessage`
 * let one specific route tighten the defaults (e.g. the Documents route
 * only wants pdf/image, at a smaller cap than the general 15MB) without
 * affecting every other caller of uploader().
 */
function uploader(folder, options = {}) {
  const maxMb = options.maxMb || Number(process.env.MAX_UPLOAD_MB) || 15;
  const allowedPattern = options.allowedPattern || /\.(pdf|docx?|pptx?|xlsx?|csv|txt|png|jpe?g|webp|gif|zip)$/i;
  const typeErrorMessage =
    options.typeErrorMessage ||
    'Unsupported file type. Allowed: pdf, doc(x), ppt(x), xls(x), csv, txt, images, zip.';

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!allowedPattern.test(file.originalname)) {
        return cb(ApiError.badRequest(typeErrorMessage));
      }
      cb(null, true);
    },
  });

  function wrap(parseFields, isArray) {
    return (req, res, next) => {
      parseFields(req, res, (err) => {
        if (err) return next(err);
        const files = isArray ? req.files || [] : req.file ? [req.file] : [];
        Promise.all(files.map((f) => persistFile(f, folder)))
          .then(() => next())
          .catch(next);
      });
    };
  }

  return {
    single: (field) => wrap(upload.single(field), false),
    array: (field, max) => wrap(upload.array(field, max), true),
  };
}

/**
 * Best-effort delete of a GridFS file by its id (req.file.filename). Never
 * throws — cleanup failing (e.g. the file is already gone) should never
 * block whatever real response the caller is trying to send.
 */
async function destroy(fileId) {
  if (!fileId) return;
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(fileId));
  } catch {
    // best-effort cleanup
  }
}

module.exports = { uploader, destroy, getBucket, mimeFor };
