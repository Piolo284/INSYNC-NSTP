const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

router.use(protect);

router.get('/', ctrl.listMine);
router.put('/read-all', ctrl.markAllRead);
router.post('/', authorize(...STAFF_ROLES), ctrl.create);
router.get('/:userId', ctrl.listForUser);
router.put('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
