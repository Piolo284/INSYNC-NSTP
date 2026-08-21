const router = require('express').Router();
const ctrl = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../config/constants');

const staff = authorize(...STAFF_ROLES);

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', staff, ctrl.create);
router.put('/:id', staff, ctrl.update);
router.delete('/:id', staff, ctrl.remove);
router.post('/:id/send', staff, ctrl.send);

module.exports = router;
