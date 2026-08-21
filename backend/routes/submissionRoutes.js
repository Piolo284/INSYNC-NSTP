const router = require('express').Router();
const ctrl = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const { STAFF_ROLES, TRAINEE_ROLES } = require('../config/constants');

const file = uploader('submissions').single('file');
const staff = authorize(...STAFF_ROLES);
const trainee = authorize(...TRAINEE_ROLES);

router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', trainee, file, ctrl.create);
router.put('/:id', file, ctrl.update);
router.post('/:id/grade', staff, ctrl.grade);
router.delete('/:id', ctrl.remove);

module.exports = router;
