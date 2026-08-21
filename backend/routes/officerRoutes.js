const router = require('express').Router();
const ctrl = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES, ADMIN_ROLES } = require('../config/constants');

router.use(protect);

router.get('/', authorize(...STAFF_ROLES), ctrl.list);
router.get('/:id', authorize(...STAFF_ROLES), ctrl.get);
router.post('/', authorize(...ADMIN_ROLES), ctrl.create);
router.put('/:id', authorize(...STAFF_ROLES), ctrl.update);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;
