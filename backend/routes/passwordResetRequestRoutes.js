const router = require('express').Router();
const ctrl = require('../controllers/passwordResetController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
// Reviewing forgot-password requests is system_maintenance_admin's job —
// see the systemAdminScope.js gate and the "system_maintenance_admin"
// memory of what this role is for.
router.use(authorize('system_maintenance_admin'));

router.get('/', ctrl.list);
router.post('/:id/approve', ctrl.approve);
router.post('/:id/reject', ctrl.reject);

module.exports = router;
