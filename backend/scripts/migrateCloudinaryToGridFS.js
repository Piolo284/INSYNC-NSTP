/**
 * One-time migration: downloads every file this app currently references by
 * a Cloudinary URL and re-uploads it into MongoDB GridFS, then rewrites the
 * owning document's URL field to point at the new GET /api/files/:id
 * endpoint instead. Run once, after deploying the GridFS-based upload.js:
 *
 *   node scripts/migrateCloudinaryToGridFS.js
 *
 * Safe to re-run: any field that no longer looks like a Cloudinary URL
 * (because a previous run already migrated it) is skipped automatically.
 * Nothing is deleted from Cloudinary — the old files are left in place so
 * this can be verified before anyone manually cleans up the Cloudinary
 * dashboard.
 */
require('dotenv').config();
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');

const Document = require('../models/Document');
const ModuleModel = require('../models/Module');
const Submission = require('../models/Submission');
const CertificateRequest = require('../models/CertificateRequest');
const CertificateTemplate = require('../models/CertificateTemplate');
const Activity = require('../models/Activity');
const AttendanceContest = require('../models/AttendanceContest');
const { getBucket } = require('../middleware/upload');

const API_BASE = (
  process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`
).replace(/\/$/, '');

const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

function download(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return resolve(download(res.headers.location, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function filenameFromUrl(url) {
  try {
    return decodeURIComponent(url.split('?')[0].split('/').pop()) || 'file';
  } catch {
    return 'file';
  }
}

async function migrateOneUrl(oldUrl, folder) {
  const { buffer, contentType } = await download(oldUrl);
  const uploadStream = getBucket().openUploadStream(filenameFromUrl(oldUrl), {
    contentType: contentType || 'application/octet-stream',
    metadata: { folder: `nstp/${folder}`, migratedFrom: oldUrl },
  });
  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
    uploadStream.end(buffer);
  });
  return `${API_BASE}/files/${uploadStream.id}`;
}

async function migrateField(Model, field, folder, label) {
  const docs = await Model.find({ [field]: { $regex: 'res\\.cloudinary\\.com' } });
  console.log(`${label}: ${docs.length} to migrate`);
  let ok = 0;
  let failed = 0;
  for (const doc of docs) {
    try {
      doc[field] = await migrateOneUrl(doc[field], folder);
      await doc.save();
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${doc._id}: ${err.message}`);
    }
  }
  console.log(`${label}: done (${ok} migrated, ${failed} failed)`);
}

async function migrateActivityPhotos() {
  const activities = await Activity.find({ photos: { $elemMatch: { $regex: 'res\\.cloudinary\\.com' } } });
  console.log(`Activity.photos: ${activities.length} activities to check`);
  let ok = 0;
  let failed = 0;
  for (const activity of activities) {
    const nextPhotos = [];
    for (const photoUrl of activity.photos) {
      if (!isCloudinaryUrl(photoUrl)) {
        nextPhotos.push(photoUrl);
        continue;
      }
      try {
        nextPhotos.push(await migrateOneUrl(photoUrl, 'activities'));
        ok += 1;
      } catch (err) {
        failed += 1;
        console.error(`  FAILED photo on activity ${activity._id}: ${err.message}`);
        nextPhotos.push(photoUrl); // keep the still-live old URL rather than losing the reference
      }
    }
    activity.photos = nextPhotos;
    await activity.save();
  }
  console.log(`Activity.photos: done (${ok} migrated, ${failed} failed)`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — check backend/.env.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[migrate] connected to ${process.env.MONGODB_URI}`);
  console.log(`[migrate] new files will be served from ${API_BASE}/files/:id`);

  await migrateField(Document, 'fileUrl', 'documents', 'Document.fileUrl');
  await migrateField(ModuleModel, 'fileUrl', 'modules', 'Module.fileUrl');
  await migrateField(Submission, 'fileUrl', 'submissions', 'Submission.fileUrl');
  await migrateField(CertificateRequest, 'certificateUrl', 'certificates', 'CertificateRequest.certificateUrl');
  await migrateField(CertificateTemplate, 'imageUrl', 'certificate-templates', 'CertificateTemplate.imageUrl');
  await migrateField(AttendanceContest, 'attachmentUrl', 'contests', 'AttendanceContest.attachmentUrl');
  await migrateActivityPhotos();

  console.log(
    '[migrate] All done. Cloudinary originals were left untouched — verify everything ' +
      'loads correctly in the app before deleting anything from your Cloudinary dashboard.'
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
