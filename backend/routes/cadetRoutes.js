const router = require('express').Router();
const ctrl = require('../controllers/cadetController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

router.use(protect);

router.get('/', authorize(...STAFF_ROLES), ctrl.list);
// Only the ROTC-scoped admin adds cadets — a super_admin can view every
// trainee but does not create accounts into either program.
router.post('/', authorize('admin_rotc'), ctrl.create);
// Must come before '/:id' or express would try to resolve "special-class" as a cadet id.
router.get('/special-class', ctrl.specialClassRoster);
router.get('/unassigned', authorize('officer'), ctrl.unassigned);
router.get('/:id', ctrl.get);
router.post('/:id/assign', authorize('officer'), ctrl.assignToMe);
router.put('/:id', ctrl.update);
router.get('/:id/dashboard', ctrl.dashboard);
router.get('/:id/attendance', ctrl.attendance);
router.get('/:id/grades', ctrl.grades);

module.exports = router;
