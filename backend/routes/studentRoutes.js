const router = require('express').Router();
const ctrl = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

router.use(protect);

router.get('/at-risk', authorize(...STAFF_ROLES), ctrl.atRisk);
router.get('/', authorize(...STAFF_ROLES), ctrl.list);
// Only the CWTS-scoped admin adds students — a super_admin can view every
// trainee but does not create accounts into either program.
router.post('/', authorize('admin_cwts'), ctrl.create);
// No CWTS "special-class" roster route — the Inclusive Learning Section
// only exists for ROTC (see /api/cadets/special-class).
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.get('/:id/dashboard', ctrl.dashboard);
router.get('/:id/attendance', ctrl.attendance);
router.get('/:id/submissions', ctrl.submissions);
router.get('/:id/grades', ctrl.grades);

module.exports = router;
