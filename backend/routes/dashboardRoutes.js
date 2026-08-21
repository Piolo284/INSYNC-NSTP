const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/officer', authorize('officer', 'instructor', 'admin'), ctrl.officer);
router.get('/instructor', authorize('instructor', 'admin'), ctrl.instructor);
router.get('/admin', authorize('admin'), ctrl.admin);

module.exports = router;
