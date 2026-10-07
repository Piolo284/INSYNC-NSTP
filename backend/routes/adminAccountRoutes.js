const router = require('express').Router();
const ctrl = require('../controllers/adminAccountController');
const { protect, authorize } = require('../middleware/auth');

// Assigning the Super Admin / CWTS Admin / ROTC Admin positions is the
// System Maintenance admin's job only.
router.use(protect);
router.use(authorize('system_maintenance_admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);

module.exports = router;
