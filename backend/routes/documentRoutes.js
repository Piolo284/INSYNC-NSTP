const router = require('express').Router();
const ctrl = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES } = require('../config/constants');

// 5MB is the largest per-document-type cap (see DOCUMENT_TYPE_RULES) — this
// is just the first-pass ceiling multer enforces while streaming; the
// controller enforces each document type's own (possibly smaller, e.g. the
// 2x2 Picture's 1MB) limit once the upload is in.
const file = uploader('documents', {
  maxMb: 5,
  allowedPattern: /\.(pdf|png|jpe?g)$/i,
  typeErrorMessage: 'Unsupported file type. Please upload a PDF or an image (JPG/PNG).',
}).single('file');

router.use(protect);

router.get('/', ctrl.listMine);
router.get('/review', authorize(...STAFF_ROLES), ctrl.listForReview);
router.get('/user/:userId', ctrl.listForUser);
router.post('/', file, ctrl.upload);
// super_admin can see the review queue above (read-only — who approved
// what) but does not review documents itself; only the program officer/
// admin who actually owns the trainee's requirement does.
router.put('/:id', authorize('officer', 'admin_cwts', 'admin_rotc'), ctrl.review);
router.delete('/:id', ctrl.remove);

module.exports = router;
