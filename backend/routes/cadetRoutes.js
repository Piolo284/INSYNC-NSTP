const router = require('express').Router();
const ctrl = require('../controllers/cadetController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('officer', 'instructor', 'admin'), ctrl.list);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.get('/:id/dashboard', ctrl.dashboard);
router.get('/:id/attendance', ctrl.attendance);
router.get('/:id/grades', ctrl.grades);

module.exports = router;
