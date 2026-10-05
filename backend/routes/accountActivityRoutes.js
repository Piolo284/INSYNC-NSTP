const router = require('express').Router();
const ctrl = require('../controllers/accountActivityController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('system_maintenance_admin'));

router.get('/', ctrl.list);

module.exports = router;
