const DocumentModel = require('../models/Document');
const Student = require('../models/Student');
const Cadet = require('../models/Cadet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { destroy } = require('../middleware/upload');
const { assertSelfOrStaff } = require('../middleware/auth');
const { scopeFilterToBrigade } = require('../utils/brigadeScope');
const { DOCUMENT_TYPE_RULES, DOCUMENT_TYPE_DEFAULT_RULE } = require('../config/constants');

const IMAGE_EXTENSIONS = /\.(png|jpe?g)$/i;
const PDF_EXTENSION = /\.pdf$/i;

/**
 * Enforces the specific document type's own accepted format(s) and size cap
 * (see DOCUMENT_TYPE_RULES) — multer's route-level filter/limit in
 * documentRoutes.js only catches the broadest case (any type, up to the
 * largest per-type cap); this is the real, type-aware check. Deletes the
 * just-uploaded file and throws if it doesn't fit that type's rule.
 */
function assertFileMatchesDocumentType(file, title) {
  const rule = DOCUMENT_TYPE_RULES[title] || DOCUMENT_TYPE_DEFAULT_RULE;
  const isImage = IMAGE_EXTENSIONS.test(file.originalname);
  const isPdf = PDF_EXTENSION.test(file.originalname);
  const kindOk = (isImage && rule.accept.includes('image')) || (isPdf && rule.accept.includes('pdf'));
  const sizeOk = file.size <= rule.maxMb * 1024 * 1024;

  if (kindOk && sizeOk) return;

  destroy(file.filename); // best-effort cleanup; never block the error response on it
  if (!kindOk) {
    const kindLabel = rule.accept.length === 1 ? rule.accept[0] : rule.accept.join(' or ');
    throw ApiError.badRequest(`"${title}" must be a ${kindLabel} file.`);
  }
  throw ApiError.badRequest(`"${title}" must be ${rule.maxMb}MB or smaller.`);
}

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

/**
 * GET /api/documents/review — officer/admin review queue: every document
 * belonging to a trainee in the caller's own program/brigade (an officer is
 * always locked to their own program+brigade; admin_cwts/admin_rotc see
 * their whole program; super_admin sees both CWTS and ROTC together unless
 * `?program=` narrows it to one). Joins through Student/Cadet at query time
 * instead of denormalizing program/brigadeId onto Document, so it also
 * covers documents uploaded before this endpoint existed.
 */
exports.listForReview = asyncHandler(async (req, res) => {
  const requestedProgram = req.user.role === 'super_admin' ? req.query.program : req.user.program;
  const wantsCwts = requestedProgram !== 'ROTC';
  const wantsRotc = requestedProgram !== 'CWTS';

  const brigadeFilter = {};
  scopeFilterToBrigade(brigadeFilter, req.user, req.query.brigadeId);

  const [cwtsTrainees, rotcTrainees] = await Promise.all([
    wantsCwts ? Student.find(brigadeFilter).select('userId fullName studentId program profileImage') : [],
    wantsRotc ? Cadet.find(brigadeFilter).select('userId fullName cadetId program profileImage') : [],
  ]);
  const trainees = [...cwtsTrainees, ...rotcTrainees];
  const traineeById = new Map(trainees.map((t) => [String(t.userId), t]));
  const ownerIds = trainees.map((t) => t.userId);

  const docFilter = { ownerId: { $in: ownerIds } };
  if (req.query.status) docFilter.status = req.query.status;

  const docs = await DocumentModel.find(docFilter)
    .populate('reviewedBy', 'name role')
    .sort({ createdAt: -1 });

  const data = docs.map((d) => {
    const trainee = traineeById.get(String(d.ownerId));
    return {
      ...d.toObject(),
      ownerName: trainee?.fullName || '',
      ownerIdNumber: trainee?.studentId || trainee?.cadetId || '',
      ownerProgram: trainee?.program || '',
      ownerProfileImage: trainee?.profileImage || '',
    };
  });

  res.json({ success: true, count: data.length, data });
});

/** POST /api/documents — upload or re-upload a requirement. */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.body.title) throw ApiError.badRequest('Document title is required.');

  const update = {
    ownerId: req.user._id,
    title: req.body.title,
  };

  if (req.file) {
    assertFileMatchesDocumentType(req.file, req.body.title);

    update.fileUrl = req.file.path;
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

/**
 * PUT /api/documents/:id — officer/program-admin approve/reject.
 * super_admin is deliberately not in this route's authorize() list (see
 * documentRoutes.js) — the NSTP Head can see who reviewed what, but
 * reviewing a trainee's actual requirement is the program officer's job.
 */
exports.review = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found.');

  if (req.body.status !== undefined) {
    doc.status = req.body.status;
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
  }
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
