const router = require('express').Router();
const ctrl = require('../controllers/programController');
const { protect, authorize } = require('../middleware/auth');

// Public — the registration screen fetches this before a JWT exists.
router.get('/', ctrl.list);

// Program/brigade management used to be super_admin's job; it now belongs
// to system_maintenance_admin instead — admin_cwts/admin_rotc keep their
// existing access to their own program's rows.
router.get('/:id', protect, authorize('admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.get);
router.post('/', protect, authorize('admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.create);
router.put('/:id', protect, authorize('admin_cwts', 'admin_rotc', 'system_maintenance_admin'), ctrl.update);
router.delete('/:id', protect, authorize('system_maintenance_admin'), ctrl.remove);

module.exports = router;
