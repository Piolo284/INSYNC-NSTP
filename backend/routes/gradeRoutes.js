const router = require('express').Router();
const ctrl = require('../controllers/gradeController');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('officer', 'instructor', 'admin');

router.use(protect);

router.get('/report/export', staff, ctrl.exportReport);
router.get('/', ctrl.list);
router.post('/', staff, ctrl.recalculate);
router.get('/:studentId', ctrl.getForStudent);
router.put('/:id', staff, ctrl.update);

module.exports = router;
