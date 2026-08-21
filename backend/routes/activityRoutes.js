const router = require('express').Router();
const ctrl = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');

const photos = uploader('activities').array('photos', 10);
const staff = authorize('officer', 'instructor', 'admin');

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/participants', ctrl.participants);
router.post('/', staff, photos, ctrl.create);
router.put('/:id', staff, photos, ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
