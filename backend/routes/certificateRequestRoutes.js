const router = require('express').Router();
const ctrl = require('../controllers/certificateRequestController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES, TRAINEE_ROLES } = require('../config/constants');

const file = uploader('certificates').single('file');

router.use(protect);

router.get('/mine', authorize(...TRAINEE_ROLES), ctrl.listMine);
router.get('/', authorize(...STAFF_ROLES), ctrl.list);
router.post('/', authorize(...TRAINEE_ROLES), ctrl.create);
router.get('/:id', ctrl.get);
router.put('/:id', authorize(...STAFF_ROLES), file, ctrl.review);

module.exports = router;
