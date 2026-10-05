const router = require('express').Router();
const ctrl = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/auth');
const { STAFF_ROLES, ADMIN_ROLES } = require('../config/constants');

router.use(protect);

router.get('/', authorize(...STAFF_ROLES), ctrl.list);
// Must come before '/:id' or express would try to resolve "special-class" as an officer id.
router.get('/special-class', ctrl.specialClassOfficer);
router.get('/:id', authorize(...STAFF_ROLES), ctrl.get);
router.post('/', authorize(...ADMIN_ROLES), ctrl.create);
router.post('/promote', authorize(...ADMIN_ROLES), ctrl.promote);
router.put('/:id', authorize(...STAFF_ROLES), ctrl.update);
router.put('/:id/special-class', authorize(...ADMIN_ROLES), ctrl.assignSpecialClass);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;
