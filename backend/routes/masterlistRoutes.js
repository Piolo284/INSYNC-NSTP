const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/masterlistController');
const { protect, authorize } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');

// The roster file is parsed for its rows and then discarded — it isn't kept
// as a persisted attachment, so it never needs to leave memory (no GridFS
// upload, no local disk write).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('file');
const file = (req, res, next) =>
  upload(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('That file is larger than 10 MB. Split it or remove unused sheets/columns.'));
    }
    next(err);
  });

router.use(protect);
// The masterlist is a university-wide roster shared by CWTS + ROTC, not
// scoped to either program — managing it (including just viewing it) is
// reserved for the system_maintenance_admin, not super_admin or the
// program-scoped admin_cwts/admin_rotc roles.
router.use(authorize('system_maintenance_admin'));

// Import flow: upload -> validate + preview -> confirm (or cancel).
router.post('/import/preview', file, ctrl.previewImport);
router.post('/import/:id/confirm', ctrl.confirmImport);
router.post('/import/:id/cancel', ctrl.cancelImport);
router.get('/imports', ctrl.listImports);
router.get('/imports/:id', ctrl.getImport);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.delete('/', ctrl.clear);

module.exports = router;
