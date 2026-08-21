const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const uploadRoot = path.resolve(
  __dirname,
  '..',
  process.env.UPLOAD_DIR || 'uploads'
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ensureDir(uploadRoot);

/**
 * Returns a multer instance that stores files under uploads/<folder>/.
 * Public URL for a stored file is /uploads/<folder>/<filename>.
 */
function uploader(folder) {
  const dest = ensureDir(path.join(uploadRoot, folder));

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      cb(null, `${Date.now()}-${base}${ext}`);
    },
  });

  const maxMb = Number(process.env.MAX_UPLOAD_MB) || 15;

  return multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|webp|gif|zip)$/i;
      if (!allowed.test(file.originalname)) {
        return cb(
          ApiError.badRequest(
            'Unsupported file type. Allowed: pdf, doc(x), ppt(x), xls(x), txt, images, zip.'
          )
        );
      }
      cb(null, true);
    },
  });
}

/** Builds the client-facing relative URL for an uploaded file. */
function publicUrl(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

module.exports = { uploader, publicUrl, uploadRoot };
