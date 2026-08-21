const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

router.use(protect);

router.get('/stats/overview', authorize(...STAFF_ROLES), ctrl.stats);
router.get('/', authorize(...STAFF_ROLES), ctrl.list);
router.post('/', authorize('super_admin'), ctrl.create);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;
