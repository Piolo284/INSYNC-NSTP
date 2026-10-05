const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/masterlistController');
const { protect, authorize } = require('../middleware/auth');

// The roster file is parsed for its rows and then discarded — it isn't kept
// as a persisted attachment, so it never needs to leave memory (no Cloudinary
// upload, no local disk write).
const file = multer({ storage: multer.memoryStorage() }).single('file');

router.use(protect);
// The masterlist is a university-wide roster shared by CWTS + ROTC, not
// scoped to either program — managing it (including just viewing it) is
// reserved for the system_maintenance_admin, not super_admin or the
// program-scoped admin_cwts/admin_rotc roles.
router.use(authorize('system_maintenance_admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/upload', file, ctrl.upload);
router.delete('/:id', ctrl.remove);
router.delete('/', ctrl.clear);

module.exports = router;
