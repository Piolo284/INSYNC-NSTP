const router = require('express').Router();
const ctrl = require('../controllers/cadetController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

router.use(protect);

router.get('/', authorize(...STAFF_ROLES), ctrl.list);
router.post('/', authorize('admin_rotc', 'super_admin'), ctrl.create);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.get('/:id/dashboard', ctrl.dashboard);
router.get('/:id/attendance', ctrl.attendance);
router.get('/:id/grades', ctrl.grades);

module.exports = router;
