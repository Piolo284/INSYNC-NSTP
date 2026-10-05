const CertificateRequest = require('../models/CertificateRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requireFields, assertEnum } = require('../utils/validate');
const { notifyUser } = require('../utils/notify');
const { CERTIFICATE_STATUSES } = require('../config/constants');
const { assertSelfOrStaff } = require('../middleware/auth');
const { assertProgramAccess, scopeFilterToProgram } = require('../utils/programScope');
const { assertBrigadeAccess, scopeFilterToBrigade } = require('../utils/brigadeScope');
const { eligibilityFor } = require('../utils/certificateEligibility');

/**
 * POST /api/certificate-requests
 * A trainee asks the office to issue them a certificate.
 */
exports.create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['type']);

  const existingPending = await CertificateRequest.findOne({
    studentId: req.user._id,
    type: req.body.type,
    status: 'Pending',
  });
  if (existingPending) {
    throw ApiError.conflict('You already have a pending request for this certificate.');
  }

  const request = await CertificateRequest.create({
    studentId: req.user._id,
    program: req.user.program,
    brigadeId: req.user.brigadeId || null,
    type: req.body.type,
    purpose: req.body.purpose || '',
  });

  res.status(201).json({ success: true, data: request });
});

/** GET /api/certificate-requests/mine — the trainee's own filed requests. */
exports.listMine = asyncHandler(async (req, res) => {
  const requests = await CertificateRequest.find({ studentId: req.user._id }).sort({
    createdAt: -1,
  });
  res.json({ success: true, count: requests.length, data: requests });
});

/**
 * GET /api/certificate-requests — admin review queue, program/brigade-scoped
 * exactly like every other staff-facing list.
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    assertEnum(req.query.status, CERTIFICATE_STATUSES, 'status');
    filter.status = req.query.status;
  }
  scopeFilterToProgram(filter, req.user, req.query.program);
  scopeFilterToBrigade(filter, req.user, req.query.brigadeId);

  const requests = await CertificateRequest.find(filter)
    .populate('studentId', 'name email studentId profileImage status')
    .sort({ createdAt: -1 });

  // Eligibility is informational only (see utils/certificateEligibility) — it
  // never blocks the list or the approve/reject flow below.
  const data = await Promise.all(
    requests.map(async (r) => {
      const obj = r.toObject();
      obj.eligibility = await eligibilityFor(r.studentId?._id || r.studentId, r.program, r.studentId?.status);
      return obj;
    })
  );

  res.json({ success: true, count: data.length, data });
});

/** GET /api/certificate-requests/:id */
exports.get = asyncHandler(async (req, res) => {
  const request = await CertificateRequest.findById(req.params.id).populate(
    'studentId',
    'name email studentId profileImage status'
  );
  if (!request) throw ApiError.notFound('Certificate request not found.');

  const ownerId = request.studentId?._id || request.studentId;
  assertSelfOrStaff(req, ownerId);
  if (String(req.user._id) !== String(ownerId)) {
    assertProgramAccess(req.user, request.program);
    assertBrigadeAccess(req.user, request.brigadeId);
  }

  const obj = request.toObject();
  obj.eligibility = await eligibilityFor(ownerId, request.program, request.studentId?.status);

  res.json({ success: true, data: obj });
});

/**
 * PUT /api/certificate-requests/:id — admin approves or rejects. Approving
 * may attach the signed certificate file for the trainee to download.
 */
exports.review = asyncHandler(async (req, res) => {
  requireFields(req.body, ['status']);
  assertEnum(req.body.status, ['Approved', 'Rejected'], 'status');

  const request = await CertificateRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Certificate request not found.');
  if (request.status !== 'Pending') {
    throw ApiError.conflict('This request has already been reviewed.');
  }

  assertProgramAccess(req.user, request.program);
  assertBrigadeAccess(req.user, request.brigadeId);

  request.status = req.body.status;
  request.reviewNote = req.body.reviewNote || '';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();

  if (req.file) {
    request.certificateUrl = req.file.path;
    request.certificateName = req.file.originalname;
    request.certificateSize = req.file.size;
  }

  await request.save();

  await notifyUser(request.studentId, {
    title: request.status === 'Approved' ? 'Certificate request approved' : 'Certificate request rejected',
    message:
      request.status === 'Approved'
        ? `Your request for a ${request.type} was approved.${request.certificateUrl ? ' You can now download it.' : ''}`
        : `Your request for a ${request.type} was rejected.${request.reviewNote ? ` Reason: ${request.reviewNote}` : ''}`,
    type: 'system',
    data: { certificateRequestId: request._id },
  });

  res.json({ success: true, data: request });
});
