const router = require('express').Router();
const ctrl = require('../controllers/brigadeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Reading/managing brigades is part of the "Programs & Brigades" admin
// feature, moved from super_admin to system_maintenance_admin (see
// programRoutes.js) — officers and program admins keep their existing access.
router.get('/', authorize('officer', 'admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.list);
router.get('/:id', authorize('officer', 'admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.get);
router.put('/:id', authorize('admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.update);

module.exports = router;
